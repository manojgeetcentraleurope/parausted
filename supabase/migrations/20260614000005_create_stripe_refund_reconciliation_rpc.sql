-- ============================================================
-- Slice 8b.6b.1: DB reconciliation RPC for external Stripe refund webhooks
-- ParaUsted - Digital Gift Card SaaS
--
-- Creates a single SECURITY DEFINER, service_role-only RPC that
-- reconciles DB state when Stripe emits refund.created,
-- refund.updated, or refund.failed webhook events for refunds that
-- were issued externally via the Stripe Dashboard (i.e. NOT through
-- the ParaUsted begin_online_refund / finalize_online_refund saga).
--
-- This RPC is DB-only. It does NOT call Stripe, does NOT touch the
-- ledger, payouts, delivery, or email. It does NOT mutate redemptions.
--
-- Out of scope: ledger entries, payouts, delivery events, email/WhatsApp,
-- refund saga RPCs (begin_online_refund / finalize_online_refund),
-- webhook route handler (Slice 8b.6b.2).
-- ============================================================

CREATE OR REPLACE FUNCTION public.reconcile_stripe_refund_webhook(
    p_event_id              TEXT,
    p_event_type            TEXT,
    p_refund_id             TEXT,
    p_refund_status         TEXT,
    p_refund_amount_cents   INTEGER,
    p_currency              TEXT    DEFAULT NULL,
    p_payment_intent_id     TEXT    DEFAULT NULL,
    p_charge_id             TEXT    DEFAULT NULL,   -- evidence-only; not used for purchase mapping
    p_purchase_id           UUID    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_currency              TEXT;
    v_event_type            TEXT;
    v_refund_status         TEXT;
    v_purchase              RECORD;
    v_voucher               RECORD;
    v_redemption_count      INTEGER;
    v_updated_purchase_id   UUID;
    v_updated_voucher_id    UUID;
    v_audit_payload         JSONB;
    v_fraud_evidence        JSONB;
BEGIN
    -- --------------------------------------------------------
    -- 1. Validate required inputs (permanent bad-input guard)
    -- --------------------------------------------------------
    IF p_event_id IS NULL OR trim(p_event_id) = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'invalid_input',
            'purchase_id', NULL,
            'stripe_refund_id', NULL
        );
    END IF;

    -- Normalize event_type; empty/null falls through to unsupported_event_type below
    v_event_type := lower(trim(coalesce(p_event_type, '')));

    IF v_event_type NOT IN ('refund.created', 'refund.updated', 'refund.failed') THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'unsupported_event_type',
            'purchase_id', NULL,
            'stripe_refund_id', NULL
        );
    END IF;

    IF p_refund_id IS NULL OR trim(p_refund_id) = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'invalid_input',
            'purchase_id', NULL,
            'stripe_refund_id', NULL
        );
    END IF;

    IF p_refund_status IS NULL OR trim(p_refund_status) = '' THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'invalid_input',
            'purchase_id', NULL,
            'stripe_refund_id', NULL
        );
    END IF;

    IF p_refund_amount_cents IS NULL OR p_refund_amount_cents < 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'invalid_input',
            'purchase_id', NULL,
            'stripe_refund_id', NULL
        );
    END IF;

    -- Normalize optional/remaining inputs after all validation passes
    v_currency      := NULLIF(lower(trim(coalesce(p_currency, ''))), '');
    v_refund_status := lower(trim(p_refund_status));

    -- --------------------------------------------------------
    -- 2. Idempotency: mark event as processed after input validation.
    --    ON CONFLICT DO NOTHING means FOUND = false if already there.
    -- --------------------------------------------------------
    INSERT INTO processed_webhooks (event_id, provider, event_type)
    VALUES (p_event_id, 'stripe', v_event_type)
    ON CONFLICT (event_id) DO NOTHING;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'outcome', 'already_processed',
            'purchase_id', NULL,
            'stripe_refund_id', p_refund_id
        );
    END IF;

    -- --------------------------------------------------------
    -- 3. Non-terminal refund statuses: nothing to reconcile yet.
    -- --------------------------------------------------------
    IF v_refund_status IN ('pending', 'requires_action') THEN
        RETURN jsonb_build_object(
            'success', true,
            'outcome', 'noop_pending',
            'purchase_id', NULL,
            'stripe_refund_id', p_refund_id
        );
    END IF;

    -- --------------------------------------------------------
    -- 4. Reject truly unknown terminal statuses permanently.
    --    Supported: 'succeeded', 'failed', 'canceled'.
    --    Insert fraud flag with purchase_id = NULL, merchant_id = NULL
    --    (purchase not yet mapped; p_purchase_id kept in evidence JSON only).
    -- --------------------------------------------------------
    IF v_refund_status NOT IN ('succeeded', 'failed', 'canceled') THEN
        INSERT INTO fraud_flags (
            purchase_id, merchant_id, rule_code, severity, description, evidence
        ) VALUES (
            NULL,
            NULL,
            'external_refund_unknown_status',
            'medium',
            'Stripe refund webhook received with unrecognised refund status.',
            jsonb_build_object(
                'event_id',             p_event_id,
                'event_type',           v_event_type,
                'refund_id',            p_refund_id,
                'refund_status',        v_refund_status,
                'refund_amount_cents',  p_refund_amount_cents,
                'currency',             v_currency,
                'payment_intent_id',    p_payment_intent_id,
                'charge_id',            p_charge_id,
                'purchase_id',          p_purchase_id   -- evidence only; no FK
            )
        );

        RETURN jsonb_build_object(
            'success', true,
            'outcome', 'unsupported_refund_status',
            'purchase_id', NULL,
            'stripe_refund_id', p_refund_id
        );
    END IF;

    -- --------------------------------------------------------
    -- 5. Map the purchase row.
    --    Preferred: p_purchase_id (explicit). Fallback: payment_intent_id.
    --    Require a unique match.
    --    All fraud_flags before a confirmed purchase row use
    --    purchase_id = NULL, merchant_id = NULL (FK safety).
    --    Raw p_purchase_id is kept in evidence JSON only.
    -- --------------------------------------------------------
    IF p_purchase_id IS NOT NULL THEN
        SELECT id,
               merchant_id,
               status,
               payment_source,
               payment_method,
               reference_code,
               amount_cents,
               currency,
               stripe_payment_intent_id,
               stripe_refund_id,
               refunded_at
        INTO v_purchase
        FROM purchases
        WHERE id = p_purchase_id
        FOR UPDATE;

        IF NOT FOUND THEN
            INSERT INTO fraud_flags (
                purchase_id, merchant_id, rule_code, severity, description, evidence
            ) VALUES (
                NULL,
                NULL,
                'external_refund_unmapped',
                'high',
                'Stripe refund webhook could not be mapped to a purchase by explicit purchase_id.',
                jsonb_build_object(
                    'event_id',             p_event_id,
                    'event_type',           v_event_type,
                    'refund_id',            p_refund_id,
                    'refund_status',        v_refund_status,
                    'refund_amount_cents',  p_refund_amount_cents,
                    'currency',             v_currency,
                    'payment_intent_id',    p_payment_intent_id,
                    'charge_id',            p_charge_id,
                    'purchase_id',          p_purchase_id   -- evidence only; no FK
                )
            );

            RETURN jsonb_build_object(
                'success', true,
                'outcome', 'unmapped',
                'purchase_id', NULL,
                'stripe_refund_id', p_refund_id
            );
        END IF;

    ELSIF p_payment_intent_id IS NOT NULL AND trim(p_payment_intent_id) <> '' THEN
        -- Guard against ambiguous mapping (should never happen in practice, but guard it)
        IF (
            SELECT count(*)
            FROM purchases
            WHERE stripe_payment_intent_id = p_payment_intent_id
        ) > 1 THEN
            INSERT INTO fraud_flags (
                purchase_id, merchant_id, rule_code, severity, description, evidence
            ) VALUES (
                NULL,
                NULL,
                'external_refund_mapping_ambiguous',
                'critical',
                'Stripe refund webhook matched multiple purchases via payment_intent_id. Manual review required.',
                jsonb_build_object(
                    'event_id',             p_event_id,
                    'event_type',           v_event_type,
                    'refund_id',            p_refund_id,
                    'refund_status',        v_refund_status,
                    'refund_amount_cents',  p_refund_amount_cents,
                    'currency',             v_currency,
                    'payment_intent_id',    p_payment_intent_id,
                    'charge_id',            p_charge_id
                )
            );

            RETURN jsonb_build_object(
                'success', true,
                'outcome', 'conflict_mapping_ambiguous',
                'purchase_id', NULL,
                'stripe_refund_id', p_refund_id
            );
        END IF;

        SELECT id,
               merchant_id,
               status,
               payment_source,
               payment_method,
               reference_code,
               amount_cents,
               currency,
               stripe_payment_intent_id,
               stripe_refund_id,
               refunded_at
        INTO v_purchase
        FROM purchases
        WHERE stripe_payment_intent_id = p_payment_intent_id
        FOR UPDATE;

        IF NOT FOUND THEN
            INSERT INTO fraud_flags (
                purchase_id, merchant_id, rule_code, severity, description, evidence
            ) VALUES (
                NULL,
                NULL,
                'external_refund_unmapped',
                'high',
                'Stripe refund webhook could not be mapped to a purchase by payment_intent_id.',
                jsonb_build_object(
                    'event_id',             p_event_id,
                    'event_type',           v_event_type,
                    'refund_id',            p_refund_id,
                    'refund_status',        v_refund_status,
                    'refund_amount_cents',  p_refund_amount_cents,
                    'currency',             v_currency,
                    'payment_intent_id',    p_payment_intent_id,
                    'charge_id',            p_charge_id
                )
            );

            RETURN jsonb_build_object(
                'success', true,
                'outcome', 'unmapped',
                'purchase_id', NULL,
                'stripe_refund_id', p_refund_id
            );
        END IF;

    ELSE
        -- No mapping identifier provided at all
        INSERT INTO fraud_flags (
            purchase_id, merchant_id, rule_code, severity, description, evidence
        ) VALUES (
            NULL,
            NULL,
            'external_refund_unmapped',
            'high',
            'Stripe refund webhook arrived with no purchase_id or payment_intent_id.',
            jsonb_build_object(
                'event_id',             p_event_id,
                'event_type',           v_event_type,
                'refund_id',            p_refund_id,
                'refund_status',        v_refund_status,
                'refund_amount_cents',  p_refund_amount_cents,
                'currency',             v_currency,
                'charge_id',            p_charge_id
            )
        );

        RETURN jsonb_build_object(
            'success', true,
            'outcome', 'unmapped',
            'purchase_id', NULL,
            'stripe_refund_id', p_refund_id
        );
    END IF;

    -- --------------------------------------------------------
    -- 6. We have a locked purchase row. Validate payment source.
    --    merchant_id derived from purchase row only — never caller.
    -- --------------------------------------------------------
    IF v_purchase.payment_source <> 'ONLINE' OR v_purchase.payment_method <> 'card' THEN
        -- Audit the conflict; do not mutate
        INSERT INTO audit_events (
            merchant_id, event_type, actor_type, actor_id, entity_type, entity_id, payload
        ) VALUES (
            v_purchase.merchant_id,
            'external_refund_conflict',
            'system',
            'stripe_webhook',
            'purchase',
            v_purchase.id,
            jsonb_build_object(
                'event_id',             p_event_id,
                'event_type',           v_event_type,
                'refund_id',            p_refund_id,
                'refund_status',        v_refund_status,
                'refund_amount_cents',  p_refund_amount_cents,
                'currency',             v_currency,
                'payment_intent_id',    p_payment_intent_id,
                'charge_id',            p_charge_id,
                'purchase_id',          v_purchase.id,
                'reference_code',       v_purchase.reference_code,
                'refund_type',          'external_stripe_webhook',
                'conflict',             'invalid_payment_source'
            )
        );

        RETURN jsonb_build_object(
            'success', true,
            'outcome', 'invalid_payment_source',
            'purchase_id', v_purchase.id,
            'stripe_refund_id', p_refund_id
        );
    END IF;

    -- --------------------------------------------------------
    -- 7. Currency check (V1: EUR only; flag mismatches).
    -- --------------------------------------------------------
    IF v_currency IS NOT NULL AND lower(v_currency) <> lower(v_purchase.currency) THEN
        v_fraud_evidence := jsonb_build_object(
            'event_id',             p_event_id,
            'event_type',           v_event_type,
            'refund_id',            p_refund_id,
            'refund_status',        v_refund_status,
            'refund_amount_cents',  p_refund_amount_cents,
            'currency',             v_currency,
            'payment_intent_id',    p_payment_intent_id,
            'charge_id',            p_charge_id,
            'purchase_id',          v_purchase.id,
            'reference_code',       v_purchase.reference_code,
            'purchase_currency',    v_purchase.currency
        );

        INSERT INTO fraud_flags (
            purchase_id, merchant_id, rule_code, severity, description, evidence
        ) VALUES (
            v_purchase.id,
            v_purchase.merchant_id,
            'external_refund_currency_mismatch',
            'high',
            'Stripe refund webhook currency does not match purchase currency.',
            v_fraud_evidence
        );

        INSERT INTO audit_events (
            merchant_id, event_type, actor_type, actor_id, entity_type, entity_id, payload
        ) VALUES (
            v_purchase.merchant_id,
            'external_refund_conflict',
            'system',
            'stripe_webhook',
            'purchase',
            v_purchase.id,
            v_fraud_evidence || jsonb_build_object(
                'refund_type', 'external_stripe_webhook',
                'conflict',    'currency_mismatch'
            )
        );

        RETURN jsonb_build_object(
            'success', true,
            'outcome', 'conflict_currency_mismatch',
            'purchase_id', v_purchase.id,
            'stripe_refund_id', p_refund_id
        );
    END IF;

    -- --------------------------------------------------------
    -- 8. Load and lock the voucher for this purchase.
    --    Handle missing voucher immediately — flag and return without
    --    mutating the purchase.
    -- --------------------------------------------------------
    SELECT id,
           code,
           status,
           balance_cents,
           original_amount_cents
    INTO v_voucher
    FROM vouchers
    WHERE purchase_id = v_purchase.id
      AND merchant_id = v_purchase.merchant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        v_fraud_evidence := jsonb_build_object(
            'event_id',             p_event_id,
            'event_type',           v_event_type,
            'refund_id',            p_refund_id,
            'refund_status',        v_refund_status,
            'refund_amount_cents',  p_refund_amount_cents,
            'currency',             v_currency,
            'payment_intent_id',    p_payment_intent_id,
            'charge_id',            p_charge_id,
            'purchase_id',          v_purchase.id,
            'reference_code',       v_purchase.reference_code,
            'purchase_status',      v_purchase.status
        );

        INSERT INTO fraud_flags (
            purchase_id, merchant_id, rule_code, severity, description, evidence
        ) VALUES (
            v_purchase.id,
            v_purchase.merchant_id,
            'external_refund_missing_voucher',
            'high',
            'Stripe refund webhook received for a confirmed purchase with no associated voucher.',
            v_fraud_evidence
        );

        INSERT INTO audit_events (
            merchant_id, event_type, actor_type, actor_id, entity_type, entity_id, payload
        ) VALUES (
            v_purchase.merchant_id,
            'external_refund_conflict',
            'system',
            'stripe_webhook',
            'purchase',
            v_purchase.id,
            v_fraud_evidence || jsonb_build_object(
                'refund_type', 'external_stripe_webhook',
                'conflict',    'missing_voucher'
            )
        );

        RETURN jsonb_build_object(
            'success', true,
            'outcome', 'conflict_missing_voucher',
            'purchase_id', v_purchase.id,
            'stripe_refund_id', p_refund_id
        );
    END IF;

    -- Count redemptions (checked after voucher lock for consistency)
    SELECT count(*)
    INTO v_redemption_count
    FROM redemptions
    WHERE voucher_id = v_voucher.id
      AND merchant_id = v_purchase.merchant_id;

    -- --------------------------------------------------------
    -- Build the shared audit payload base (used throughout the
    -- case branches below; each branch merges additional fields).
    -- Uses normalized v_event_type and v_refund_status.
    -- p_charge_id is included as evidence only; not used for purchase mapping.
    -- --------------------------------------------------------
    v_audit_payload := jsonb_build_object(
        'event_id',             p_event_id,
        'event_type',           v_event_type,
        'refund_id',            p_refund_id,
        'refund_status',        v_refund_status,
        'refund_amount_cents',  p_refund_amount_cents,
        'currency',             v_currency,
        'payment_intent_id',    p_payment_intent_id,
        'charge_id',            p_charge_id,
        'purchase_id',          v_purchase.id,
        'reference_code',       v_purchase.reference_code,
        'voucher_id',           v_voucher.id,
        'voucher_code',         v_voucher.code,
        'refund_type',          'external_stripe_webhook'
    );

    -- --------------------------------------------------------
    -- Case F/G: purchase is already in a refunded terminal state.
    -- --------------------------------------------------------
    IF v_purchase.status = 'refunded' THEN
        -- Case F: same stripe_refund_id → already reconciled, idempotent
        IF v_purchase.stripe_refund_id IS NOT NULL
           AND v_purchase.stripe_refund_id = p_refund_id THEN
            RETURN jsonb_build_object(
                'success', true,
                'outcome', 'already_reconciled',
                'purchase_id', v_purchase.id,
                'stripe_refund_id', p_refund_id
            );
        END IF;

        -- Case G: different (or NULL) stripe_refund_id → flag the mismatch
        INSERT INTO fraud_flags (
            purchase_id, merchant_id, rule_code, severity, description, evidence
        ) VALUES (
            v_purchase.id,
            v_purchase.merchant_id,
            'external_refund_id_mismatch',
            'high',
            'Stripe refund webhook arrived for a purchase already refunded with a different refund id.',
            v_audit_payload || jsonb_build_object(
                'existing_stripe_refund_id', v_purchase.stripe_refund_id
            )
        );

        INSERT INTO audit_events (
            merchant_id, event_type, actor_type, actor_id, entity_type, entity_id, payload
        ) VALUES (
            v_purchase.merchant_id,
            'external_refund_conflict',
            'system',
            'stripe_webhook',
            'purchase',
            v_purchase.id,
            v_audit_payload || jsonb_build_object(
                'existing_stripe_refund_id', v_purchase.stripe_refund_id,
                'conflict',                  'refund_id_mismatch'
            )
        );

        RETURN jsonb_build_object(
            'success', true,
            'outcome', 'conflict_refund_id_mismatch',
            'purchase_id', v_purchase.id,
            'stripe_refund_id', p_refund_id
        );
    END IF;

    -- --------------------------------------------------------
    -- Amount mismatch checks for all succeeded events.
    -- Must occur before any purchase/voucher mutation (Cases A and C).
    -- --------------------------------------------------------
    IF v_refund_status = 'succeeded' THEN
        -- Partial refund: amount less than purchase amount
        IF p_refund_amount_cents < v_purchase.amount_cents THEN
            INSERT INTO fraud_flags (
                purchase_id, merchant_id, rule_code, severity, description, evidence
            ) VALUES (
                v_purchase.id,
                v_purchase.merchant_id,
                'external_partial_refund_detected',
                'high',
                'External Stripe partial refund detected. ParaUsted V1 policy allows full refunds only.',
                v_audit_payload || jsonb_build_object(
                    'purchase_amount_cents', v_purchase.amount_cents,
                    'voucher_status',        v_voucher.status,
                    'redemption_count',      v_redemption_count
                )
            );

            INSERT INTO audit_events (
                merchant_id, event_type, actor_type, actor_id, entity_type, entity_id, payload
            ) VALUES (
                v_purchase.merchant_id,
                'external_partial_refund_detected',
                'system',
                'stripe_webhook',
                'purchase',
                v_purchase.id,
                v_audit_payload || jsonb_build_object(
                    'purchase_amount_cents', v_purchase.amount_cents,
                    'voucher_status',        v_voucher.status,
                    'redemption_count',      v_redemption_count
                )
            );

            RETURN jsonb_build_object(
                'success', true,
                'outcome', 'conflict_partial',
                'purchase_id', v_purchase.id,
                'stripe_refund_id', p_refund_id
            );
        END IF;

        -- Over-refund: amount exceeds purchase amount
        IF p_refund_amount_cents > v_purchase.amount_cents THEN
            INSERT INTO fraud_flags (
                purchase_id, merchant_id, rule_code, severity, description, evidence
            ) VALUES (
                v_purchase.id,
                v_purchase.merchant_id,
                'external_refund_amount_mismatch',
                'high',
                'External Stripe refund amount exceeds the original purchase amount.',
                v_audit_payload || jsonb_build_object(
                    'purchase_amount_cents', v_purchase.amount_cents,
                    'voucher_status',        v_voucher.status,
                    'redemption_count',      v_redemption_count
                )
            );

            INSERT INTO audit_events (
                merchant_id, event_type, actor_type, actor_id, entity_type, entity_id, payload
            ) VALUES (
                v_purchase.merchant_id,
                'external_refund_conflict',
                'system',
                'stripe_webhook',
                'purchase',
                v_purchase.id,
                v_audit_payload || jsonb_build_object(
                    'purchase_amount_cents', v_purchase.amount_cents,
                    'voucher_status',        v_voucher.status,
                    'redemption_count',      v_redemption_count,
                    'conflict',              'amount_mismatch'
                )
            );

            RETURN jsonb_build_object(
                'success', true,
                'outcome', 'conflict_amount_mismatch',
                'purchase_id', v_purchase.id,
                'stripe_refund_id', p_refund_id
            );
        END IF;
    END IF;

    -- --------------------------------------------------------
    -- Case A: internal saga already in refund_pending; Stripe confirms
    --         succeeded → mark refunded and store refund id.
    --         Amount is confirmed = purchase.amount_cents (checked above).
    -- --------------------------------------------------------
    IF v_purchase.status = 'refund_pending' AND v_refund_status = 'succeeded' THEN
        UPDATE purchases
        SET status           = 'refunded',
            refunded_at      = now(),
            stripe_refund_id = p_refund_id
        WHERE id          = v_purchase.id
          AND merchant_id = v_purchase.merchant_id
          AND status      = 'refund_pending'
        RETURNING id INTO v_updated_purchase_id;

        IF v_updated_purchase_id IS NULL THEN
            RAISE EXCEPTION
                'reconcile_stripe_refund_webhook: Case A purchase transition lost for %',
                v_purchase.id;
        END IF;

        INSERT INTO audit_events (
            merchant_id, event_type, actor_type, actor_id, entity_type, entity_id, payload
        ) VALUES (
            v_purchase.merchant_id,
            'purchase_refunded',
            'system',
            'stripe_webhook',
            'purchase',
            v_purchase.id,
            v_audit_payload || jsonb_build_object('case', 'reconciled_internal')
        );

        RETURN jsonb_build_object(
            'success', true,
            'outcome', 'reconciled_internal',
            'purchase_id', v_purchase.id,
            'stripe_refund_id', p_refund_id
        );
    END IF;

    -- --------------------------------------------------------
    -- Case B: internal saga in refund_pending; Stripe reports
    --         failed or canceled → move to refund_failed.
    --         Voucher stays voided (already voided by begin_online_refund).
    -- --------------------------------------------------------
    IF v_purchase.status = 'refund_pending'
       AND v_refund_status IN ('failed', 'canceled') THEN
        UPDATE purchases
        SET status = 'refund_failed'
        WHERE id          = v_purchase.id
          AND merchant_id = v_purchase.merchant_id
          AND status      = 'refund_pending'
        RETURNING id INTO v_updated_purchase_id;

        IF v_updated_purchase_id IS NULL THEN
            RAISE EXCEPTION
                'reconcile_stripe_refund_webhook: Case B purchase transition lost for %',
                v_purchase.id;
        END IF;

        INSERT INTO audit_events (
            merchant_id, event_type, actor_type, actor_id, entity_type, entity_id, payload
        ) VALUES (
            v_purchase.merchant_id,
            'refund_failed',
            'system',
            'stripe_webhook',
            'purchase',
            v_purchase.id,
            v_audit_payload || jsonb_build_object('case', 'refund_failed_recorded')
        );

        RETURN jsonb_build_object(
            'success', true,
            'outcome', 'refund_failed_recorded',
            'purchase_id', v_purchase.id,
            'stripe_refund_id', p_refund_id
        );
    END IF;

    -- --------------------------------------------------------
    -- Case D (priority before C): redemptions exist on a succeeded
    --         refund — critical fraud flag, do not mutate.
    --         Amount is confirmed = purchase.amount_cents (checked above).
    -- --------------------------------------------------------
    IF v_refund_status = 'succeeded' AND v_redemption_count > 0 THEN
        INSERT INTO fraud_flags (
            purchase_id, merchant_id, rule_code, severity, description, evidence
        ) VALUES (
            v_purchase.id,
            v_purchase.merchant_id,
            'external_refund_after_redemption',
            'critical',
            'External Stripe refund succeeded on a voucher that has already been redeemed.',
            v_audit_payload || jsonb_build_object(
                'voucher_status',    v_voucher.status,
                'redemption_count',  v_redemption_count
            )
        );

        INSERT INTO audit_events (
            merchant_id, event_type, actor_type, actor_id, entity_type, entity_id, payload
        ) VALUES (
            v_purchase.merchant_id,
            'external_refund_conflict',
            'system',
            'stripe_webhook',
            'purchase',
            v_purchase.id,
            v_audit_payload || jsonb_build_object(
                'voucher_status',   v_voucher.status,
                'redemption_count', v_redemption_count,
                'conflict',         'refund_after_redemption'
            )
        );

        RETURN jsonb_build_object(
            'success', true,
            'outcome', 'conflict_redeemed',
            'purchase_id', v_purchase.id,
            'stripe_refund_id', p_refund_id
        );
    END IF;

    -- --------------------------------------------------------
    -- Case C: external full refund on an unused, active voucher.
    --
    -- By this point (all must hold simultaneously):
    --   v_refund_status = 'succeeded'
    --   p_refund_amount_cents = purchase.amount_cents  (amount checks passed above)
    --   v_redemption_count = 0                         (Case D did not fire)
    --   purchase.status = 'payment_confirmed'
    --   voucher.status IN ('issued','delivered')
    --   balance_cents = original_amount_cents
    -- --------------------------------------------------------
    IF v_purchase.status = 'payment_confirmed'
       AND v_refund_status = 'succeeded'
       AND v_voucher.status IN ('issued', 'delivered')
       AND v_voucher.balance_cents = v_voucher.original_amount_cents THEN

        -- Void voucher (guarded transition with merchant_id)
        UPDATE vouchers
        SET status = 'voided'
        WHERE id          = v_voucher.id
          AND merchant_id = v_purchase.merchant_id
          AND status      IN ('issued', 'delivered')
        RETURNING id INTO v_updated_voucher_id;

        IF v_updated_voucher_id IS NULL THEN
            RAISE EXCEPTION
                'reconcile_stripe_refund_webhook: Case C voucher void transition lost for %',
                v_voucher.id;
        END IF;

        -- Mark purchase refunded (guarded transition with merchant_id)
        UPDATE purchases
        SET status           = 'refunded',
            refunded_at      = now(),
            stripe_refund_id = p_refund_id
        WHERE id          = v_purchase.id
          AND merchant_id = v_purchase.merchant_id
          AND status      = 'payment_confirmed'
        RETURNING id INTO v_updated_purchase_id;

        IF v_updated_purchase_id IS NULL THEN
            RAISE EXCEPTION
                'reconcile_stripe_refund_webhook: Case C purchase transition lost for %',
                v_purchase.id;
        END IF;

        INSERT INTO audit_events (
            merchant_id, event_type, actor_type, actor_id, entity_type, entity_id, payload
        ) VALUES (
            v_purchase.merchant_id,
            'external_refund_detected',
            'system',
            'stripe_webhook',
            'purchase',
            v_purchase.id,
            v_audit_payload || jsonb_build_object('case', 'reconciled_external')
        );

        INSERT INTO audit_events (
            merchant_id, event_type, actor_type, actor_id, entity_type, entity_id, payload
        ) VALUES (
            v_purchase.merchant_id,
            'voucher_voided',
            'system',
            'stripe_webhook',
            'voucher',
            v_voucher.id,
            v_audit_payload || jsonb_build_object('case', 'reconciled_external')
        );

        INSERT INTO audit_events (
            merchant_id, event_type, actor_type, actor_id, entity_type, entity_id, payload
        ) VALUES (
            v_purchase.merchant_id,
            'purchase_refunded',
            'system',
            'stripe_webhook',
            'purchase',
            v_purchase.id,
            v_audit_payload || jsonb_build_object('case', 'reconciled_external')
        );

        RETURN jsonb_build_object(
            'success', true,
            'outcome', 'reconciled_external',
            'purchase_id', v_purchase.id,
            'stripe_refund_id', p_refund_id
        );
    END IF;

    -- --------------------------------------------------------
    -- 16. Catch-all for other purchase statuses not handled above
    --     (e.g. pending, cancelled, partially_refunded,
    --      refund_failed + succeeded, payment_confirmed + failed/canceled).
    --     Emit fraud flag + audit; return stable permanent outcome.
    -- --------------------------------------------------------
    INSERT INTO fraud_flags (
        purchase_id, merchant_id, rule_code, severity, description, evidence
    ) VALUES (
        v_purchase.id,
        v_purchase.merchant_id,
        'external_refund_status_mismatch',
        'medium',
        'External Stripe refund webhook arrived in an unhandled purchase/voucher status combination.',
        v_audit_payload || jsonb_build_object(
            'purchase_status',  v_purchase.status,
            'voucher_status',   v_voucher.status,
            'redemption_count', v_redemption_count
        )
    );

    INSERT INTO audit_events (
        merchant_id, event_type, actor_type, actor_id, entity_type, entity_id, payload
    ) VALUES (
        v_purchase.merchant_id,
        'external_refund_conflict',
        'system',
        'stripe_webhook',
        'purchase',
        v_purchase.id,
        v_audit_payload || jsonb_build_object(
            'purchase_status',  v_purchase.status,
            'voucher_status',   v_voucher.status,
            'redemption_count', v_redemption_count,
            'conflict',         'status_mismatch_unhandled'
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'outcome', 'conflict_unknown_status',
        'purchase_id', v_purchase.id,
        'stripe_refund_id', p_refund_id
    );
END;
$$;

-- ============================================================
-- Grants: service_role only
-- ============================================================
REVOKE ALL ON FUNCTION public.reconcile_stripe_refund_webhook(
    TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, UUID
) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.reconcile_stripe_refund_webhook(
    TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, UUID
) FROM anon;

REVOKE ALL ON FUNCTION public.reconcile_stripe_refund_webhook(
    TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, UUID
) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.reconcile_stripe_refund_webhook(
    TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, UUID
) TO service_role;

COMMENT ON FUNCTION public.reconcile_stripe_refund_webhook(
    TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, UUID
)
IS 'DB-only reconciliation for external Stripe refund webhook events (refund.created, refund.updated, refund.failed). Handles idempotency via processed_webhooks, maps purchase by explicit id or payment_intent_id, and deterministically transitions purchase/voucher state or emits fraud_flags. No Stripe calls, no ledger/payout/delivery/email side effects, no redemption mutation. p_charge_id is evidence-only and not used for purchase mapping. GRANT EXECUTE to service_role only.';
