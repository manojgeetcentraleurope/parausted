-- ============================================================
-- Migration 010: security_events (security log - IMMUTABLE)
-- ParaUsted - Digital Gift Card SaaS
-- ============================================================

CREATE TABLE security_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type      TEXT NOT NULL,
    ip_address      INET NOT NULL,
    user_agent      TEXT,
    endpoint        TEXT NOT NULL,
    merchant_id     UUID,
    email           TEXT,
    details         JSONB,
    severity        TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
    auto_action     TEXT CHECK (auto_action IN ('blocked','captcha','flagged','none')),
    resolved        BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_by     UUID,
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_ip ON security_events(ip_address, created_at);
CREATE INDEX idx_security_type ON security_events(event_type, created_at);
CREATE INDEX idx_security_unresolved ON security_events(resolved, severity) WHERE resolved = FALSE;
CREATE INDEX idx_security_merchant ON security_events(merchant_id, created_at);

ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Only admin can read security events (no merchant access)
-- Admin uses service_role key which bypasses RLS

REVOKE DELETE ON security_events FROM authenticated;
REVOKE DELETE ON security_events FROM anon;

COMMENT ON TABLE security_events IS 'Security log. IMMUTABLE (no delete). Failed logins, rate limits, fraud flags, blocked requests.';
