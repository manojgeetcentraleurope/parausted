-- ============================================================
-- Migration: rate_limit_counters + check_and_increment_rate_limit RPC
-- Slice 8b.10a — durable rate-limit foundation
-- ParaUsted - Digital Gift Card SaaS
--
-- Durable, serverless-safe rate-limit store. In-memory counters are
-- unreliable on Vercel (isolated instances), so counting lives in
-- Postgres behind a single atomic SECURITY DEFINER RPC.
--
-- Fixed-window counting: requests are bucketed by floor(now / window)
-- so each (key, window_start) row counts one window. The unique
-- constraint makes the upsert atomic under concurrency.
--
-- This migration only creates the store + RPC. No public flow is
-- wired to it yet (that is slice 8b.10b).
-- ============================================================

CREATE TABLE rate_limit_counters (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_limit_key  TEXT NOT NULL,
    window_start    TIMESTAMPTZ NOT NULL,
    count           INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT rate_limit_counters_key_window_unique UNIQUE (rate_limit_key, window_start)
);

-- Cleanup-friendly index: old windows can be purged by a scheduled job.
CREATE INDEX idx_rate_limit_window_start ON rate_limit_counters(window_start);

ALTER TABLE rate_limit_counters ENABLE ROW LEVEL SECURITY;

-- No RLS policies: the table is reachable only through the SECURITY DEFINER
-- RPC below and trusted service_role/admin code. anon/authenticated have no
-- direct access.
REVOKE ALL ON TABLE rate_limit_counters FROM anon;
REVOKE ALL ON TABLE rate_limit_counters FROM authenticated;

COMMENT ON TABLE rate_limit_counters IS
    'Durable fixed-window rate-limit counters. One row per (rate_limit_key, window_start). Reachable only via check_and_increment_rate_limit RPC.';

-- ------------------------------------------------------------
-- Atomic check-and-increment RPC
--
-- Counts the current request, then reports whether it is within the
-- limit. Returns JSONB:
--   { allowed, count, "limit", window_start, window_reset, retry_after_seconds }
--
-- Invalid input (empty key, non-positive limit/window) returns
-- allowed = true so callers fail open and never block a legitimate
-- request on a misconfiguration. Callers are responsible for logging.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
    p_key            TEXT,
    p_limit          INTEGER,
    p_window_seconds INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_key          TEXT;
    v_now          TIMESTAMPTZ := now();
    v_epoch        BIGINT;
    v_window_start TIMESTAMPTZ;
    v_window_reset TIMESTAMPTZ;
    v_count        INTEGER;
BEGIN
    v_key := trim(coalesce(p_key, ''));

    -- Fail open on invalid configuration: never block on bad input.
    IF v_key = '' OR p_limit IS NULL OR p_limit <= 0
       OR p_window_seconds IS NULL OR p_window_seconds <= 0 THEN
        RETURN jsonb_build_object(
            'allowed', true,
            'count', 0,
            'limit', coalesce(p_limit, 0),
            'window_start', v_now,
            'window_reset', v_now,
            'retry_after_seconds', 0
        );
    END IF;

    -- Bucket the current time into a fixed window.
    v_epoch := floor(extract(epoch FROM v_now))::BIGINT;
    v_window_start := to_timestamp((v_epoch / p_window_seconds) * p_window_seconds);
    v_window_reset := v_window_start + make_interval(secs => p_window_seconds);

    -- Atomic upsert: insert this request, or bump the existing window count.
    INSERT INTO rate_limit_counters (rate_limit_key, window_start, count)
    VALUES (v_key, v_window_start, 1)
    ON CONFLICT (rate_limit_key, window_start)
    DO UPDATE SET
        count = rate_limit_counters.count + 1,
        updated_at = v_now
    RETURNING count INTO v_count;

    RETURN jsonb_build_object(
        'allowed', v_count <= p_limit,
        'count', v_count,
        'limit', p_limit,
        'window_start', v_window_start,
        'window_reset', v_window_reset,
        'retry_after_seconds',
            GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_window_reset - v_now)))::INTEGER)
    );
END;
$$;

-- Grants: service_role only (trusted server/admin code).
REVOKE ALL ON FUNCTION public.check_and_increment_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_and_increment_rate_limit(TEXT, INTEGER, INTEGER) FROM anon;
REVOKE ALL ON FUNCTION public.check_and_increment_rate_limit(TEXT, INTEGER, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
