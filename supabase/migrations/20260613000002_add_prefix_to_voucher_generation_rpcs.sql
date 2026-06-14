-- Migration: add voucher_code_prefix support to both voucher generation RPCs.
--
-- Slice 3 of the custom voucher code prefix sprint.
--
-- Changes (both RPCs):
--   1. Declare v_prefix TEXT.
--   2. SELECT voucher_code_prefix alongside valid_days from gift_cards.
--   3. Compute effective prefix: COALESCE(v_gift_card.voucher_code_prefix, 'PU').
--   4. Replace hardcoded 'PU-' prefix with v_prefix || '-' in voucher code
--      generation. Entropy, retry count, and collision behavior are unchanged.
--
-- No other logic is altered. Function bodies are based strictly on the
-- pinned newest sources:
--   Manual RPC: 20260612110000_harden_manual_voucher_generation_exhaustion.sql
--   Stripe RPC: 20260610124500_harden_stripe_webhook_rpc_transaction.sql

-- ============================================================
-- 1. Manual confirm RPC (OFFLINE payments, merchant-triggered)
-- ============================================================

CREATE OR REPLACE FUNCTION public.confirm_purchase_and_issue_voucher(
    p_purchase_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id         UUID := auth.uid();
    v_merchant_id     UUID;
    v_purchase        RECORD;
    v_gift_card       RECORD;
    v_existing_code   TEXT;
    v_prefix          TEXT;
    v_hex             TEXT;
    v_voucher_code    TEXT;
    v_voucher_id      UUID;
    v_expires_at      TIMESTAMPTZ;
    v_updated_id      UUID;
    v_attempts        INTEGER := 0;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;

    SELECT id
    INTO v_merchant_id
    FROM merchants
    WHERE auth_user_id = v_user_id
    LIMIT 1;

    IF v_merchant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;

    SELECT id,
           status,
           expires_at,
           reference_code,
           amount_cents,
           gift_card_id,
           payment_source,
           payment_method
    INTO v_purchase
    FROM purchases
    WHERE id = p_purchase_id
      AND merchant_id = v_merchant_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_found');
    END IF;

    IF v_purchase.payment_source <> 'OFFLINE' THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_payment_source');
    END IF;

    SELECT code
    INTO v_existing_code
    FROM vouchers
    WHERE purchase_id = p_purchase_id
      AND merchant_id = v_merchant_id;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'voucher_code', v_existing_code,
            'already_issued', true
        );
    END IF;

    IF v_purchase.status <> 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error', 'already_processed');
    END IF;

    IF v_purchase.expires_at IS NOT NULL AND v_purchase.expires_at < now() THEN
        RETURN jsonb_build_object('success', false, 'error', 'expired');
    END IF;

    SELECT valid_days, voucher_code_prefix
    INTO v_gift_card
    FROM gift_cards
    WHERE id = v_purchase.gift_card_id
      AND merchant_id = v_merchant_id;

    v_expires_at := now() + (coalesce(v_gift_card.valid_days, 365) || ' days')::INTERVAL;
    v_prefix := COALESCE(v_gift_card.voucher_code_prefix, 'PU');

    UPDATE purchases
    SET
        status = 'payment_confirmed',
        confirmed_at = now()
    WHERE id = p_purchase_id
      AND merchant_id = v_merchant_id
      AND status = 'pending'
    RETURNING id INTO v_updated_id;

    IF v_updated_id IS NULL THEN
        SELECT code
        INTO v_existing_code
        FROM vouchers
        WHERE purchase_id = p_purchase_id
          AND merchant_id = v_merchant_id;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'voucher_code', v_existing_code,
                'already_issued', true
            );
        END IF;

        RETURN jsonb_build_object('success', false, 'error', 'already_processed');
    END IF;

    LOOP
        v_attempts := v_attempts + 1;

        v_hex := upper(encode(extensions.gen_random_bytes(6), 'hex'));
        v_voucher_code := v_prefix || '-'
            || substr(v_hex, 1, 4) || '-'
            || substr(v_hex, 5, 4) || '-'
            || substr(v_hex, 9, 4);

        INSERT INTO vouchers (
            purchase_id,
            merchant_id,
            code,
            qr_data,
            original_amount_cents,
            balance_cents,
            status,
            expires_at
        )
        VALUES (
            p_purchase_id,
            v_merchant_id,
            v_voucher_code,
            v_voucher_code,
            v_purchase.amount_cents,
            v_purchase.amount_cents,
            'issued',
            v_expires_at
        )
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_voucher_id;

        EXIT WHEN v_voucher_id IS NOT NULL;

        IF v_attempts >= 5 THEN
            RAISE EXCEPTION 'voucher_code_generation_failed';
        END IF;
    END LOOP;

    INSERT INTO audit_events (
        merchant_id,
        event_type,
        actor_type,
        actor_id,
        entity_type,
        entity_id,
        payload
    )
    VALUES (
        v_merchant_id,
        'purchase_confirmed',
        'merchant',
        v_user_id::TEXT,
        'purchase',
        p_purchase_id,
        jsonb_build_object('reference_code', v_purchase.reference_code)
    );

    INSERT INTO audit_events (
        merchant_id,
        event_type,
        actor_type,
        actor_id,
        entity_type,
        entity_id,
        payload
    )
    VALUES (
        v_merchant_id,
        'voucher_issued',
        'merchant',
        v_user_id::TEXT,
        'voucher',
        v_voucher_id,
        jsonb_build_object(
            'purchase_id', p_purchase_id,
            'reference_code', v_purchase.reference_code,
            'voucher_code', v_voucher_code,
            'amount_cents', v_purchase.amount_cents
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'voucher_code', v_voucher_code,
        'already_issued', false
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'unknown');
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_purchase_and_issue_voucher(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_purchase_and_issue_voucher(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.confirm_purchase_and_issue_voucher(UUID) TO authenticated;

-- ============================================================
-- 2. Stripe confirm RPC (ONLINE/card payments, webhook-triggered)
-- ============================================================

CREATE OR REPLACE FUNCTION public.confirm_stripe_purchase_and_issue_voucher(
    p_event_id                  TEXT,
    p_event_type                TEXT,
    p_purchase_id               UUID,
    p_stripe_payment_intent_id  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_merchant_id   UUID;
    v_purchase      RECORD;
    v_gift_card     RECORD;
    v_existing_code TEXT;
    v_prefix        TEXT;
    v_hex           TEXT;
    v_voucher_code  TEXT;
    v_voucher_id    UUID;
    v_expires_at    TIMESTAMPTZ;
    v_updated_id    UUID;
    v_attempts      INTEGER := 0;
BEGIN
    -- 1. Validate required inputs.
    --    These checks happen before any DML; safe to RETURN early.
    IF p_event_id IS NULL OR p_event_id = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
    END IF;

    IF p_event_type <> 'checkout.session.completed' THEN
        RETURN jsonb_build_object('success', false, 'error', 'unsupported_event_type');
    END IF;

    IF p_purchase_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
    END IF;

    -- 2. Idempotency: insert into processed_webhooks atomically.
    --    ON CONFLICT DO NOTHING + NOT FOUND check is the dedup guard.
    --
    --    IMPORTANT: all DML after this point is in the same transaction.
    --    Permanent failures below use RETURN (commits this row; Stripe stops
    --    retrying — correct, since retry cannot fix a permanent problem).
    --    Transient failures use RAISE EXCEPTION (rolls back this row; Stripe
    --    retries — correct, since retry may succeed).
    INSERT INTO processed_webhooks (event_id, provider, event_type)
    VALUES (p_event_id, 'stripe', p_event_type)
    ON CONFLICT (event_id) DO NOTHING;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success',           true,
            'already_processed', true
        );
    END IF;

    -- 3. Load purchase. Derive merchant_id from the row — never trust the caller.
    SELECT id,
           status,
           expires_at,
           reference_code,
           amount_cents,
           gift_card_id,
           merchant_id,
           payment_source,
           payment_method
    INTO v_purchase
    FROM purchases
    WHERE id = p_purchase_id;

    IF NOT FOUND THEN
        -- Permanent: purchase does not exist. Stripe retrying will not create it.
        -- Commit processed_webhooks to suppress further retries.
        RETURN jsonb_build_object('success', false, 'error', 'not_found');
    END IF;

    v_merchant_id := v_purchase.merchant_id;

    -- 4. Validate this is an ONLINE card purchase.
    --    Stripe webhooks must never confirm OFFLINE or non-card transactions.
    IF v_purchase.payment_source <> 'ONLINE' OR v_purchase.payment_method <> 'card' THEN
        -- Permanent: wrong payment type. Commit processed_webhooks.
        RETURN jsonb_build_object('success', false, 'error', 'invalid_payment_source');
    END IF;

    -- 5. Idempotency: return existing voucher if one was already issued.
    SELECT code
    INTO v_existing_code
    FROM vouchers
    WHERE purchase_id = p_purchase_id
      AND merchant_id = v_merchant_id;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success',           true,
            'voucher_code',      v_existing_code,
            'already_issued',    true,
            'already_processed', false
        );
    END IF;

    -- 6. Validate purchase is still pending and not expired.
    IF v_purchase.status <> 'pending' THEN
        -- Permanent: purchase already confirmed or cancelled. Commit processed_webhooks.
        RETURN jsonb_build_object('success', false, 'error', 'already_processed');
    END IF;

    IF v_purchase.expires_at IS NOT NULL AND v_purchase.expires_at < now() THEN
        -- Permanent: purchase window has passed. Commit processed_webhooks.
        RETURN jsonb_build_object('success', false, 'error', 'expired');
    END IF;

    -- 7. Resolve voucher expiry from gift card valid_days and read prefix.
    SELECT valid_days, voucher_code_prefix
    INTO v_gift_card
    FROM gift_cards
    WHERE id          = v_purchase.gift_card_id
      AND merchant_id = v_merchant_id;

    IF NOT FOUND THEN
        -- Permanent data integrity failure: gift card was deleted after purchase was
        -- created. Retrying cannot fix this. Commit processed_webhooks.
        RETURN jsonb_build_object('success', false, 'error', 'not_found');
    END IF;

    v_expires_at := now() + (coalesce(v_gift_card.valid_days, 365) || ' days')::INTERVAL;
    v_prefix := COALESCE(v_gift_card.voucher_code_prefix, 'PU');

    -- 8. Confirm purchase atomically (compare-and-swap on status = 'pending').
    UPDATE purchases
    SET
        status                   = 'payment_confirmed',
        confirmed_at             = now(),
        stripe_payment_intent_id = coalesce(p_stripe_payment_intent_id, stripe_payment_intent_id)
    WHERE id          = p_purchase_id
      AND merchant_id = v_merchant_id
      AND status      = 'pending'
    RETURNING id INTO v_updated_id;

    IF v_updated_id IS NULL THEN
        -- Concurrent call won the CAS. Return the existing voucher if already issued.
        SELECT code
        INTO v_existing_code
        FROM vouchers
        WHERE purchase_id = p_purchase_id
          AND merchant_id = v_merchant_id;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success',           true,
                'voucher_code',      v_existing_code,
                'already_issued',    true,
                'already_processed', false
            );
        END IF;

        RETURN jsonb_build_object('success', false, 'error', 'already_processed');
    END IF;

    -- 9. Generate and insert voucher. Retry up to 5 times on rare code collision.
    --
    --    On exhaustion: RAISE EXCEPTION instead of RETURN.
    --    RAISE rolls back the entire transaction (purchase UPDATE, processed_webhooks
    --    insert, everything), so Stripe retries can attempt the full flow again.
    LOOP
        v_attempts := v_attempts + 1;

        v_hex := upper(encode(extensions.gen_random_bytes(6), 'hex'));
        v_voucher_code := v_prefix || '-'
            || substr(v_hex, 1, 4) || '-'
            || substr(v_hex, 5, 4) || '-'
            || substr(v_hex, 9, 4);

        INSERT INTO vouchers (
            purchase_id,
            merchant_id,
            code,
            qr_data,
            original_amount_cents,
            balance_cents,
            status,
            expires_at
        )
        VALUES (
            p_purchase_id,
            v_merchant_id,
            v_voucher_code,
            v_voucher_code,
            v_purchase.amount_cents,
            v_purchase.amount_cents,
            'issued',
            v_expires_at
        )
        ON CONFLICT DO NOTHING
        RETURNING id INTO v_voucher_id;

        EXIT WHEN v_voucher_id IS NOT NULL;

        IF v_attempts >= 5 THEN
            RAISE EXCEPTION 'voucher_code_generation_failed';
        END IF;
    END LOOP;

    -- 10. Audit: purchase confirmed via Stripe webhook.
    INSERT INTO audit_events (
        merchant_id,
        event_type,
        actor_type,
        actor_id,
        entity_type,
        entity_id,
        payload
    )
    VALUES (
        v_merchant_id,
        'purchase_confirmed',
        'system',
        'stripe_webhook',
        'purchase',
        p_purchase_id,
        jsonb_build_object(
            'reference_code', v_purchase.reference_code,
            'event_type',     p_event_type
        )
    );

    -- 11. Audit: voucher issued via Stripe webhook.
    INSERT INTO audit_events (
        merchant_id,
        event_type,
        actor_type,
        actor_id,
        entity_type,
        entity_id,
        payload
    )
    VALUES (
        v_merchant_id,
        'voucher_issued',
        'system',
        'stripe_webhook',
        'voucher',
        v_voucher_id,
        jsonb_build_object(
            'purchase_id',    p_purchase_id,
            'reference_code', v_purchase.reference_code,
            'amount_cents',   v_purchase.amount_cents
        )
    );

    RETURN jsonb_build_object(
        'success',           true,
        'voucher_code',      v_voucher_code,
        'already_issued',    false,
        'already_processed', false
    );

-- No EXCEPTION WHEN OTHERS block.
-- Any unexpected DB error (constraint violation, connection failure, lock timeout,
-- etc.) propagates naturally. PostgreSQL rolls back the entire transaction,
-- including the processed_webhooks insert. The supabaseAdminClient RPC call
-- returns a non-null error object, the route handler returns HTTP 500, and
-- Stripe retries the event.
END;
$$;

-- Re-apply permissions explicitly.
-- CREATE OR REPLACE preserves existing grants in PostgreSQL, but these are
-- restated here for clarity and to guard against future re-creation.
REVOKE ALL ON FUNCTION public.confirm_stripe_purchase_and_issue_voucher(TEXT, TEXT, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_stripe_purchase_and_issue_voucher(TEXT, TEXT, UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.confirm_stripe_purchase_and_issue_voucher(TEXT, TEXT, UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_stripe_purchase_and_issue_voucher(TEXT, TEXT, UUID, TEXT) TO service_role;
