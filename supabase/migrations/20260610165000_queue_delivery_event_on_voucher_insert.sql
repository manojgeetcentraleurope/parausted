-- Queue delivery audit events whenever a voucher is issued.
--
-- Rationale:
-- - Both manual confirmation and Stripe webhook issuance insert into vouchers.
-- - A trigger keeps delivery audit creation centralized and future-proof.
-- - This does not send email/WhatsApp/SMS; it only records that delivery is queued/ready.

CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_events_unique_voucher_channel
ON public.delivery_events(voucher_id, channel)
WHERE voucher_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.queue_delivery_event_for_voucher()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_purchase RECORD;
    v_channel TEXT;
    v_recipient_contact TEXT;
BEGIN
    SELECT
        delivery_method,
        buyer_email,
        buyer_phone,
        recipient_email,
        recipient_phone
    INTO v_purchase
    FROM public.purchases
    WHERE id = NEW.purchase_id
      AND merchant_id = NEW.merchant_id;

    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    v_channel := CASE v_purchase.delivery_method
        WHEN 'download' THEN 'pdf_download'
        ELSE v_purchase.delivery_method
    END;

    v_recipient_contact := CASE v_purchase.delivery_method
        WHEN 'email' THEN
            COALESCE(
                NULLIF(v_purchase.recipient_email, ''),
                NULLIF(v_purchase.buyer_email, '')
            )
        WHEN 'whatsapp' THEN
            COALESCE(
                NULLIF(v_purchase.recipient_phone, ''),
                NULLIF(v_purchase.buyer_phone, ''),
                NULLIF(v_purchase.recipient_email, ''),
                NULLIF(v_purchase.buyer_email, '')
            )
        WHEN 'download' THEN
            COALESCE(
                NULLIF(v_purchase.recipient_email, ''),
                NULLIF(v_purchase.buyer_email, '')
            )
        ELSE NULL
    END;

    -- Do not block voucher issuance for legacy/incomplete contact data.
    -- Future delivery workers can surface missing-contact issues separately.
    IF v_channel IS NULL OR v_recipient_contact IS NULL THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.delivery_events (
        purchase_id,
        voucher_id,
        merchant_id,
        channel,
        recipient_contact,
        status,
        queued_at
    )
    VALUES (
        NEW.purchase_id,
        NEW.id,
        NEW.merchant_id,
        v_channel,
        v_recipient_contact,
        'queued',
        now()
    )
    ON CONFLICT (voucher_id, channel) WHERE voucher_id IS NOT NULL DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_queue_delivery_event_for_voucher ON public.vouchers;

CREATE TRIGGER trg_queue_delivery_event_for_voucher
AFTER INSERT ON public.vouchers
FOR EACH ROW
EXECUTE FUNCTION public.queue_delivery_event_for_voucher();

-- Backfill delivery audit events for vouchers issued before this trigger existed.
WITH delivery_candidates AS (
    SELECT
        v.purchase_id,
        v.id AS voucher_id,
        v.merchant_id,
        CASE p.delivery_method
            WHEN 'download' THEN 'pdf_download'
            ELSE p.delivery_method
        END AS channel,
        CASE p.delivery_method
            WHEN 'email' THEN
                COALESCE(NULLIF(p.recipient_email, ''), NULLIF(p.buyer_email, ''))
            WHEN 'whatsapp' THEN
                COALESCE(
                    NULLIF(p.recipient_phone, ''),
                    NULLIF(p.buyer_phone, ''),
                    NULLIF(p.recipient_email, ''),
                    NULLIF(p.buyer_email, '')
                )
            WHEN 'download' THEN
                COALESCE(NULLIF(p.recipient_email, ''), NULLIF(p.buyer_email, ''))
            ELSE NULL
        END AS recipient_contact
    FROM public.vouchers v
    JOIN public.purchases p
      ON p.id = v.purchase_id
     AND p.merchant_id = v.merchant_id
)
INSERT INTO public.delivery_events (
    purchase_id,
    voucher_id,
    merchant_id,
    channel,
    recipient_contact,
    status,
    queued_at
)
SELECT
    purchase_id,
    voucher_id,
    merchant_id,
    channel,
    recipient_contact,
    'queued',
    now()
FROM delivery_candidates
WHERE channel IS NOT NULL
  AND recipient_contact IS NOT NULL
ON CONFLICT (voucher_id, channel) WHERE voucher_id IS NOT NULL DO NOTHING;

REVOKE ALL ON FUNCTION public.queue_delivery_event_for_voucher() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.queue_delivery_event_for_voucher() FROM anon;
REVOKE ALL ON FUNCTION public.queue_delivery_event_for_voucher() FROM authenticated;

COMMENT ON FUNCTION public.queue_delivery_event_for_voucher()
IS 'Queues a delivery_events audit row after voucher issuance. Does not send delivery messages.';
