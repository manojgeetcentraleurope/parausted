-- Harden public voucher page access.
--
-- Problem:
--   The original voucher page reads directly from public.vouchers using the
--   public_read_by_code RLS policy. That policy currently allows SELECT USING (true),
--   which is broader than the intended access-token-by-code behavior.
--
-- Goal:
--   Keep /v/[code] usable as the canonical voucher source-of-truth page, but stop
--   exposing the base vouchers table directly to anonymous clients.
--
-- Approach:
--   1. Drop the broad public_read_by_code policy on vouchers.
--   2. Revoke direct anon access to the vouchers table.
--   3. Add a SECURITY DEFINER RPC that validates the voucher code format and returns
--      only the safe public fields required by the voucher page.
--   4. Grant execute on the RPC to anon and authenticated.
--
-- Notes:
--   - The voucher code remains an access-token-like secret.
--   - Do not return buyer email, buyer phone, recipient email, recipient phone,
--     payment data, provider responses, audit payloads, or internal IDs.
--   - Merchant dashboard access remains through authenticated RLS policies.

DROP POLICY IF EXISTS public_read_by_code ON public.vouchers;

REVOKE ALL ON TABLE public.vouchers FROM anon;
REVOKE ALL ON TABLE public.vouchers FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.get_public_voucher_page(p_code TEXT)
RETURNS TABLE (
    code TEXT,
    original_amount_cents INTEGER,
    balance_cents INTEGER,
    status TEXT,
    expires_at TIMESTAMPTZ,
    recipient_name TEXT,
    sender_name TEXT,
    personal_message TEXT,
    merchant_name TEXT,
    delivery_channel TEXT,
    delivery_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_code TEXT;
BEGIN
    v_code := upper(trim(coalesce(p_code, '')));

    IF v_code !~ '^PU-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$' THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        v.code,
        v.original_amount_cents,
        v.balance_cents,
        v.status,
        v.expires_at,
        p.recipient_name,
        p.sender_name,
        p.personal_message,
        m.name AS merchant_name,
        de.channel AS delivery_channel,
        de.status AS delivery_status
    FROM public.vouchers v
    JOIN public.purchases p
      ON p.id = v.purchase_id
     AND p.merchant_id = v.merchant_id
    LEFT JOIN public.merchants m
      ON m.id = v.merchant_id
    LEFT JOIN LATERAL (
        SELECT
            d.channel,
            d.status
        FROM public.delivery_events d
        WHERE d.voucher_id = v.id
          AND d.merchant_id = v.merchant_id
        ORDER BY COALESCE(d.sent_at, d.failed_at, d.queued_at) DESC NULLS LAST,
                 d.queued_at DESC NULLS LAST
        LIMIT 1
    ) de ON TRUE
    WHERE v.code = v_code
    LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_voucher_page(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_voucher_page(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.get_public_voucher_page(TEXT) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.get_public_voucher_page(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_voucher_page(TEXT) TO authenticated;

COMMENT ON FUNCTION public.get_public_voucher_page(TEXT)
IS 'Returns safe public voucher page fields for a valid voucher code. Does not expose contact PII or payment internals.';
