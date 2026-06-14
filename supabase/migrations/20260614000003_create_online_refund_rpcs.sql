-- ============================================================
-- Slice 8b.2: online Stripe refund saga — DB RPCs only
-- ParaUsted - Digital Gift Card SaaS
--
-- Creates two SECURITY DEFINER, authenticated-only RPCs that manage the
-- DB side of the two-phase online/card (Stripe Connect destination
-- charge) refund saga. NEITHER RPC calls Stripe. The server action
-- (Slice 8b.3) orchestrates:
--     begin_online_refund  -> Stripe refunds.create / lookup -> finalize_online_refund
--
-- Phase 1 (begin):    void voucher first, move purchase to refund_pending.
-- Phase 2 (finalize): mark refunded on Stripe success (store refund id),
--                     or refund_failed on Stripe failure. Never unvoids.
--
-- Re-entrancy: begin accepts payment_confirmed (initial), refund_failed
-- (retry), and refund_pending (resume after a crash before finalize).
--
-- Out of scope (deferred): Stripe API calls, webhooks, ledger entries,
-- payouts, delivery, email, application-fee refunds, and external Stripe
-- Dashboard refund reconciliation.
-- ============================================================

-- ============================================================
-- 1. public.begin_online_refund(UUID, TEXT)
--    Prepare DB for a Stripe online refund: void voucher + set
--    purchase to refund_pending. Re-entrant for retry/recovery.
-- ============================================================
CREATE OR REPLACE FUNCTION public.begin_online_refund(
    p_purchase_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id            UUID := auth.uid();
    v_merchant_id        UUID;
    v_reason             TEXT;
    v_purchase           RECORD;
    v_voucher            RECORD;
    v_updated_purchase_id UUID;
    v_updated_voucher_id  UUID;
    v_refund_state       TEXT;
    v_payload            JSONB;
BEGIN
    -- 1. Auth check
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;

    -- 2. Resolve merchant from authenticated session; never trust client merchant_id
    SELECT id
    INTO v_merchant_id
    FROM merchants
    WHERE auth_user_id = v_user_id
    LIMIT 1;

    IF v_merchant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;

    -- 3. Validate reason (required, trimmed, capped at 500 chars)
    v_reason := NULLIF(left(trim(coalesce(p_reason, '')), 500), '');

    IF v_reason IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_reason');
    END IF;

    -- 4. Load purchase in merchant scope
    SELECT id,
           status,
           payment_source,
           payment_method,
           reference_code,
           amount_cents,
           stripe_payment_intent_id,
           stripe_refund_id
    INTO v_purchase
    FROM purchases
    WHERE id = p_purchase_id
      AND merchant_id = v_merchant_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_found');
    END IF;

    -- 5. Online/card only; offline refunds belong to refund_offline_purchase
    IF v_purchase.payment_source <> 'ONLINE' OR v_purchase.payment_method <> 'card' THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_payment_source');
    END IF;

    -- 6. A PaymentIntent id is required to drive the Stripe refund later
    IF v_purchase.stripe_payment_intent_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'missing_payment_intent');
    END IF;

    -- 7. Only refundable / recoverable states are accepted
    IF v_purchase.status NOT IN ('payment_confirmed', 'refund_failed', 'refund_pending') THEN
        IF v_purchase.status IN ('refunded', 'cancelled', 'partially_refunded') THEN
            RETURN jsonb_build_object('success', false, 'error', 'already_processed');
        END IF;
        RETURN jsonb_build_object('success', false, 'error', 'not_refundable');
    END IF;

    -- 8. Load and lock voucher in merchant scope
    SELECT id,
           code,
           status,
           balance_cents,
           original_amount_cents
    INTO v_voucher
    FROM vouchers
    WHERE purchase_id = p_purchase_id
      AND merchant_id = v_merchant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_refundable');
    END IF;

    -- 9. Primary gate: reject if ANY redemption exists (checked after lock)
    IF EXISTS (
        SELECT 1
        FROM redemptions
        WHERE voucher_id = v_voucher.id
          AND merchant_id = v_merchant_id
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'has_redemptions');
    END IF;

    -- 10. Defense-in-depth: balance must equal original amount in every
    --     accepted state. Voiding a voucher does not change balance_cents,
    --     so this invariant must still hold on retry/resume.
    IF v_voucher.balance_cents <> v_voucher.original_amount_cents THEN
        RETURN jsonb_build_object('success', false, 'error', 'state_invalid');
    END IF;

    -- Shared audit payload (built once; reused by inserts below)
    v_payload := jsonb_build_object(
        'purchase_id', p_purchase_id,
        'voucher_id', v_voucher.id,
        'voucher_code', v_voucher.code,
        'reference_code', v_purchase.reference_code,
        'amount_cents', v_purchase.amount_cents,
        'reason', v_reason,
        'refund_type', 'online_stripe',
        'stripe_payment_intent_id', v_purchase.stripe_payment_intent_id
    );

    -- State-specific behavior
    IF v_purchase.status = 'payment_confirmed' THEN
        -- A. Initial attempt: voucher must be un-redeemed and refundable
        IF v_voucher.status NOT IN ('issued', 'delivered') THEN
            RETURN jsonb_build_object('success', false, 'error', 'not_refundable');
        END IF;

        -- Void voucher first (guarded transition)
        UPDATE vouchers
        SET status = 'voided'
        WHERE id = v_voucher.id
          AND merchant_id = v_merchant_id
          AND status IN ('issued', 'delivered')
        RETURNING id INTO v_updated_voucher_id;

        IF v_updated_voucher_id IS NULL THEN
            RAISE EXCEPTION 'begin_online_refund: voucher void transition lost for %', v_voucher.id;
        END IF;

        -- Move purchase to refund_pending (guarded transition)
        UPDATE purchases
        SET status = 'refund_pending'
        WHERE id = p_purchase_id
          AND merchant_id = v_merchant_id
          AND status = 'payment_confirmed'
        RETURNING id INTO v_updated_purchase_id;

        IF v_updated_purchase_id IS NULL THEN
            RAISE EXCEPTION 'begin_online_refund: purchase transition lost for %', p_purchase_id;
        END IF;

        -- Audit: refund initiated + voucher newly voided
        INSERT INTO audit_events (
            merchant_id, event_type, actor_type, actor_id, entity_type, entity_id, payload
        )
        VALUES (
            v_merchant_id, 'refund_initiated', 'merchant', v_user_id::TEXT,
            'purchase', p_purchase_id, v_payload
        );

        INSERT INTO audit_events (
            merchant_id, event_type, actor_type, actor_id, entity_type, entity_id, payload
        )
        VALUES (
            v_merchant_id, 'voucher_voided', 'merchant', v_user_id::TEXT,
            'voucher', v_voucher.id, v_payload
        );

        v_refund_state := 'refund_pending';

    ELSIF v_purchase.status = 'refund_failed' THEN
        -- B. Retry after a prior Stripe failure: voucher already voided
        IF v_voucher.status <> 'voided' THEN
            RETURN jsonb_build_object('success', false, 'error', 'state_invalid');
        END IF;

        UPDATE purchases
        SET status = 'refund_pending'
        WHERE id = p_purchase_id
          AND merchant_id = v_merchant_id
          AND status = 'refund_failed'
        RETURNING id INTO v_updated_purchase_id;

        IF v_updated_purchase_id IS NULL THEN
            RAISE EXCEPTION 'begin_online_refund: retry transition lost for %', p_purchase_id;
        END IF;

        -- Audit: refund re-initiated. Do NOT re-emit voucher_voided.
        INSERT INTO audit_events (
            merchant_id, event_type, actor_type, actor_id, entity_type, entity_id, payload
        )
        VALUES (
            v_merchant_id, 'refund_initiated', 'merchant', v_user_id::TEXT,
            'purchase', p_purchase_id, v_payload
        );

        v_refund_state := 'refund_pending';

    ELSE
        -- C. Resume after crash before finalize (status = refund_pending)
        IF v_voucher.status <> 'voided' THEN
            RETURN jsonb_build_object('success', false, 'error', 'state_invalid');
        END IF;

        -- No purchase update, no refund_initiated, no voucher_voided.
        v_refund_state := 'refund_pending';
    END IF;

    -- Success: return the data the server action needs to drive Stripe
    RETURN jsonb_build_object(
        'success', true,
        'purchase_id', p_purchase_id,
        'stripe_payment_intent_id', v_purchase.stripe_payment_intent_id,
        'stripe_refund_id', v_purchase.stripe_refund_id,
        'amount_cents', v_purchase.amount_cents,
        'reference_code', v_purchase.reference_code,
        'refund_type', 'online_stripe',
        'refund_state', v_refund_state
    );
END;
$$;

REVOKE ALL ON FUNCTION public.begin_online_refund(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.begin_online_refund(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.begin_online_refund(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.begin_online_refund(UUID, TEXT)
IS 'Phase 1 of the online/card Stripe refund saga. Voids the un-redeemed voucher and moves the purchase to refund_pending. Re-entrant for retry (refund_failed) and resume (refund_pending). Does NOT call Stripe. Returns the PaymentIntent id and any stored refund id for the server action to drive Stripe.';

-- ============================================================
-- 2. public.finalize_online_refund(UUID, BOOLEAN, TEXT, TEXT)
--    Finalize DB state after the server action completes or fails
--    the Stripe refund. Never calls Stripe. Never unvoids the voucher.
-- ============================================================
CREATE OR REPLACE FUNCTION public.finalize_online_refund(
    p_purchase_id UUID,
    p_succeeded BOOLEAN,
    p_stripe_refund_id TEXT DEFAULT NULL,
    p_failure_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id            UUID := auth.uid();
    v_merchant_id        UUID;
    v_purchase           RECORD;
    v_voucher            RECORD;
    v_refund_id          TEXT;
    v_failure_code       TEXT;
    v_updated_purchase_id UUID;
    v_payload            JSONB;
BEGIN
    -- 1. Auth check
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;

    -- 2. Resolve merchant from authenticated session; never trust client merchant_id
    SELECT id
    INTO v_merchant_id
    FROM merchants
    WHERE auth_user_id = v_user_id
    LIMIT 1;

    IF v_merchant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;

    -- 3. Load purchase in merchant scope
    SELECT id,
           status,
           payment_source,
           payment_method,
           reference_code,
           amount_cents,
           stripe_payment_intent_id,
           stripe_refund_id
    INTO v_purchase
    FROM purchases
    WHERE id = p_purchase_id
      AND merchant_id = v_merchant_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_found');
    END IF;

    -- 4. Online/card only
    IF v_purchase.payment_source <> 'ONLINE' OR v_purchase.payment_method <> 'card' THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_payment_source');
    END IF;

    -- 5. Load voucher for merchant scope (used for audit payload)
    SELECT id,
           code,
           status,
           balance_cents,
           original_amount_cents
    INTO v_voucher
    FROM vouchers
    WHERE purchase_id = p_purchase_id
      AND merchant_id = v_merchant_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_refundable');
    END IF;

    -- 6. Idempotent success: already refunded with the same refund id
    IF v_purchase.status = 'refunded' AND p_succeeded IS TRUE THEN
        IF v_purchase.stripe_refund_id IS NOT NULL
           AND v_purchase.stripe_refund_id = NULLIF(trim(coalesce(p_stripe_refund_id, '')), '') THEN
            RETURN jsonb_build_object(
                'success', true,
                'already_finalized', true,
                'stripe_refund_id', v_purchase.stripe_refund_id
            );
        END IF;
        RETURN jsonb_build_object('success', false, 'error', 'already_processed');
    END IF;

    -- 7. Normal finalization requires refund_pending
    IF v_purchase.status <> 'refund_pending' THEN
        IF v_purchase.status IN ('cancelled', 'partially_refunded', 'refunded') THEN
            RETURN jsonb_build_object('success', false, 'error', 'already_processed');
        END IF;
        RETURN jsonb_build_object('success', false, 'error', 'not_refundable');
    END IF;

    -- Shared audit payload base
    v_payload := jsonb_build_object(
        'purchase_id', p_purchase_id,
        'voucher_id', v_voucher.id,
        'voucher_code', v_voucher.code,
        'reference_code', v_purchase.reference_code,
        'amount_cents', v_purchase.amount_cents,
        'refund_type', 'online_stripe',
        'stripe_payment_intent_id', v_purchase.stripe_payment_intent_id
    );

    IF p_succeeded IS TRUE THEN
        -- Success path: a non-empty Stripe refund id is mandatory
        v_refund_id := NULLIF(trim(coalesce(p_stripe_refund_id, '')), '');

        IF v_refund_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'invalid_refund_id');
        END IF;

        UPDATE purchases
        SET status = 'refunded',
            refunded_at = now(),
            stripe_refund_id = v_refund_id
        WHERE id = p_purchase_id
          AND merchant_id = v_merchant_id
          AND status = 'refund_pending'
        RETURNING id INTO v_updated_purchase_id;

        IF v_updated_purchase_id IS NULL THEN
            RAISE EXCEPTION 'finalize_online_refund: success transition lost for %', p_purchase_id;
        END IF;

        INSERT INTO audit_events (
            merchant_id, event_type, actor_type, actor_id, entity_type, entity_id, payload
        )
        VALUES (
            v_merchant_id, 'purchase_refunded', 'merchant', v_user_id::TEXT,
            'purchase', p_purchase_id,
            v_payload || jsonb_build_object('stripe_refund_id', v_refund_id)
        );

        RETURN jsonb_build_object(
            'success', true,
            'stripe_refund_id', v_refund_id
        );
    END IF;

    -- Failure path: safe, capped failure code with fallback
    v_failure_code := coalesce(
        NULLIF(left(trim(coalesce(p_failure_code, '')), 120), ''),
        'stripe_refund_failed'
    );

    UPDATE purchases
    SET status = 'refund_failed'
    WHERE id = p_purchase_id
      AND merchant_id = v_merchant_id
      AND status = 'refund_pending'
    RETURNING id INTO v_updated_purchase_id;

    IF v_updated_purchase_id IS NULL THEN
        RAISE EXCEPTION 'finalize_online_refund: failure transition lost for %', p_purchase_id;
    END IF;

    -- Never unvoid the voucher: it stays voided so it cannot be redeemed.
    INSERT INTO audit_events (
        merchant_id, event_type, actor_type, actor_id, entity_type, entity_id, payload
    )
    VALUES (
        v_merchant_id, 'refund_failed', 'merchant', v_user_id::TEXT,
        'purchase', p_purchase_id,
        v_payload || jsonb_build_object('failure_code', v_failure_code)
    );

    RETURN jsonb_build_object(
        'success', false,
        'error', 'refund_failed',
        'failure_code', v_failure_code
    );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_online_refund(UUID, BOOLEAN, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_online_refund(UUID, BOOLEAN, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.finalize_online_refund(UUID, BOOLEAN, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.finalize_online_refund(UUID, BOOLEAN, TEXT, TEXT)
IS 'Phase 2 of the online/card Stripe refund saga. On Stripe success: sets purchase refunded and stores stripe_refund_id. On Stripe failure: sets refund_failed (voucher stays voided for retry). Idempotent for an already-finalized matching refund id. Does NOT call Stripe and never unvoids the voucher.';
