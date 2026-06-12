-- Create RPC for atomically claiming queued delivery events.
--
-- This migration does not send delivery messages.
-- It only lets a trusted worker claim eligible email delivery events
-- without two workers claiming the same row concurrently.

CREATE OR REPLACE FUNCTION public.claim_queued_delivery_events(
    p_worker_id TEXT,
    p_batch_size INTEGER DEFAULT 10,
    p_lock_timeout_seconds INTEGER DEFAULT 900
)
RETURNS TABLE (
    delivery_event_id UUID,
    purchase_id UUID,
    voucher_id UUID,
    merchant_id UUID,
    channel TEXT,
    recipient_contact TEXT,
    attempt_count INTEGER,
    max_attempts INTEGER,
    idempotency_key TEXT,
    locked_at TIMESTAMPTZ,
    locked_by TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_batch_size INTEGER;
    v_lock_timeout INTERVAL;
    v_now TIMESTAMPTZ := now();
BEGIN
    IF NULLIF(trim(p_worker_id), '') IS NULL THEN
        RAISE EXCEPTION 'worker_id_required';
    END IF;

    IF p_lock_timeout_seconds IS NULL OR p_lock_timeout_seconds <= 0 THEN
        RAISE EXCEPTION 'invalid_lock_timeout_seconds';
    END IF;

    v_batch_size := LEAST(GREATEST(COALESCE(p_batch_size, 10), 1), 50);
    v_lock_timeout := (p_lock_timeout_seconds || ' seconds')::INTERVAL;

    RETURN QUERY
    WITH candidates AS (
        SELECT de.id
        FROM public.delivery_events de
        WHERE de.status = 'queued'
          AND de.channel = 'email'
          AND de.attempt_count < de.max_attempts
          AND (
              de.next_attempt_at IS NULL
              OR de.next_attempt_at <= v_now
          )
          AND (
              de.locked_at IS NULL
              OR de.locked_at < (v_now - v_lock_timeout)
          )
        ORDER BY
            COALESCE(de.next_attempt_at, de.queued_at),
            de.queued_at,
            de.id
        LIMIT v_batch_size
        FOR UPDATE SKIP LOCKED
    ),
    claimed AS (
        UPDATE public.delivery_events de
        SET
            attempt_count = de.attempt_count + 1,
            last_attempt_at = v_now,
            locked_at = v_now,
            locked_by = trim(p_worker_id)
        FROM candidates c
        WHERE de.id = c.id
        RETURNING
            de.id,
            de.purchase_id,
            de.voucher_id,
            de.merchant_id,
            de.channel,
            de.recipient_contact,
            de.attempt_count,
            de.max_attempts,
            de.idempotency_key,
            de.locked_at,
            de.locked_by
    )
    SELECT
        c.id,
        c.purchase_id,
        c.voucher_id,
        c.merchant_id,
        c.channel,
        c.recipient_contact,
        c.attempt_count,
        c.max_attempts,
        c.idempotency_key,
        c.locked_at,
        c.locked_by
    FROM claimed c
    ORDER BY c.locked_at, c.id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_queued_delivery_events(TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_queued_delivery_events(TEXT, INTEGER, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.claim_queued_delivery_events(TEXT, INTEGER, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_queued_delivery_events(TEXT, INTEGER, INTEGER) TO service_role;

COMMENT ON FUNCTION public.claim_queued_delivery_events(TEXT, INTEGER, INTEGER)
IS 'Atomically claims queued email delivery events for a trusted delivery worker. Does not send messages.';
