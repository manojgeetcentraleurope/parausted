-- ============================================================
-- Migration 006: delivery_events (delivery audit trail)
-- ParaUsted - Digital Gift Card SaaS
-- ============================================================

CREATE TABLE delivery_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id         UUID NOT NULL REFERENCES purchases(id),
    voucher_id          UUID REFERENCES vouchers(id),
    merchant_id         UUID NOT NULL REFERENCES merchants(id),

    -- Delivery Details
    channel             TEXT NOT NULL CHECK (channel IN ('whatsapp','email','sms','pdf_download')),
    recipient_contact   TEXT NOT NULL,

    -- Status
    status              TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','failed','downloaded')),

    -- Provider Tracking
    provider_message_id TEXT,
    provider_response   JSONB,

    -- Timestamps
    queued_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at             TIMESTAMPTZ,
    delivered_at        TIMESTAMPTZ,
    failed_at           TIMESTAMPTZ,
    failure_reason      TEXT
);

-- Indexes
CREATE INDEX idx_delivery_purchase ON delivery_events(purchase_id);
CREATE INDEX idx_delivery_voucher ON delivery_events(voucher_id);
CREATE INDEX idx_delivery_status ON delivery_events(status) WHERE status IN ('queued','sent');
CREATE INDEX idx_delivery_merchant ON delivery_events(merchant_id);

-- Enable RLS
ALTER TABLE delivery_events ENABLE ROW LEVEL SECURITY;

-- Merchant can see their own delivery events
CREATE POLICY merchant_manage ON delivery_events
    FOR ALL USING (
        merchant_id IN (SELECT id FROM merchants WHERE auth_user_id = auth.uid())
    );

COMMENT ON TABLE delivery_events IS 'Delivery audit trail. Tracks WhatsApp, email, SMS, PDF download with provider_message_id for traceability.';
