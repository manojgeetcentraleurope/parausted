-- ============================================================
-- Slice 8a.1: support-controlled direct/offline refund + voucher void
-- ParaUsted - Digital Gift Card SaaS
--
-- Creates public.refund_offline_purchase(UUID, TEXT).
-- DB-state only: marks an OFFLINE payment_confirmed purchase as refunded
-- and voids its un-redeemed voucher, atomically, with audit trail.
--
-- Out of scope (deferred): Stripe refunds/reversals (Slice 8b), ledger
-- entries, payouts, delivery events, email notifications.
-- External money return for offline refunds is handled by merchant/support.
-- ============================================================

CREATE OR REPLACE FUNCTION public.refund_offline_purchase(
    p_purchase_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id            UUID := auth.uid();
    v_merchant_id        UUID;
    v_reason             TEXT;
    v_purchase           RECORD;
    v_voucher            RECORD;
    v_updated_purchase_id UUID;
    v_updated_voucher_id  UUID;
    v_payload            JSONB;
BEGIN
    -- 1. Auth check
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;

    -- 2. Resolve merchant from authenticated session; never trust client merchant_id
    SELECT id
    INTO v_merchant_id
    FROM merchants
    WHERE auth_user_id = v_user_id
    LIMIT 1;

    IF v_merchant_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;

    -- 3. Validate reason (required, trimmed, capped at 500 chars)
    v_reason := NULLIF(left(trim(coalesce(p_reason, '')), 500), '');

    IF v_reason IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_reason');
    END IF;

    -- 4. Load purchase in merchant scope
    SELECT id,
           status,
           payment_source,
           reference_code,
           amount_cents
    INTO v_purchase
    FROM purchases
    WHERE id = p_purchase_id
      AND merchant_id = v_merchant_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_found');
    END IF;

    -- 5. Offline-only in Slice 8a; online refunds deferred to 8b
    IF v_purchase.payment_source <> 'OFFLINE' THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_payment_source');
    END IF;

    -- 6. Purchase must be in a refundable confirmed state
    IF v_purchase.status <> 'payment_confirmed' THEN
        IF v_purchase.status IN ('refunded', 'cancelled', 'partially_refunded') THEN
            RETURN jsonb_build_object('success', false, 'error', 'already_processed');
        END IF;
        RETURN jsonb_build_object('success', false, 'error', 'not_refundable');
    END IF;

    -- 7. Load and lock voucher in merchant scope
    SELECT id,
           code,
           status,
           balance_cents,
           original_amount_cents
    INTO v_voucher
    FROM vouchers
    WHERE purchase_id = p_purchase_id
      AND merchant_id = v_merchant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_refundable');
    END IF;

    -- 8. Voucher must be un-redeemed and refundable
    IF v_voucher.status NOT IN ('issued', 'delivered') THEN
        RETURN jsonb_build_object('success', false, 'error', 'not_refundable');
    END IF;

    -- 9. Primary gate: reject if ANY redemption exists (checked after lock)
    IF EXISTS (
        SELECT 1
        FROM redemptions
        WHERE voucher_id = v_voucher.id
          AND merchant_id = v_merchant_id
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'has_redemptions');
    END IF;

    -- 10. Defense-in-depth: balance must equal original amount
    IF v_voucher.balance_cents <> v_voucher.original_amount_cents THEN
        RETURN jsonb_build_object('success', false, 'error', 'state_invalid');
    END IF;

    -- 11. Mark purchase refunded (guarded transition)
    UPDATE purchases
    SET status = 'refunded',
        refunded_at = now()
    WHERE id = p_purchase_id
      AND merchant_id = v_merchant_id
      AND status = 'payment_confirmed'
    RETURNING id INTO v_updated_purchase_id;

    IF v_updated_purchase_id IS NULL THEN
        RAISE EXCEPTION 'refund_offline_purchase: purchase transition lost for %', p_purchase_id;
    END IF;

    -- 12. Void voucher (guarded transition)
    UPDATE vouchers
    SET status = 'voided'
    WHERE id = v_voucher.id
      AND merchant_id = v_merchant_id
      AND status IN ('issued', 'delivered')
    RETURNING id INTO v_updated_voucher_id;

    IF v_updated_voucher_id IS NULL THEN
        RAISE EXCEPTION 'refund_offline_purchase: voucher transition lost for %', v_voucher.id;
    END IF;

    -- 13. Audit both state changes with a standardized payload
    v_payload := jsonb_build_object(
        'purchase_id', p_purchase_id,
        'voucher_id', v_voucher.id,
        'voucher_code', v_voucher.code,
        'reference_code', v_purchase.reference_code,
        'amount_cents', v_purchase.amount_cents,
        'reason', v_reason,
        'refund_type', 'offline_manual'
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
        'purchase_refunded',
        'merchant',
        v_user_id::TEXT,
        'purchase',
        p_purchase_id,
        v_payload
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
        'voucher_voided',
        'merchant',
        v_user_id::TEXT,
        'voucher',
        v_voucher.id,
        v_payload
    );

    -- 14. Success
    RETURN jsonb_build_object(
        'success', true,
        'voucher_code', v_voucher.code,
        'refund_type', 'offline_manual'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', 'unknown');
END;
$$;

REVOKE ALL ON FUNCTION public.refund_offline_purchase(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refund_offline_purchase(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.refund_offline_purchase(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.refund_offline_purchase(UUID, TEXT)
IS 'Support-controlled direct/offline refund. DB-state only: marks an OFFLINE payment_confirmed purchase as refunded and voids its un-redeemed voucher, atomically, with audit trail. No Stripe/ledger/payout/delivery/email side effects.';
