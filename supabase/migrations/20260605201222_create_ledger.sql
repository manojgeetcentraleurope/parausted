-- ============================================================
-- Migration 007: ledger_accounts + ledger_entries (financial tracking)
-- ParaUsted - Digital Gift Card SaaS
-- DOUBLE-ENTRY LEDGER. ledger_entries is IMMUTABLE.
-- ============================================================

-- Accounts (one set per merchant + platform accounts)
CREATE TABLE ledger_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_type      TEXT NOT NULL CHECK (owner_type IN ('platform','merchant')),
    owner_id        UUID,
    account_type    TEXT NOT NULL CHECK (account_type IN ('revenue','payable_85','reserve_15','processing_fees','refund_loss')),
    balance_cents   INTEGER NOT NULL DEFAULT 0,
    currency        TEXT NOT NULL DEFAULT 'EUR',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One account per type per owner
CREATE UNIQUE INDEX idx_ledger_accounts_unique
    ON ledger_accounts(owner_type, COALESCE(owner_id, '00000000-0000-0000-0000-000000000000'::uuid), account_type);

-- Entries (IMMUTABLE - append only, never update/delete)
CREATE TABLE ledger_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      UUID NOT NULL REFERENCES ledger_accounts(id),
    merchant_id     UUID,

    -- Transaction
    entry_type      TEXT NOT NULL CHECK (entry_type IN ('credit','debit')),
    amount_cents    INTEGER NOT NULL CHECK (amount_cents > 0),
    running_balance INTEGER NOT NULL,

    -- Reference
    description     TEXT NOT NULL,
    reference_type  TEXT NOT NULL CHECK (reference_type IN ('purchase','refund','payout','fee','adjustment')),
    reference_id    UUID,

    -- Metadata
    metadata        JSONB,

    -- Timestamp (IMMUTABLE)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_ledger_entries_account ON ledger_entries(account_id, created_at);
CREATE INDEX idx_ledger_entries_merchant ON ledger_entries(merchant_id, created_at);
CREATE INDEX idx_ledger_entries_reference ON ledger_entries(reference_type, reference_id);

-- Enable RLS
ALTER TABLE ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

-- Merchant can see their own accounts
CREATE POLICY merchant_read ON ledger_accounts
    FOR SELECT USING (
        owner_type = 'platform' OR
        owner_id IN (SELECT id FROM merchants WHERE auth_user_id = auth.uid())
    );

-- Merchant can see their own entries
CREATE POLICY merchant_read ON ledger_entries
    FOR SELECT USING (
        merchant_id IN (SELECT id FROM merchants WHERE auth_user_id = auth.uid())
    );

-- IMMUTABLE: revoke update and delete on entries
REVOKE UPDATE, DELETE ON ledger_entries FROM authenticated;
REVOKE UPDATE, DELETE ON ledger_entries FROM anon;

COMMENT ON TABLE ledger_accounts IS 'Financial accounts - one set per merchant plus platform accounts.';
COMMENT ON TABLE ledger_entries IS 'Double-entry ledger. IMMUTABLE - no updates, no deletes. Every cent tracked.';
