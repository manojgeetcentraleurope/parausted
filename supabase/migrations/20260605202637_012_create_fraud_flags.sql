-- ============================================================
-- Migration 012: fraud_flags (fraud detection queue)
-- ParaUsted - Digital Gift Card SaaS
-- ============================================================

CREATE TABLE fraud_flags (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id     UUID REFERENCES purchases(id),
    merchant_id     UUID REFERENCES merchants(id),
    rule_code       TEXT NOT NULL,
    severity        TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
    description     TEXT NOT NULL,
    evidence        JSONB NOT NULL,
    status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','cleared','confirmed','escalated')),
    reviewed_by     UUID,
    reviewed_at     TIMESTAMPTZ,
    resolution_note TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fraud_status ON fraud_flags(status) WHERE status = 'open';
CREATE INDEX idx_fraud_merchant ON fraud_flags(merchant_id);
CREATE INDEX idx_fraud_severity ON fraud_flags(severity, status);

ALTER TABLE fraud_flags ENABLE ROW LEVEL SECURITY;

-- Only admin can read fraud flags (service_role bypasses RLS)

COMMENT ON TABLE fraud_flags IS 'Fraud detection queue. Flags are reviewed by platform admin. Open flags require action.';
