-- ============================================================
-- Migration 005: redemptions (usage tracking - APPEND ONLY)
-- ParaUsted - Digital Gift Card SaaS
-- ============================================================

CREATE TABLE redemptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_id      UUID NOT NULL REFERENCES vouchers(id),
    merchant_id     UUID NOT NULL REFERENCES merchants(id),

    -- What was redeemed
    amount_cents    INTEGER NOT NULL CHECK (amount_cents > 0),
    balance_before  INTEGER NOT NULL CHECK (balance_before >= 0),
    balance_after   INTEGER NOT NULL CHECK (balance_after >= 0),

    -- Who redeemed (merchant staff)
    redeemed_by     UUID,

    -- Notes
    notes           TEXT,

    -- Idempotency
    idempotency_key TEXT UNIQUE,

    -- Timestamp
    redeemed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Validation: balance_after must be consistent
    CONSTRAINT consistent_balance CHECK (balance_after = balance_before - amount_cents),
    -- Validation: cannot redeem more than balance
    CONSTRAINT sufficient_balance CHECK (balance_before >= amount_cents)
);

-- Indexes
CREATE INDEX idx_redemptions_voucher ON redemptions(voucher_id);
CREATE INDEX idx_redemptions_merchant ON redemptions(merchant_id);
CREATE INDEX idx_redemptions_date ON redemptions(merchant_id, redeemed_at);

-- Enable RLS
ALTER TABLE redemptions ENABLE ROW LEVEL SECURITY;

-- Merchant can see their own redemptions
CREATE POLICY merchant_manage ON redemptions
    FOR ALL USING (
        merchant_id IN (SELECT id FROM merchants WHERE auth_user_id = auth.uid())
    );

-- APPEND-ONLY: revoke update and delete
REVOKE UPDATE, DELETE ON redemptions FROM authenticated;
REVOKE UPDATE, DELETE ON redemptions FROM anon;

COMMENT ON TABLE redemptions IS 'Usage tracking. APPEND-ONLY - no updates, no deletes. CHECK constraints prevent negative balances and inconsistent state.';
