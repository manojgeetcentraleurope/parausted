-- Harden manual voucher issuance transaction behavior.
--
-- Root cause addressed:
--   The manual confirm_purchase_and_issue_voucher RPC updates the purchase to
--   payment_confirmed before inserting the voucher. In the extremely unlikely
--   case that voucher-code generation exhausts all retry attempts, returning
--   a normal JSON error after the purchase UPDATE can leave a confirmed purchase
--   without a voucher.
--
-- Change:
--   Voucher-code generation exhaustion now raises an exception instead of
--   returning normally. The function-level EXCEPTION handler returns a safe
--   JSON error, while PostgreSQL rolls back the statements inside the function
--   block, preserving the invariant:
--
--     manual confirmation either confirms purchase + issues voucher together,
--     or changes nothing.

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

    SELECT valid_days
    INTO v_gift_card
    FROM gift_cards
    WHERE id = v_purchase.gift_card_id
      AND merchant_id = v_merchant_id;

    v_expires_at := now() + (coalesce(v_gift_card.valid_days, 365) || ' days')::INTERVAL;

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
