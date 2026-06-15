-- ============================================================
-- Migration: platform_alerts (platform/admin alert queue)
-- ParaUsted - Digital Gift Card SaaS
-- Slice 8b.6g-1
-- ============================================================
--
-- Purpose:
--   Platform-only operational alert queue for critical platform
--   events (initial use case: critical external Stripe refund
--   conflict fraud_flags).
--
-- This migration ONLY creates the queue table.
--   - No DB trigger.
--   - No RPCs.
--   - No scanner/worker.
--   - No email sending.
--   - No reference to delivery_events.
--   - No FK to fraud_flags, purchases, or merchants.
--
-- The table is intentionally generic and decoupled from tenant /
-- merchant RLS assumptions. A future scanner/job route will enqueue
-- and drain rows; reconciliation (webhook/RPC) stays independent of
-- this table.
--
-- IMPORTANT data policy:
--   * payload MUST contain only safe, whitelisted operational fields.
--   * NEVER store PII (buyer/recipient/merchant name, email, phone).
--   * NEVER store full voucher codes.
--   * NEVER store raw Stripe webhook payloads, secrets, tokens, or
--     service-role keys.
-- ============================================================

CREATE TABLE public.platform_alerts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Classification
    alert_type          TEXT NOT NULL,
    severity            TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),

    -- Source linkage (generic; initially fraud_flags.id). No FK on purpose.
    source_type         TEXT NOT NULL,
    source_id           UUID NOT NULL,

    -- Human-quotable reference for support/operations.
    reference_code      TEXT,

    -- Safe, whitelisted operational fields only. No PII / no raw payloads.
    payload             JSONB NOT NULL,

    -- Delivery lifecycle
    status              TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','dead')),

    -- Worker retry / locking
    attempt_count       INTEGER NOT NULL DEFAULT 0,
    max_attempts        INTEGER NOT NULL DEFAULT 5,
    next_attempt_at     TIMESTAMPTZ,
    last_attempt_at     TIMESTAMPTZ,
    locked_at           TIMESTAMPTZ,
    locked_by           TEXT,

    -- Provider tracking
    provider_message_id TEXT,
    provider_response   JSONB,
    last_error          TEXT,

    -- Timestamps
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at             TIMESTAMPTZ,
    failed_at           TIMESTAMPTZ,

    -- Attempt bounds
    CONSTRAINT platform_alerts_attempt_count_non_negative CHECK (attempt_count >= 0),
    CONSTRAINT platform_alerts_max_attempts_positive CHECK (max_attempts > 0),
    CONSTRAINT platform_alerts_attempt_count_not_above_max CHECK (attempt_count <= max_attempts)
);

-- ============================================================
-- Indexes
-- ============================================================

-- Dedup: one alert per source record + alert type, across all statuses.
-- source_type/source_id are NOT NULL, but the guard keeps intent explicit.
CREATE UNIQUE INDEX idx_platform_alerts_source_dedup
ON public.platform_alerts(source_type, source_id, alert_type)
WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

-- Worker claim queue: eligible queued rows ordered by schedule.
CREATE INDEX idx_platform_alerts_worker_queue
ON public.platform_alerts(next_attempt_at, created_at)
WHERE status = 'queued';

-- Reclaim stale locks held by crashed workers.
CREATE INDEX idx_platform_alerts_locked
ON public.platform_alerts(locked_at)
WHERE locked_at IS NOT NULL;

-- Operational inspection by status + severity.
CREATE INDEX idx_platform_alerts_status_severity
ON public.platform_alerts(status, severity);

-- Chronological inspection.
CREATE INDEX idx_platform_alerts_created_at
ON public.platform_alerts(created_at);

-- ============================================================
-- Security: platform-only, no client/merchant access
-- ============================================================

ALTER TABLE public.platform_alerts ENABLE ROW LEVEL SECURITY;

-- No policies: this is platform-only data. service_role bypasses RLS.
-- anon and authenticated have no policy, so they have no access.

-- Defense in depth: explicitly revoke client-role access.
REVOKE ALL ON TABLE public.platform_alerts FROM anon;
REVOKE ALL ON TABLE public.platform_alerts FROM authenticated;

-- ============================================================
-- Comments
-- ============================================================

COMMENT ON TABLE public.platform_alerts IS
'Platform-only operational alert queue (e.g. critical external Stripe refund conflict fraud_flags). Drained by a future scanner/job route. payload MUST contain only safe whitelisted operational fields: NEVER PII, full voucher codes, raw Stripe payloads, or secrets. No FK to tenant tables on purpose so platform alerts do not inherit merchant/RLS assumptions.';

COMMENT ON COLUMN public.platform_alerts.alert_type IS
'Logical alert type, e.g. external_refund_after_redemption.';

COMMENT ON COLUMN public.platform_alerts.severity IS
'Alert severity: low | medium | high | critical.';

COMMENT ON COLUMN public.platform_alerts.source_type IS
'Source record kind that produced this alert. Initially fraud_flag.';

COMMENT ON COLUMN public.platform_alerts.source_id IS
'Source record id. Initially fraud_flags.id. No FK by design (generic, tenant-agnostic).';

COMMENT ON COLUMN public.platform_alerts.reference_code IS
'Short human-quotable reference for support/operations.';

COMMENT ON COLUMN public.platform_alerts.payload IS
'Safe whitelisted operational fields only (e.g. rule_code, severity, refund_id, payment_intent_id, amount, currency, timestamp, runbook link). NEVER PII, full voucher codes, raw Stripe payloads, or secrets.';

COMMENT ON COLUMN public.platform_alerts.status IS
'Lifecycle: queued -> sent | failed -> dead.';

COMMENT ON COLUMN public.platform_alerts.attempt_count IS
'Number of send attempts made by the alert worker.';

COMMENT ON COLUMN public.platform_alerts.max_attempts IS
'Maximum send attempts before the alert is marked dead.';

COMMENT ON COLUMN public.platform_alerts.next_attempt_at IS
'Earliest time a worker may attempt to send this alert. Supports scheduling and retry backoff.';

COMMENT ON COLUMN public.platform_alerts.last_attempt_at IS
'Timestamp of the most recent send attempt.';

COMMENT ON COLUMN public.platform_alerts.locked_at IS
'Timestamp when a worker locked this alert for processing. Prevents concurrent sends.';

COMMENT ON COLUMN public.platform_alerts.locked_by IS
'Worker identifier that locked this alert for processing.';

COMMENT ON COLUMN public.platform_alerts.provider_message_id IS
'Email/provider message id for the sent alert, when available.';

COMMENT ON COLUMN public.platform_alerts.provider_response IS
'Redacted provider response metadata. Must not contain secrets or PII.';

COMMENT ON COLUMN public.platform_alerts.last_error IS
'Last failure reason for operational debugging. Must not contain PII or secrets.';
