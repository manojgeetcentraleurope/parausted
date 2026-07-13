-- ============================================================
-- Migration: add idempotency key to merchant partial redemption
-- ParaUsted - Digital Gift Card SaaS
--
-- Closes residual risk R1: a genuine double-submit of a dashboard PARTIAL
-- redemption (network retry, duplicate POST) could create two legitimate
-- redemptions. Adding a client-supplied idempotency key makes retries safe:
-- same merchant + key + voucher replays the prior result; same key + a
-- different voucher is a conflict.
--
-- Full-balance redemption (redeem_voucher_full) is intentionally left
-- unchanged: a repeated full redeem already fails safely with
-- already_redeemed and never double-spends.
--
-- The 3-argument redeem_voucher_partial from migration 20260713000005 is
-- dropped and replaced by a 4-argument version so the RPC signature stays
-- unambiguous for name-based calls.
-- ============================================================

DROP FUNCTION IF EXISTS public.redeem_voucher_partial(TEXT, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION public.redeem_voucher_partial(
    p_voucher_code    TEXT,
    p_amount_cents    INTEGER,
    p_notes           TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
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
    v_existing        RECORD;
    v_balance_before  INTEGER;
    v_balance_after   INTEGER;
    v_new_status      TEXT;
    v_redemption_id   UUID;
    v_updated_id      UUID;
    v_notes           TEXT;
    v_idem            TEXT;
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

    v_idem := NULLIF(left(trim(coalesce(p_idempotency_key, '')), 255), '');

    -- 5. Idempotency replay: same merchant + key + voucher replays the prior
    --    result; same merchant + key + different voucher is a conflict.
    IF v_idem IS NOT NULL THEN
        SELECT r.id, r.amount_cents, r.balance_before, r.balance_after, v.code
        INTO v_existing
        FROM redemptions r
        JOIN vouchers v ON v.id = r.voucher_id
        WHERE r.idempotency_key = v_idem
          AND r.merchant_id = v_merchant_id
        LIMIT 1;

        IF FOUND THEN
            IF v_existing.code = v_code THEN
                RETURN jsonb_build_object(
                    'success', true,
                    'redemption_id', v_existing.id,
                    'voucher_code', v_existing.code,
                    'amount_cents', v_existing.amount_cents,
                    'balance_before', v_existing.balance_before,
                    'balance_after', v_existing.balance_after,
                    'status', CASE WHEN v_existing.balance_after > 0 THEN 'partially_redeemed' ELSE 'redeemed' END,
                    'idempotent_replay', true
                );
            END IF;

            RETURN jsonb_build_object('success', false, 'error', 'idempotency_conflict');
        END IF;
    END IF;

    -- 6. Load and lock the voucher in merchant scope.
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

    -- 7. Terminal / non-redeemable states.
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

    -- 8. Amount must not exceed the remaining balance.
    v_balance_before := v_voucher.balance_cents;

    IF p_amount_cents > v_balance_before THEN
        RETURN jsonb_build_object('success', false, 'error', 'amount_exceeds_balance');
    END IF;

    v_balance_after := v_balance_before - p_amount_cents;
    v_new_status := CASE WHEN v_balance_after > 0 THEN 'partially_redeemed' ELSE 'redeemed' END;
    v_notes := NULLIF(left(trim(coalesce(p_notes, '')), 500), '');

    -- 9. Compare-and-set update; the exception block rolls back on later failure.
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

    -- 10. Append redemption record.
    INSERT INTO redemptions (
        voucher_id,
        merchant_id,
        amount_cents,
        balance_before,
        balance_after,
        redeemed_by,
        notes,
        idempotency_key
    )
    VALUES (
        v_voucher.id,
        v_merchant_id,
        p_amount_cents,
        v_balance_before,
        v_balance_after,
        v_user_id,
        v_notes,
        v_idem
    )
    RETURNING id INTO v_redemption_id;

    -- 11. Audit the redemption event.
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
    WHEN unique_violation THEN
        -- A concurrent request with the same idempotency key won the race.
        IF v_idem IS NOT NULL THEN
            SELECT r.id, r.amount_cents, r.balance_before, r.balance_after, v.code
            INTO v_existing
            FROM redemptions r
            JOIN vouchers v ON v.id = r.voucher_id
            WHERE r.idempotency_key = v_idem
              AND r.merchant_id = v_merchant_id
            LIMIT 1;

            IF FOUND THEN
                IF v_existing.code = v_code THEN
                    RETURN jsonb_build_object(
                        'success', true,
                        'redemption_id', v_existing.id,
                        'voucher_code', v_existing.code,
                        'amount_cents', v_existing.amount_cents,
                        'balance_before', v_existing.balance_before,
                        'balance_after', v_existing.balance_after,
                        'status', CASE WHEN v_existing.balance_after > 0 THEN 'partially_redeemed' ELSE 'redeemed' END,
                        'idempotent_replay', true
                    );
                END IF;

                RETURN jsonb_build_object('success', false, 'error', 'idempotency_conflict');
            END IF;
        END IF;

        RETURN jsonb_build_object('success', false, 'error', 'already_processed');
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'unknown');
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_voucher_partial(TEXT, INTEGER, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_voucher_partial(TEXT, INTEGER, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.redeem_voucher_partial(TEXT, INTEGER, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.redeem_voucher_partial(TEXT, INTEGER, TEXT, TEXT)
IS 'Authenticated merchant-dashboard partial-balance voucher redemption with idempotency. Merchant id is resolved from auth.uid(); never trusted from the client. Atomic, append-only, idempotent by (merchant_id, idempotency_key). Sets status to partially_redeemed when a remainder is left, otherwise redeemed.';
