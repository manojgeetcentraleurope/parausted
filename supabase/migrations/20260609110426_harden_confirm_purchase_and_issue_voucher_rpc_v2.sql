-- Harden confirm_purchase_and_issue_voucher RPC.
-- Improvements:
-- 1. Capture inserted voucher id.
-- 2. Audit voucher_issued against the voucher entity.
-- 3. Include purchase_id and voucher_code in audit payload.
-- 4. Explicitly restrict EXECUTE permission to authenticated users.
-- 5. Retry voucher code generation on rare unique-code collisions.

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
    v_voucher_id      UUID;
    v_expires_at      TIMESTAMPTZ;
    v_updated_id      UUID;
    v_attempts        INTEGER := 0;
BEGIN
    -- 1. Auth check
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;

    -- 2. Resolve merchant from session; never trust merchant_id from client
    SELECT id
    INTO v_merchant_id
    FROM merchants
    WHERE auth_user_id = v_user_id
    LIMIT 1;

    IF v_merchant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;

    -- 3. Load purchase in merchant scope
    SELECT id, status, expires_at, reference_code, amount_cents, gift_card_id
    INTO v_purchase
    FROM purchases
    WHERE id = p_purchase_id
      AND merchant_id = v_merchant_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_found');
    END IF;

    -- 4. Idempotency: if voucher already exists for this purchase, return it.
    -- This check is intentionally after merchant ownership validation.
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

    -- 5. Validate purchase state
    IF v_purchase.status <> 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error', 'already_processed');
    END IF;

    IF v_purchase.expires_at IS NOT NULL AND v_purchase.expires_at < now() THEN
        RETURN jsonb_build_object('success', false, 'error', 'expired');
    END IF;

    -- 6. Determine voucher expiry from gift card valid_days
    SELECT valid_days
    INTO v_gift_card
    FROM gift_cards
    WHERE id = v_purchase.gift_card_id
      AND merchant_id = v_merchant_id;

    v_expires_at := now() + (coalesce(v_gift_card.valid_days, 365) || ' days')::INTERVAL;

    -- 7. Confirm purchase with compare-and-swap guard
    UPDATE purchases
    SET
        status = 'payment_confirmed',
        confirmed_at = now()
    WHERE id = p_purchase_id
      AND merchant_id = v_merchant_id
      AND status = 'pending'
    RETURNING id INTO v_updated_id;

    IF v_updated_id IS NULL THEN
        -- Another concurrent call may have won. Return existing voucher if present.
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

    -- 8. Generate and insert voucher.
    -- Retry a few times in the extremely unlikely event of a random code collision.
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

    -- 9. Audit: payment confirmed
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

    -- 10. Audit: voucher issued, linked to voucher entity
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
GRANT EXECUTE ON FUNCTION public.confirm_purchase_and_issue_voucher(UUID) TO authenticated;