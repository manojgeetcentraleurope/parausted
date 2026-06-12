-- Create RPCs for completing claimed delivery events.
--
-- This migration does not send delivery messages.
-- It only lets a trusted worker mark a previously claimed delivery event
-- as sent or failed, while enforcing lock ownership.

CREATE OR REPLACE FUNCTION public.mark_delivery_event_sent(
    p_delivery_event_id UUID,
    p_worker_id TEXT,
    p_provider_message_id TEXT DEFAULT NULL,
    p_provider_response JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
    v_worker_id TEXT := trim(p_worker_id);
    v_updated RECORD;
BEGIN
    IF p_delivery_event_id IS NULL THEN
        RAISE EXCEPTION 'delivery_event_id_required';
    END IF;

    IF NULLIF(v_worker_id, '') IS NULL THEN
        RAISE EXCEPTION 'worker_id_required';
    END IF;

    UPDATE public.delivery_events de
    SET
        status = 'sent',
        sent_at = v_now,
        failed_at = NULL,
        failure_reason = NULL,
        next_attempt_at = NULL,
        provider_message_id = COALESCE(NULLIF(trim(p_provider_message_id), ''), de.provider_message_id),
        provider_response = COALESCE(p_provider_response, de.provider_response),
        locked_at = NULL,
        locked_by = NULL
    WHERE de.id = p_delivery_event_id
      AND de.status = 'queued'
      AND de.locked_by = v_worker_id
      AND de.locked_at IS NOT NULL
    RETURNING
        de.id,
        de.status,
        de.sent_at
    INTO v_updated;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'not_claimed_or_already_completed'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'delivery_event_id', v_updated.id,
        'status', v_updated.status,
        'sent_at', v_updated.sent_at
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_delivery_event_failed(
    p_delivery_event_id UUID,
    p_worker_id TEXT,
    p_failure_reason TEXT,
    p_provider_response JSONB DEFAULT NULL,
    p_retryable BOOLEAN DEFAULT FALSE,
    p_retry_after_seconds INTEGER DEFAULT 300
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
    v_worker_id TEXT := trim(p_worker_id);
    v_failure_reason TEXT;
    v_retry_after_seconds INTEGER;
    v_next_attempt_at TIMESTAMPTZ;
    v_should_retry BOOLEAN;
    v_event RECORD;
    v_updated RECORD;
BEGIN
    IF p_delivery_event_id IS NULL THEN
        RAISE EXCEPTION 'delivery_event_id_required';
    END IF;

    IF NULLIF(v_worker_id, '') IS NULL THEN
        RAISE EXCEPTION 'worker_id_required';
    END IF;

    v_failure_reason := LEFT(
        COALESCE(NULLIF(trim(p_failure_reason), ''), 'provider_delivery_failed'),
        500
    );

    v_retry_after_seconds := LEAST(
        GREATEST(COALESCE(p_retry_after_seconds, 300), 1),
        86400
    );

    SELECT
        de.id,
        de.attempt_count,
        de.max_attempts
    INTO v_event
    FROM public.delivery_events de
    WHERE de.id = p_delivery_event_id
      AND de.status = 'queued'
      AND de.locked_by = v_worker_id
      AND de.locked_at IS NOT NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'not_claimed_or_already_completed'
        );
    END IF;

    v_should_retry := COALESCE(p_retryable, false)
        AND v_event.attempt_count < v_event.max_attempts;

    IF v_should_retry THEN
        v_next_attempt_at := v_now + (v_retry_after_seconds || ' seconds')::INTERVAL;

        UPDATE public.delivery_events de
        SET
            status = 'queued',
            failure_reason = v_failure_reason,
            provider_response = COALESCE(p_provider_response, de.provider_response),
            next_attempt_at = v_next_attempt_at,
            failed_at = NULL,
            locked_at = NULL,
            locked_by = NULL
        WHERE de.id = v_event.id
        RETURNING
            de.id,
            de.status,
            de.next_attempt_at
        INTO v_updated;

        RETURN jsonb_build_object(
            'success', true,
            'delivery_event_id', v_updated.id,
            'status', v_updated.status,
            'retry_scheduled', true,
            'next_attempt_at', v_updated.next_attempt_at
        );
    END IF;

    UPDATE public.delivery_events de
    SET
        status = 'failed',
        failed_at = v_now,
        failure_reason = v_failure_reason,
        provider_response = COALESCE(p_provider_response, de.provider_response),
        next_attempt_at = NULL,
        locked_at = NULL,
        locked_by = NULL
    WHERE de.id = v_event.id
    RETURNING
        de.id,
        de.status,
        de.failed_at
    INTO v_updated;

    RETURN jsonb_build_object(
        'success', true,
        'delivery_event_id', v_updated.id,
        'status', v_updated.status,
        'retry_scheduled', false,
        'failed_at', v_updated.failed_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.mark_delivery_event_sent(UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_delivery_event_sent(UUID, TEXT, TEXT, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.mark_delivery_event_sent(UUID, TEXT, TEXT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mark_delivery_event_sent(UUID, TEXT, TEXT, JSONB) TO service_role;

REVOKE ALL ON FUNCTION public.mark_delivery_event_failed(UUID, TEXT, TEXT, JSONB, BOOLEAN, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_delivery_event_failed(UUID, TEXT, TEXT, JSONB, BOOLEAN, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.mark_delivery_event_failed(UUID, TEXT, TEXT, JSONB, BOOLEAN, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mark_delivery_event_failed(UUID, TEXT, TEXT, JSONB, BOOLEAN, INTEGER) TO service_role;

COMMENT ON FUNCTION public.mark_delivery_event_sent(UUID, TEXT, TEXT, JSONB)
IS 'Marks a claimed delivery event as sent for a trusted worker. Does not send messages.';

COMMENT ON FUNCTION public.mark_delivery_event_failed(UUID, TEXT, TEXT, JSONB, BOOLEAN, INTEGER)
IS 'Marks a claimed delivery event as failed or schedules a retry for a trusted worker. Does not send messages.';
