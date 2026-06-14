-- Migration: accept custom voucher prefixes in public lookup and redemption RPCs.
--
-- Slice 4 of the custom voucher code prefix sprint.
-- Updates only the voucher-code format gates for:
--   - public.get_public_voucher_page(TEXT)
--   - public.redeem_voucher_full(TEXT, TEXT)
--
-- Keeps suffix validation strict at three 4-character hex groups.

CREATE OR REPLACE FUNCTION public.get_public_voucher_page(p_code TEXT)
RETURNS TABLE (
    code TEXT,
    original_amount_cents INTEGER,
    balance_cents INTEGER,
    status TEXT,
    expires_at TIMESTAMPTZ,
    recipient_name TEXT,
    sender_name TEXT,
    personal_message TEXT,
    merchant_name TEXT,
    delivery_channel TEXT,
    delivery_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_code TEXT;
BEGIN
    v_code := upper(trim(coalesce(p_code, '')));

    IF v_code !~ '^[A-Z0-9]+(-[A-Z0-9]+)*-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$' THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        v.code,
        v.original_amount_cents,
        v.balance_cents,
        v.status,
        v.expires_at,
        p.recipient_name,
        p.sender_name,
        p.personal_message,
        m.name AS merchant_name,
        de.channel AS delivery_channel,
        de.status AS delivery_status
    FROM public.vouchers v
    JOIN public.purchases p
      ON p.id = v.purchase_id
     AND p.merchant_id = v.merchant_id
    LEFT JOIN public.merchants m
      ON m.id = v.merchant_id
    LEFT JOIN LATERAL (
        SELECT
            d.channel,
            d.status
        FROM public.delivery_events d
        WHERE d.voucher_id = v.id
          AND d.merchant_id = v.merchant_id
        ORDER BY COALESCE(d.sent_at, d.failed_at, d.queued_at) DESC NULLS LAST,
                 d.queued_at DESC NULLS LAST
        LIMIT 1
    ) de ON TRUE
    WHERE v.code = v_code
    LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_voucher_page(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_voucher_page(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.get_public_voucher_page(TEXT) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.get_public_voucher_page(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_voucher_page(TEXT) TO authenticated;

COMMENT ON FUNCTION public.get_public_voucher_page(TEXT)
IS 'Returns safe public voucher page fields for a valid voucher code. Does not expose contact PII or payment internals.';

CREATE OR REPLACE FUNCTION public.redeem_voucher_full(
    p_voucher_code TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id         UUID := auth.uid();
    v_merchant_id     UUID;
    v_code            TEXT;
    v_voucher         RECORD;
    v_balance_before  INTEGER;
    v_redemption_id   UUID;
    v_updated_id      UUID;
    v_notes           TEXT;
BEGIN
    -- 1. Auth check
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;

    -- 2. Resolve merchant from authenticated session; never trust merchant_id from client
    SELECT id
    INTO v_merchant_id
    FROM merchants
    WHERE auth_user_id = v_user_id
    LIMIT 1;

    IF v_merchant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;

    -- 3. Normalise and validate voucher code format
    v_code := upper(trim(coalesce(p_voucher_code, '')));

    IF v_code !~ '^[A-Z0-9]+(-[A-Z0-9]+)*-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
    END IF;

    -- 4. Load and lock voucher in merchant scope
    SELECT
        id,
        code,
        status,
        balance_cents,
        original_amount_cents,
        expires_at
    INTO v_voucher
    FROM vouchers
    WHERE code = v_code
      AND merchant_id = v_merchant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_found');
    END IF;

    -- 5. Terminal/non-redeemable states
    IF v_voucher.status = 'redeemed' OR v_voucher.balance_cents <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'already_redeemed');
    END IF;

    IF v_voucher.status = 'expired' OR v_voucher.expires_at < now() THEN
        RETURN jsonb_build_object('success', false, 'error', 'expired');
    END IF;

    IF v_voucher.status = 'voided' THEN
        RETURN jsonb_build_object('success', false, 'error', 'voided');
    END IF;

    IF v_voucher.status = 'exchanged' THEN
        RETURN jsonb_build_object('success', false, 'error', 'exchanged');
    END IF;

    IF v_voucher.status NOT IN ('issued', 'delivered', 'partially_redeemed') THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_redeemable');
    END IF;

    -- 6. Full remaining-balance redemption
    v_balance_before := v_voucher.balance_cents;
    v_notes := NULLIF(left(trim(coalesce(p_notes, '')), 500), '');

    -- 7. Update voucher first. If insert/audit later fails, exception block rolls back the transaction.
    UPDATE vouchers
    SET
        balance_cents = 0,
        status = 'redeemed'
    WHERE id = v_voucher.id
      AND merchant_id = v_merchant_id
      AND balance_cents = v_balance_before
      AND status IN ('issued', 'delivered', 'partially_redeemed')
    RETURNING id INTO v_updated_id;

    IF v_updated_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'already_processed');
    END IF;

    -- 8. Append redemption record
    INSERT INTO redemptions (
        voucher_id,
        merchant_id,
        amount_cents,
        balance_before,
        balance_after,
        redeemed_by,
        notes
    )
    VALUES (
        v_voucher.id,
        v_merchant_id,
        v_balance_before,
        v_balance_before,
        0,
        v_user_id,
        v_notes
    )
    RETURNING id INTO v_redemption_id;

    -- 9. Audit redemption event
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
        'voucher_redeemed',
        'merchant',
        v_user_id::TEXT,
        'redemption',
        v_redemption_id,
        jsonb_build_object(
            'voucher_id', v_voucher.id,
            'voucher_code', v_voucher.code,
            'amount_cents', v_balance_before,
            'balance_before', v_balance_before,
            'balance_after', 0
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'redemption_id', v_redemption_id,
        'voucher_code', v_voucher.code,
        'amount_cents', v_balance_before,
        'balance_before', v_balance_before,
        'balance_after', 0,
        'status', 'redeemed'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'unknown');
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_voucher_full(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_voucher_full(TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.redeem_voucher_full(TEXT, TEXT) TO authenticated;
