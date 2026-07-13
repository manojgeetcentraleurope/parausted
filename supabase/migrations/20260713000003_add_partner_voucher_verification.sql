-- Read-only, tenant-scoped voucher verification for trusted partner systems.

ALTER TABLE public.partner_api_keys
    ALTER COLUMN scopes SET DEFAULT ARRAY['voucher:read', 'voucher:redeem'];

UPDATE public.partner_api_keys
SET scopes = array_append(scopes, 'voucher:read')
WHERE 'voucher:redeem' = ANY(scopes)
  AND NOT ('voucher:read' = ANY(scopes));

CREATE OR REPLACE FUNCTION public.verify_voucher_for_merchant(
    p_merchant_id UUID,
    p_voucher_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_code TEXT;
    v_voucher RECORD;
BEGIN
    IF p_merchant_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM merchants
        WHERE id = p_merchant_id
          AND status = 'active'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
    END IF;

    v_code := upper(trim(coalesce(p_voucher_code, '')));

    IF v_code !~ '^[A-Z0-9]+(-[A-Z0-9]+)*-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$' THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_or_not_found');
    END IF;

    SELECT code, balance_cents, status, expires_at
    INTO v_voucher
    FROM vouchers
    WHERE merchant_id = p_merchant_id
      AND code = v_code
      AND status IN ('issued', 'delivered', 'partially_redeemed')
      AND balance_cents > 0
      AND expires_at >= now()
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'invalid_or_not_found');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'eligible', true,
        'voucher_code', v_voucher.code,
        'balance_cents', v_voucher.balance_cents,
        'status', v_voucher.status,
        'expires_at', v_voucher.expires_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_voucher_for_merchant(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_voucher_for_merchant(UUID, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.verify_voucher_for_merchant(UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.verify_voucher_for_merchant(UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.verify_voucher_for_merchant(UUID, TEXT) IS
    'Read-only partner voucher eligibility lookup. Tenant scoped, service-role only, and returns no buyer or recipient PII.';
