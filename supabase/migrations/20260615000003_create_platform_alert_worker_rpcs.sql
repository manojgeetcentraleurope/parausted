-- ============================================================
-- Migration: platform alert worker RPCs
-- ParaUsted - Digital Gift Card SaaS
-- Slice 8b.6g-2
-- ============================================================
--
-- Trusted worker RPCs for the platform/admin alert queue
-- (public.platform_alerts). These RPCs let a trusted worker
-- (service_role only) atomically claim queued platform alerts and
-- mark them as sent or failed while enforcing lock ownership.
--
-- This migration:
--   - does NOT send email.
--   - does NOT make any Stripe/network call.
--   - does NOT mutate fraud_flags, audit_events, or delivery_events.
--   - does NOT add a trigger or scanner.
--   - operates ONLY on public.platform_alerts.
--
-- platform_alerts has no idempotency_key column. We intentionally do
-- not add one in this slice (source-level dedup already exists via the
-- unique index on (source_type, source_id, alert_type)). Instead the
-- claim RPC returns a stable derived value
-- 'platform_alert:' || platform_alert_id so callers have a stable key
-- shape consistent with the delivery worker.
-- ============================================================

-- ============================================================
-- RPC 1: claim_queued_platform_alerts
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_queued_platform_alerts(
    p_worker_id TEXT,
    p_batch_size INTEGER DEFAULT 10,
    p_lock_timeout_seconds INTEGER DEFAULT 900
)
RETURNS TABLE (
    platform_alert_id UUID,
    alert_type TEXT,
    severity TEXT,
    source_type TEXT,
    source_id UUID,
    reference_code TEXT,
    payload JSONB,
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
    v_worker_id TEXT := trim(p_worker_id);
    v_batch_size INTEGER;
    v_lock_timeout INTERVAL;
    v_now TIMESTAMPTZ := now();
BEGIN
    IF NULLIF(v_worker_id, '') IS NULL THEN
        RAISE EXCEPTION 'worker_id_required';
    END IF;

    IF p_lock_timeout_seconds IS NULL OR p_lock_timeout_seconds <= 0 THEN
        RAISE EXCEPTION 'invalid_lock_timeout_seconds';
    END IF;

    v_batch_size := LEAST(GREATEST(COALESCE(p_batch_size, 10), 1), 50);
    v_lock_timeout := (p_lock_timeout_seconds || ' seconds')::INTERVAL;

    RETURN QUERY
    WITH candidates AS (
        SELECT pa.id
        FROM public.platform_alerts pa
        WHERE pa.status = 'queued'
          AND pa.attempt_count < pa.max_attempts
          AND (
              pa.next_attempt_at IS NULL
              OR pa.next_attempt_at <= v_now
          )
          AND (
              pa.locked_at IS NULL
              OR pa.locked_at < (v_now - v_lock_timeout)
          )
        ORDER BY
            COALESCE(pa.next_attempt_at, pa.created_at),
            pa.created_at,
            pa.id
        LIMIT v_batch_size
        FOR UPDATE SKIP LOCKED
    ),
    claimed AS (
        UPDATE public.platform_alerts pa
        SET
            attempt_count = pa.attempt_count + 1,
            last_attempt_at = v_now,
            locked_at = v_now,
            locked_by = v_worker_id
        FROM candidates c
        WHERE pa.id = c.id
        RETURNING
            pa.id,
            pa.alert_type,
            pa.severity,
            pa.source_type,
            pa.source_id,
            pa.reference_code,
            pa.payload,
            pa.attempt_count,
            pa.max_attempts,
            pa.locked_at,
            pa.locked_by
    )
    SELECT
        c.id,
        c.alert_type,
        c.severity,
        c.source_type,
        c.source_id,
        c.reference_code,
        c.payload,
        c.attempt_count,
        c.max_attempts,
        'platform_alert:' || c.id::TEXT AS idempotency_key,
        c.locked_at,
        c.locked_by
    FROM claimed c
    ORDER BY c.locked_at, c.id;
END;
$$;

-- ============================================================
-- RPC 2: mark_platform_alert_sent
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_platform_alert_sent(
    p_platform_alert_id UUID,
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
    IF p_platform_alert_id IS NULL THEN
        RAISE EXCEPTION 'platform_alert_id_required';
    END IF;

    IF NULLIF(v_worker_id, '') IS NULL THEN
        RAISE EXCEPTION 'worker_id_required';
    END IF;

    UPDATE public.platform_alerts pa
    SET
        status = 'sent',
        sent_at = v_now,
        next_attempt_at = NULL,
        failed_at = NULL,
        provider_message_id = NULLIF(trim(p_provider_message_id), ''),
        provider_response = p_provider_response,
        last_error = NULL,
        locked_at = NULL,
        locked_by = NULL
    WHERE pa.id = p_platform_alert_id
      AND pa.status = 'queued'
      AND pa.locked_by = v_worker_id
      AND pa.locked_at IS NOT NULL
    RETURNING
        pa.id,
        pa.status,
        pa.sent_at
    INTO v_updated;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'not_claimed_or_not_queued'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'outcome', 'sent',
        'platform_alert_id', v_updated.id,
        'sent_at', v_updated.sent_at
    );
END;
$$;

-- ============================================================
-- RPC 3: mark_platform_alert_failed
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_platform_alert_failed(
    p_platform_alert_id UUID,
    p_worker_id TEXT,
    p_failure_reason TEXT,
    p_retryable BOOLEAN DEFAULT TRUE,
    p_retry_after_seconds INTEGER DEFAULT 300,
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
    v_failure_reason TEXT;
    v_retry_after_seconds INTEGER;
    v_next_attempt_at TIMESTAMPTZ;
    v_should_retry BOOLEAN;
    v_alert RECORD;
    v_updated RECORD;
BEGIN
    IF p_platform_alert_id IS NULL THEN
        RAISE EXCEPTION 'platform_alert_id_required';
    END IF;

    IF NULLIF(v_worker_id, '') IS NULL THEN
        RAISE EXCEPTION 'worker_id_required';
    END IF;

    v_failure_reason := LEFT(
        COALESCE(NULLIF(trim(p_failure_reason), ''), 'platform_alert_delivery_failed'),
        500
    );

    v_retry_after_seconds := LEAST(
        GREATEST(COALESCE(p_retry_after_seconds, 300), 1),
        86400
    );

    SELECT
        pa.id,
        pa.attempt_count,
        pa.max_attempts
    INTO v_alert
    FROM public.platform_alerts pa
    WHERE pa.id = p_platform_alert_id
      AND pa.status = 'queued'
      AND pa.locked_by = v_worker_id
      AND pa.locked_at IS NOT NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'outcome', 'not_claimed_or_not_queued'
        );
    END IF;

    v_should_retry := COALESCE(p_retryable, false)
        AND v_alert.attempt_count < v_alert.max_attempts;

    IF v_should_retry THEN
        v_next_attempt_at := v_now + (v_retry_after_seconds || ' seconds')::INTERVAL;

        UPDATE public.platform_alerts pa
        SET
            status = 'queued',
            next_attempt_at = v_next_attempt_at,
            failed_at = v_now,
            last_error = v_failure_reason,
            provider_response = COALESCE(p_provider_response, pa.provider_response),
            locked_at = NULL,
            locked_by = NULL
        WHERE pa.id = v_alert.id
        RETURNING
            pa.id,
            pa.status,
            pa.next_attempt_at
        INTO v_updated;

        RETURN jsonb_build_object(
            'success', true,
            'outcome', 'retry_scheduled',
            'platform_alert_id', v_updated.id,
            'next_attempt_at', v_updated.next_attempt_at
        );
    END IF;

    UPDATE public.platform_alerts pa
    SET
        status = 'failed',
        failed_at = v_now,
        last_error = v_failure_reason,
        provider_response = COALESCE(p_provider_response, pa.provider_response),
        locked_at = NULL,
        locked_by = NULL
    WHERE pa.id = v_alert.id
    RETURNING
        pa.id,
        pa.status,
        pa.failed_at
    INTO v_updated;

    RETURN jsonb_build_object(
        'success', true,
        'outcome', 'failed',
        'platform_alert_id', v_updated.id,
        'failed_at', v_updated.failed_at
    );
END;
$$;

-- ============================================================
-- Grants: service_role only (trusted worker)
-- ============================================================

REVOKE ALL ON FUNCTION public.claim_queued_platform_alerts(TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_queued_platform_alerts(TEXT, INTEGER, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.claim_queued_platform_alerts(TEXT, INTEGER, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_queued_platform_alerts(TEXT, INTEGER, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.mark_platform_alert_sent(UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_platform_alert_sent(UUID, TEXT, TEXT, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.mark_platform_alert_sent(UUID, TEXT, TEXT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mark_platform_alert_sent(UUID, TEXT, TEXT, JSONB) TO service_role;

REVOKE ALL ON FUNCTION public.mark_platform_alert_failed(UUID, TEXT, TEXT, BOOLEAN, INTEGER, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_platform_alert_failed(UUID, TEXT, TEXT, BOOLEAN, INTEGER, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.mark_platform_alert_failed(UUID, TEXT, TEXT, BOOLEAN, INTEGER, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.mark_platform_alert_failed(UUID, TEXT, TEXT, BOOLEAN, INTEGER, JSONB) TO service_role;

-- ============================================================
-- Comments
-- ============================================================

COMMENT ON FUNCTION public.claim_queued_platform_alerts(TEXT, INTEGER, INTEGER)
IS 'Trusted worker RPC: atomically claims queued platform/admin alerts (FOR UPDATE SKIP LOCKED) without sending anything. service_role only.';

COMMENT ON FUNCTION public.mark_platform_alert_sent(UUID, TEXT, TEXT, JSONB)
IS 'Trusted worker RPC: marks a claimed platform/admin alert as sent, enforcing lock ownership. Does not send anything. service_role only.';

COMMENT ON FUNCTION public.mark_platform_alert_failed(UUID, TEXT, TEXT, BOOLEAN, INTEGER, JSONB)
IS 'Trusted worker RPC: marks a claimed platform/admin alert as failed or schedules a retry, enforcing lock ownership. Does not send anything. service_role only.';
