-- ============================================================
-- Migration: redeem_voucher_partial RPC (merchant dashboard session)
-- ParaUsted - Digital Gift Card SaaS
--
-- Adds a partial-amount counterpart to redeem_voucher_full for the
-- authenticated merchant dashboard, so an operator (e.g. Carlos of Seville
-- Tours Co.) can redeem part of a voucher's balance against a booking worth
-- less than a flexible or luxury gift card, leaving the remainder spendable.
--
-- Security model matches redeem_voucher_full:
--   - SECURITY DEFINER; merchant_id is resolved from auth.uid(), never trusted
--     from the client.
--   - Atomic FOR UPDATE + compare-and-set on balance_cents.
--   - Append-only redemptions and audit_events writes.
--   - Same state gates and custom-prefix-aware code format.
--   - GRANT authenticated; REVOKE anon/public.
-- ============================================================

CREATE OR REPLACE FUNCTION public.redeem_voucher_partial(
    p_voucher_code TEXT,
    p_amount_cents INTEGER,
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
    v_balance_after   INTEGER;
    v_new_status      TEXT;
    v_redemption_id   UUID;
    v_updated_id      UUID;
    v_notes           TEXT;
BEGIN
    -- 1. Auth check.
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;

    -- 2. Resolve merchant from authenticated session; never trust from client.
    SELECT id
    INTO v_merchant_id
    FROM merchants
    WHERE auth_user_id = v_user_id
    LIMIT 1;

    IF v_merchant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;

    -- 3. Reject a non-positive amount before any lookup.
    IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_amount');
    END IF;

    -- 4. Normalise and validate voucher code format (custom-prefix aware).
    v_code := upper(trim(coalesce(p_voucher_code, '')));

    IF v_code !~ '^[A-Z0-9]+(-[A-Z0-9]+)*-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
    END IF;

    -- 5. Load and lock the voucher in merchant scope.
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

    -- 6. Terminal / non-redeemable states.
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

    -- 7. Amount must not exceed the remaining balance.
    v_balance_before := v_voucher.balance_cents;

    IF p_amount_cents > v_balance_before THEN
        RETURN jsonb_build_object('success', false, 'error', 'amount_exceeds_balance');
    END IF;

    v_balance_after := v_balance_before - p_amount_cents;
    v_new_status := CASE WHEN v_balance_after > 0 THEN 'partially_redeemed' ELSE 'redeemed' END;
    v_notes := NULLIF(left(trim(coalesce(p_notes, '')), 500), '');

    -- 8. Compare-and-set update; the exception block rolls back on later failure.
    UPDATE vouchers
    SET
        balance_cents = v_balance_after,
        status = v_new_status
    WHERE id = v_voucher.id
      AND merchant_id = v_merchant_id
      AND balance_cents = v_balance_before
      AND status IN ('issued', 'delivered', 'partially_redeemed')
    RETURNING id INTO v_updated_id;

    IF v_updated_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'already_processed');
    END IF;

    -- 9. Append redemption record.
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
        p_amount_cents,
        v_balance_before,
        v_balance_after,
        v_user_id,
        v_notes
    )
    RETURNING id INTO v_redemption_id;

    -- 10. Audit the redemption event.
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
            'amount_cents', p_amount_cents,
            'balance_before', v_balance_before,
            'balance_after', v_balance_after
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'redemption_id', v_redemption_id,
        'voucher_code', v_voucher.code,
        'amount_cents', p_amount_cents,
        'balance_before', v_balance_before,
        'balance_after', v_balance_after,
        'status', v_new_status
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'unknown');
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_voucher_partial(TEXT, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_voucher_partial(TEXT, INTEGER, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.redeem_voucher_partial(TEXT, INTEGER, TEXT) TO authenticated;

COMMENT ON FUNCTION public.redeem_voucher_partial(TEXT, INTEGER, TEXT)
IS 'Authenticated merchant-dashboard partial-balance voucher redemption. Merchant id is resolved from auth.uid(); never trusted from the client. Atomic, append-only, and sets status to partially_redeemed when a remainder is left, otherwise redeemed.';
