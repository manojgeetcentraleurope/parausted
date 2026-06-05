-- ============================================================
-- Migration 009: audit_events (complete business history - IMMUTABLE)
-- ParaUsted - Digital Gift Card SaaS
-- ============================================================

CREATE TABLE audit_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id     UUID,
    event_type      TEXT NOT NULL,
    actor_type      TEXT NOT NULL CHECK (actor_type IN ('system','merchant','buyer','admin')),
    actor_id        TEXT,
    entity_type     TEXT NOT NULL CHECK (entity_type IN ('purchase','voucher','merchant','payout','delivery','redemption')),
    entity_id       UUID NOT NULL,
    payload         JSONB,
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_merchant ON audit_events(merchant_id, created_at);
CREATE INDEX idx_audit_entity ON audit_events(entity_type, entity_id);
CREATE INDEX idx_audit_type ON audit_events(event_type, created_at);

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY merchant_read ON audit_events
    FOR SELECT USING (
        merchant_id IN (SELECT id FROM merchants WHERE auth_user_id = auth.uid())
    );

REVOKE UPDATE, DELETE ON audit_events FROM authenticated;
REVOKE UPDATE, DELETE ON audit_events FROM anon;

COMMENT ON TABLE audit_events IS 'Complete business history. IMMUTABLE - no updates, no deletes. Every action logged.';
