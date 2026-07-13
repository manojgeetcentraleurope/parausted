-- ============================================================
-- Migration: redeem_voucher_partial_for_merchant RPC
-- Machine-to-machine (M2M) partial-balance partner redemption.
-- ParaUsted - Digital Gift Card SaaS
--
-- Adds a partial-amount counterpart to redeem_voucher_full_for_merchant so
-- trusted partner systems can redeem part of a voucher's balance (e.g. a tour
-- worth less than a flexible or luxury gift card), leaving the remainder
-- spendable.
--
-- Security model is identical to the full-balance partner RPC:
--   - SECURITY DEFINER, service_role only; anon/authenticated cannot execute.
--   - merchant_id is supplied by trusted server code after resolving a hashed
--     partner API key; it is never trusted from a browser client.
--   - Atomic (FOR UPDATE + compare-and-set), append-only redemption/audit
--     writes, and the same state gates.
--   - Same idempotency semantics: same merchant + key + voucher replays; same
--     merchant + key + different voucher conflicts.
-- ============================================================

CREATE OR REPLACE FUNCTION public.redeem_voucher_partial_for_merchant(
    p_merchant_id     UUID,
    p_voucher_code    TEXT,
    p_amount_cents    INTEGER,
    p_notes           TEXT DEFAULT NULL,
    p_actor_id        TEXT DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
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
    -- 1. Validate merchant (fail-safe default even for the trusted caller).
    IF p_merchant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;

    SELECT id
    INTO v_merchant_id
    FROM merchants
    WHERE id = p_merchant_id
      AND status = 'active'
    LIMIT 1;

    IF v_merchant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;

    -- 2. Reject a non-positive amount before any lookup.
    IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_amount');
    END IF;

    -- 3. Normalise and validate voucher code format.
    v_code := upper(trim(coalesce(p_voucher_code, '')));

    IF v_code !~ '^[A-Z0-9]+(-[A-Z0-9]+)*-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
    END IF;

    v_idem := NULLIF(left(trim(coalesce(p_idempotency_key, '')), 255), '');

    -- 4. Idempotency replay: same merchant + key + voucher replays the prior
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

    -- 9. Append redemption record. redeemed_by is NULL: the partner integration
    --    is the actor (recorded in the audit event below).
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
        NULL,
        v_notes,
        v_idem
    )
    RETURNING id INTO v_redemption_id;

    -- 10. Audit the redemption as a partner-API (system) action.
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
        'system',
        coalesce(NULLIF(trim(p_actor_id), ''), 'partner_api'),
        'redemption',
        v_redemption_id,
        jsonb_build_object(
            'voucher_id', v_voucher.id,
            'voucher_code', v_voucher.code,
            'amount_cents', p_amount_cents,
            'balance_before', v_balance_before,
            'balance_after', v_balance_after,
            'channel', 'partner_api'
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
        -- Resolve it like the explicit replay branch.
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

-- Service-role only. Never callable by anon or authenticated browser clients.
REVOKE ALL ON FUNCTION public.redeem_voucher_partial_for_merchant(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_voucher_partial_for_merchant(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.redeem_voucher_partial_for_merchant(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_voucher_partial_for_merchant(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.redeem_voucher_partial_for_merchant(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT)
IS 'Machine-to-machine partial-balance voucher redemption. Service-role only. Merchant id is supplied by trusted server code after resolving a hashed partner API key; never trusted from a browser client. Atomic, append-only, idempotent by idempotency key. Sets status to partially_redeemed when a remainder is left, otherwise redeemed.';
