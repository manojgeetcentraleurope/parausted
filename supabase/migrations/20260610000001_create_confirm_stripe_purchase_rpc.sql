-- ============================================================
-- Migration: confirm_stripe_purchase_and_issue_voucher RPC
-- Webhook-safe variant of confirm_purchase_and_issue_voucher.
-- Key differences from the merchant RPC:
--   1. Does NOT use auth.uid() — safe for service_role callers.
--   2. Accepts p_event_id for idempotency via processed_webhooks.
--   3. Derives merchant_id from the purchase row, never from the caller.
--   4. GRANT EXECUTE to service_role only.
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
    v_hex           TEXT;
    v_voucher_code  TEXT;
    v_voucher_id    UUID;
    v_expires_at    TIMESTAMPTZ;
    v_updated_id    UUID;
    v_attempts      INTEGER := 0;
BEGIN
    -- 1. Validate required inputs
    IF p_event_id IS NULL OR p_event_id = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
    END IF;

    IF p_event_type <> 'checkout.session.completed' THEN
        RETURN jsonb_build_object('success', false, 'error', 'unsupported_event_type');
    END IF;

    IF p_purchase_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
    END IF;

    -- 2. Idempotency: record this event as processed.
    --    If event_id already exists (ON CONFLICT), FOUND = false → already processed.
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
        RETURN jsonb_build_object('success', false, 'error', 'not_found');
    END IF;

    v_merchant_id := v_purchase.merchant_id;

    -- 4. Validate this is an ONLINE card purchase.
    --    Stripe webhooks must never confirm OFFLINE or non-card transactions.
    IF v_purchase.payment_source <> 'ONLINE' OR v_purchase.payment_method <> 'card' THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_payment_source');
    END IF;

    -- 5. Idempotency: if a voucher already exists for this purchase, return it.
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
        RETURN jsonb_build_object('success', false, 'error', 'already_processed');
    END IF;

    IF v_purchase.expires_at IS NOT NULL AND v_purchase.expires_at < now() THEN
        RETURN jsonb_build_object('success', false, 'error', 'expired');
    END IF;

    -- 7. Resolve voucher expiry from gift card valid_days.
    SELECT valid_days
    INTO v_gift_card
    FROM gift_cards
    WHERE id          = v_purchase.gift_card_id
      AND merchant_id = v_merchant_id;

    v_expires_at := now() + (coalesce(v_gift_card.valid_days, 365) || ' days')::INTERVAL;

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
        -- Concurrent call may have won the CAS. Return existing voucher if present.
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
    LOOP
        v_attempts := v_attempts + 1;

        v_hex := upper(encode(extensions.gen_random_bytes(6), 'hex'));
        v_voucher_code := 'PU-'
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
            RETURN jsonb_build_object('success', false, 'error', 'unknown');
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

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'unknown');
END;
$$;

-- Restrict access: only service_role (trusted backend admin client) may execute this function.
-- Public, anon, and authenticated roles must never call webhook handlers directly.
REVOKE ALL ON FUNCTION public.confirm_stripe_purchase_and_issue_voucher(TEXT, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_stripe_purchase_and_issue_voucher(TEXT, TEXT, UUID, TEXT) TO service_role;
