-- ============================================================
-- Migration 004: vouchers (the actual gift card)
-- ParaUsted - Digital Gift Card SaaS
-- ============================================================

CREATE TABLE vouchers (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id             UUID UNIQUE NOT NULL REFERENCES purchases(id),
    merchant_id             UUID NOT NULL REFERENCES merchants(id),

    -- The Code (what recipient uses)
    code                    TEXT UNIQUE NOT NULL,
    qr_data                 TEXT NOT NULL,

    -- Value Tracking
    original_amount_cents   INTEGER NOT NULL CHECK (original_amount_cents > 0),
    balance_cents           INTEGER NOT NULL CHECK (balance_cents >= 0),

    -- Status (state machine)
    status                  TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','delivered','partially_redeemed','redeemed','exchanged','expired','voided')),

    -- Validity
    issued_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivered_at            TIMESTAMPTZ,
    expires_at              TIMESTAMPTZ NOT NULL,

    -- Transfer tracking
    current_holder_email    TEXT,
    current_holder_phone    TEXT,
    transfer_count          INTEGER NOT NULL DEFAULT 0 CHECK (transfer_count >= 0),

    -- PDF
    pdf_url                 TEXT,

    -- Timestamps
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Balance cannot exceed original amount
    CONSTRAINT balance_not_exceeds_original CHECK (balance_cents <= original_amount_cents)
);

-- Indexes
CREATE INDEX idx_vouchers_code ON vouchers(code);
CREATE INDEX idx_vouchers_merchant ON vouchers(merchant_id);
CREATE INDEX idx_vouchers_status ON vouchers(status);
CREATE INDEX idx_vouchers_expires ON vouchers(expires_at)
    WHERE status NOT IN ('redeemed','voided','expired');
CREATE INDEX idx_vouchers_purchase ON vouchers(purchase_id);

-- Enable RLS
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;

-- Merchant can see their own vouchers
CREATE POLICY merchant_manage ON vouchers
    FOR ALL USING (
        merchant_id IN (SELECT id FROM merchants WHERE auth_user_id = auth.uid())
    );

-- Public can read voucher by code (for voucher status page)
CREATE POLICY public_read_by_code ON vouchers
    FOR SELECT USING (TRUE);

-- Auto-update updated_at
CREATE TRIGGER vouchers_updated_at
    BEFORE UPDATE ON vouchers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE vouchers IS 'The actual gift card. Code is crypto-random 12+ chars. Balance tracked in cents. 1:1 with purchases.';
