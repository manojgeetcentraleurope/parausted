-- Create RPCs for merchant purchase confirmation/cancellation.
-- These functions keep money-state transitions and audit logging atomic.
-- Voucher issuance is intentionally deferred to the Week 4 Day 3-4 slice.

CREATE OR REPLACE FUNCTION public.confirm_pending_purchase(p_purchase_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_merchant_id UUID;
    v_purchase RECORD;
    v_updated_id UUID;
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

    SELECT id, status, expires_at, reference_code
    INTO v_purchase
    FROM purchases
    WHERE id = p_purchase_id
      AND merchant_id = v_merchant_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_found');
    END IF;

    IF v_purchase.status <> 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error', 'already_processed');
    END IF;

    IF v_purchase.expires_at IS NOT NULL AND v_purchase.expires_at < now() THEN
        RETURN jsonb_build_object('success', false, 'error', 'expired');
    END IF;

    UPDATE purchases
    SET
        status = 'payment_confirmed',
        confirmed_at = now()
    WHERE id = p_purchase_id
      AND merchant_id = v_merchant_id
      AND status = 'pending'
    RETURNING id INTO v_updated_id;

    IF v_updated_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'already_processed');
    END IF;

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

    RETURN jsonb_build_object('success', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'unknown');
END;
$$;


CREATE OR REPLACE FUNCTION public.cancel_pending_purchase(
    p_purchase_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_merchant_id UUID;
    v_purchase RECORD;
    v_updated_id UUID;
    v_reason TEXT;
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

    SELECT id, status, reference_code
    INTO v_purchase
    FROM purchases
    WHERE id = p_purchase_id
      AND merchant_id = v_merchant_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_found');
    END IF;

    IF v_purchase.status <> 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error', 'already_processed');
    END IF;

    UPDATE purchases
    SET
        status = 'cancelled',
        cancelled_at = now()
    WHERE id = p_purchase_id
      AND merchant_id = v_merchant_id
      AND status = 'pending'
    RETURNING id INTO v_updated_id;

    IF v_updated_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'already_processed');
    END IF;

    v_reason := NULLIF(left(trim(coalesce(p_reason, '')), 500), '');

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
        'purchase_cancelled',
        'merchant',
        v_user_id::TEXT,
        'purchase',
        p_purchase_id,
        jsonb_strip_nulls(
            jsonb_build_object(
                'reference_code', v_purchase.reference_code,
                'reason', v_reason
            )
        )
    );

    RETURN jsonb_build_object('success', true);
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'unknown');
END;
$$;


REVOKE ALL ON FUNCTION public.confirm_pending_purchase(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_pending_purchase(UUID, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.confirm_pending_purchase(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_pending_purchase(UUID, TEXT) TO authenticated;