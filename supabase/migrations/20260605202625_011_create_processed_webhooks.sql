-- ============================================================
-- Migration 011: processed_webhooks (idempotency protection)
-- ParaUsted - Digital Gift Card SaaS
-- ============================================================

CREATE TABLE processed_webhooks (
    event_id        TEXT PRIMARY KEY,
    provider        TEXT NOT NULL CHECK (provider IN ('stripe','monei')),
    event_type      TEXT NOT NULL,
    processed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhooks_processed ON processed_webhooks(processed_at);

ALTER TABLE processed_webhooks ENABLE ROW LEVEL SECURITY;

-- No public access - only backend (service_role) reads/writes this table

COMMENT ON TABLE processed_webhooks IS 'Webhook idempotency. Store event_id to prevent double-processing. Auto-cleaned after 30 days.';
