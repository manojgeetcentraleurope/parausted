-- ============================================================
-- Migration: partner_api_keys + redeem_voucher_full_for_merchant RPC
-- Machine-to-machine (M2M) partner redemption.
-- ParaUsted - Digital Gift Card SaaS
--
-- Adds a service-token authentication path so trusted partner systems
-- (e.g. the Seville Tours backend or trusted server integration) can redeem a voucher's full balance
-- server-to-server, WITHOUT a logged-in merchant browser session.
--
-- Security model:
--   - Raw tokens are NEVER stored. Only a SHA-256 hash is persisted.
--   - The token resolves to exactly ONE merchant_id, server-side. The
--     client never supplies merchant_id.
--   - The redemption RPC is SECURITY DEFINER and granted to service_role
--     ONLY. anon/authenticated cannot execute it. The trusted API route
--     (admin/service-role client) resolves the merchant from the token
--     hash and passes it explicitly.
--   - Same atomic balance protection, append-only redemption/audit writes,
--     and state gates as the merchant-session redeem RPC.
-- ============================================================

-- ------------------------------------------------------------
-- 1. partner_api_keys: hashed M2M credentials, one merchant each
-- ------------------------------------------------------------
CREATE TABLE partner_api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id     UUID NOT NULL REFERENCES merchants(id),
    label           TEXT NOT NULL,
    -- SHA-256 hex digest of the raw token. The raw token is shown once at
    -- creation time and never persisted.
    token_hash      TEXT NOT NULL UNIQUE,
    -- Non-secret leading fragment for identification in logs/UI.
    token_prefix    TEXT NOT NULL,
    scopes          TEXT[] NOT NULL DEFAULT ARRAY['voucher:redeem'],
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at      TIMESTAMPTZ
);

CREATE INDEX idx_partner_api_keys_merchant ON partner_api_keys(merchant_id);
CREATE INDEX idx_partner_api_keys_active ON partner_api_keys(status) WHERE status = 'active';

ALTER TABLE partner_api_keys ENABLE ROW LEVEL SECURITY;

-- No RLS policies: reachable only through trusted service_role/admin code.
-- anon/authenticated have no direct access (defence in depth alongside RLS).
REVOKE ALL ON TABLE partner_api_keys FROM anon;
REVOKE ALL ON TABLE partner_api_keys FROM authenticated;

COMMENT ON TABLE partner_api_keys IS
    'Hashed machine-to-machine API keys for partner integrations. Only SHA-256 hashes are stored; raw tokens are never persisted. Each key maps to exactly one merchant. Service-role access only.';

-- ------------------------------------------------------------
-- 2. redeem_voucher_full_for_merchant: M2M full-balance redemption
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_voucher_full_for_merchant(
    p_merchant_id     UUID,
    p_voucher_code    TEXT,
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
    v_redemption_id   UUID;
    v_updated_id      UUID;
    v_notes           TEXT;
    v_idem            TEXT;
BEGIN
    -- 1. Validate merchant. The caller is the trusted service role, but we
    --    still confirm the tenant exists and is active (fail-safe default).
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

    -- 2. Normalise and validate voucher code format.
    v_code := upper(trim(coalesce(p_voucher_code, '')));

    IF v_code !~ '^[A-Z0-9]+(-[A-Z0-9]+)*-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
    END IF;

    v_idem := NULLIF(left(trim(coalesce(p_idempotency_key, '')), 255), '');

    -- 3. Idempotency replay: same merchant + same key + same voucher replays
    --    the prior result; same merchant + same key + different voucher is a
    --    conflict and must not be treated as success.
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
                    'status', 'redeemed',
                    'idempotent_replay', true
                );
            END IF;

            RETURN jsonb_build_object('success', false, 'error', 'idempotency_conflict');
        END IF;
    END IF;

    -- 4. Load and lock the voucher in merchant scope.
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

    -- 5. Terminal / non-redeemable states.
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

    -- 6. Full remaining-balance redemption.
    v_balance_before := v_voucher.balance_cents;
    v_notes := NULLIF(left(trim(coalesce(p_notes, '')), 500), '');

    -- 7. Update voucher first; the exception block rolls back on later failure.
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

    -- 8. Append redemption record. redeemed_by is NULL: no merchant user acted;
    --    the partner integration is the actor (recorded in audit below).
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
        v_balance_before,
        v_balance_before,
        0,
        NULL,
        v_notes,
        v_idem
    )
    RETURNING id INTO v_redemption_id;

    -- 9. Audit the redemption as a partner-API (system) action.
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
            'amount_cents', v_balance_before,
            'balance_before', v_balance_before,
            'balance_after', 0,
            'channel', 'partner_api'
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
    WHEN unique_violation THEN
        -- A concurrent request with the same idempotency key won the race.
        -- Resolve it the same way as the explicit replay branch so same-voucher
        -- retries succeed and cross-voucher reuse returns a conflict.
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
                        'status', 'redeemed',
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
REVOKE ALL ON FUNCTION public.redeem_voucher_full_for_merchant(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_voucher_full_for_merchant(UUID, TEXT, TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.redeem_voucher_full_for_merchant(UUID, TEXT, TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_voucher_full_for_merchant(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.redeem_voucher_full_for_merchant(UUID, TEXT, TEXT, TEXT, TEXT)
IS 'Machine-to-machine full-balance voucher redemption. Service-role only. Merchant id is supplied by trusted server code after resolving a hashed partner API key; never trusted from a browser client. Atomic, append-only, idempotent by idempotency key.';
