-- ============================================================
-- Migration 003: purchases (transaction record)
-- ParaUsted - Digital Gift Card SaaS
-- ============================================================

CREATE TABLE purchases (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id                 UUID NOT NULL REFERENCES merchants(id),
    gift_card_id                UUID NOT NULL REFERENCES gift_cards(id),

    -- Amount
    amount_cents                INTEGER NOT NULL CHECK (amount_cents > 0),
    currency                    TEXT NOT NULL DEFAULT 'EUR',

    -- Buyer (PII - auto-delete 30d after voucher expiry/redemption)
    buyer_email                 TEXT NOT NULL,
    buyer_name                  TEXT,
    buyer_phone                 TEXT,

    -- Recipient
    recipient_name              TEXT NOT NULL,
    recipient_email             TEXT,
    recipient_phone             TEXT,

    -- Personalization (LEGAL SHIELD - all required)
    relationship                TEXT NOT NULL CHECK (relationship IN ('mama','papa','hija','hijo','abuelo','abuela','pareja','familia','amigo','custom')),
    design_template             TEXT NOT NULL,
    personal_message            TEXT NOT NULL,
    sender_name                 TEXT NOT NULL,

    -- Payment
    payment_source              TEXT NOT NULL CHECK (payment_source IN ('ONLINE','OFFLINE')),
    payment_method              TEXT NOT NULL CHECK (payment_method IN ('card','apple_pay','google_pay','bizum_direct','bank_transfer','cash')),
    stripe_payment_intent_id    TEXT,
    reference_code              TEXT UNIQUE NOT NULL,

    -- Delivery
    delivery_method             TEXT NOT NULL CHECK (delivery_method IN ('whatsapp','email','download')),
    scheduled_delivery_at       TIMESTAMPTZ,

    -- Consent (legal requirement)
    consent_immediate_delivery  BOOLEAN NOT NULL DEFAULT FALSE,
    consent_accepted_at         TIMESTAMPTZ,

    -- Status
    status                      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','payment_confirmed','cancelled','refunded','partially_refunded')),

    -- Timestamps
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at                TIMESTAMPTZ,
    cancelled_at                TIMESTAMPTZ,
    refunded_at                 TIMESTAMPTZ,
    expires_at                  TIMESTAMPTZ,

    -- Validation: online payments must have consent
    CONSTRAINT online_requires_consent CHECK (
        payment_source != 'ONLINE' OR consent_immediate_delivery = TRUE
    ),
    -- Validation: at least one recipient contact method
    CONSTRAINT recipient_contact_required CHECK (
        recipient_email IS NOT NULL OR recipient_phone IS NOT NULL OR delivery_method = 'download'
    )
);

-- Indexes
CREATE INDEX idx_purchases_merchant ON purchases(merchant_id);
CREATE INDEX idx_purchases_status ON purchases(status);
CREATE INDEX idx_purchases_reference ON purchases(reference_code);
CREATE INDEX idx_purchases_buyer_email ON purchases(buyer_email);
CREATE INDEX idx_purchases_expires ON purchases(expires_at) WHERE status = 'pending';
CREATE INDEX idx_purchases_scheduled ON purchases(scheduled_delivery_at) WHERE scheduled_delivery_at IS NOT NULL;

-- Enable RLS
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- Merchant can see their own purchases
CREATE POLICY merchant_manage ON purchases
    FOR ALL USING (
        merchant_id IN (SELECT id FROM merchants WHERE auth_user_id = auth.uid())
    );

-- Public can create purchases (buyer is anonymous)
CREATE POLICY public_insert ON purchases
    FOR INSERT WITH CHECK (TRUE);

-- Auto-update (reuse existing function)
CREATE TRIGGER purchases_updated_at
    BEFORE UPDATE ON purchases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE purchases IS 'Transaction record. Stores full personalization data for legal evidence. Buyer PII auto-deleted 30d after voucher expiry.';
