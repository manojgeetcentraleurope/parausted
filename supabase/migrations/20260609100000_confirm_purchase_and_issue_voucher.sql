-- Migration: confirm_purchase_and_issue_voucher RPC
-- Atomically confirms a pending purchase and issues exactly one voucher.
-- Replaces calling confirm_pending_purchase + a separate voucher insert.
-- Idempotent: if the voucher already exists for the purchase, returns the
-- existing code without error.

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
    v_hex             TEXT;
    v_voucher_code    TEXT;
    v_expires_at      TIMESTAMPTZ;
    v_updated_id      UUID;
BEGIN
    -- ── 1. Auth check ────────────────────────────────────────────
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;

    -- ── 2. Resolve merchant from session, never from client ──────
    SELECT id
    INTO v_merchant_id
    FROM merchants
    WHERE auth_user_id = v_user_id
    LIMIT 1;

    IF v_merchant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;

    -- ── 3. Load purchase (tenant-scoped) ─────────────────────────
    SELECT id, status, expires_at, reference_code, amount_cents, gift_card_id
    INTO v_purchase
    FROM purchases
    WHERE id = p_purchase_id
      AND merchant_id = v_merchant_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_found');
    END IF;

    -- ── 4. Idempotency: voucher already issued for this purchase ──
    SELECT code
    INTO v_existing_code
    FROM vouchers
    WHERE purchase_id = p_purchase_id;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success',       true,
            'voucher_code',  v_existing_code,
            'already_issued', true
        );
    END IF;

    -- ── 5. Validate purchase state ───────────────────────────────
    IF v_purchase.status <> 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error', 'already_processed');
    END IF;

    IF v_purchase.expires_at IS NOT NULL AND v_purchase.expires_at < now() THEN
        RETURN jsonb_build_object('success', false, 'error', 'expired');
    END IF;

    -- ── 6. Determine voucher expiry from gift card valid_days ─────
    SELECT valid_days
    INTO v_gift_card
    FROM gift_cards
    WHERE id = v_purchase.gift_card_id;

    v_expires_at := now() + (coalesce(v_gift_card.valid_days, 365) || ' days')::INTERVAL;

    -- ── 7. Confirm the purchase (CAS: only if still pending) ──────
    UPDATE purchases
    SET
        status       = 'payment_confirmed',
        confirmed_at = now()
    WHERE id          = p_purchase_id
      AND merchant_id = v_merchant_id
      AND status      = 'pending'
    RETURNING id INTO v_updated_id;

    -- Race-condition guard: another concurrent call confirmed it first
    IF v_updated_id IS NULL THEN
        -- Re-check whether a voucher appeared in the race window
        SELECT code
        INTO v_existing_code
        FROM vouchers
        WHERE purchase_id = p_purchase_id;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success',       true,
                'voucher_code',  v_existing_code,
                'already_issued', true
            );
        END IF;

        RETURN jsonb_build_object('success', false, 'error', 'already_processed');
    END IF;

    -- ── 8. Generate crypto-random voucher code: PU-XXXX-XXXX-XXXX ─
    -- gen_random_bytes lives in the extensions schema in Supabase.
    -- Fully qualify to avoid search_path ambiguity inside SECURITY DEFINER.
    v_hex         := upper(encode(extensions.gen_random_bytes(6), 'hex'));
    v_voucher_code := 'PU-'
                   || substr(v_hex, 1, 4) || '-'
                   || substr(v_hex, 5, 4) || '-'
                   || substr(v_hex, 9, 4);

    -- ── 9. Insert voucher ─────────────────────────────────────────
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
        v_voucher_code,          -- qr_data: page renders full URL from code
        v_purchase.amount_cents,
        v_purchase.amount_cents, -- full balance on issuance
        'issued',
        v_expires_at
    );

    -- ── 10. Audit: payment confirmed ─────────────────────────────
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

    -- ── 11. Audit: voucher issued ────────────────────────────────
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
        'purchase',
        p_purchase_id,
        jsonb_build_object(
            'reference_code', v_purchase.reference_code,
            'amount_cents',   v_purchase.amount_cents
        )
    );

    RETURN jsonb_build_object(
        'success',       true,
        'voucher_code',  v_voucher_code,
        'already_issued', false
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'unknown');
END;
$$;
