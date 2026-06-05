-- ============================================================
-- Migration 008: payouts (merchant payment records)
-- ParaUsted - Digital Gift Card SaaS
-- ============================================================

CREATE TABLE payouts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id         UUID NOT NULL REFERENCES merchants(id),
    amount_cents        INTEGER NOT NULL CHECK (amount_cents > 0),
    currency            TEXT NOT NULL DEFAULT 'EUR',
    payout_type         TEXT NOT NULL CHECK (payout_type IN ('85_percent','15_percent_reserve')),
    stripe_transfer_id  TEXT,
    destination_iban    TEXT,
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
    scheduled_for       TIMESTAMPTZ NOT NULL,
    initiated_at        TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    failed_at           TIMESTAMPTZ,
    failure_reason      TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payouts_merchant ON payouts(merchant_id);
CREATE INDEX idx_payouts_scheduled ON payouts(status, scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_payouts_status ON payouts(status);

ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY merchant_read ON payouts
    FOR SELECT USING (
        merchant_id IN (SELECT id FROM merchants WHERE auth_user_id = auth.uid())
    );

COMMENT ON TABLE payouts IS 'Merchant payment records. 85% at 72h, 15% reserve at 14 days. Online payments only.';
