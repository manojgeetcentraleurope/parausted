-- ============================================================
-- Migration 002: gift_cards (what merchants offer)
-- ParaUsted - Digital Gift Card SaaS
-- ============================================================

CREATE TABLE gift_cards (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id         UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    card_type           TEXT NOT NULL CHECK (card_type IN ('fixed_value','custom_value','service')),
    title               TEXT NOT NULL,
    description         TEXT,
    amount_cents        INTEGER,
    min_amount_cents    INTEGER,
    max_amount_cents    INTEGER,
    valid_days          INTEGER NOT NULL DEFAULT 365 CHECK (valid_days >= 365),
    image_url           TEXT,
    sort_order          INTEGER NOT NULL DEFAULT 0,
    active              BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT valid_fixed_value CHECK (
        card_type != 'fixed_value' OR amount_cents IS NOT NULL
    ),
    CONSTRAINT valid_custom_value CHECK (
        card_type != 'custom_value' OR (min_amount_cents IS NOT NULL AND max_amount_cents IS NOT NULL)
    ),
    CONSTRAINT valid_custom_range CHECK (
        min_amount_cents IS NULL OR max_amount_cents IS NULL OR min_amount_cents < max_amount_cents
    ),
    CONSTRAINT positive_amounts CHECK (
        (amount_cents IS NULL OR amount_cents > 0) AND
        (min_amount_cents IS NULL OR min_amount_cents > 0) AND
        (max_amount_cents IS NULL OR max_amount_cents > 0)
    )
);

CREATE INDEX idx_gift_cards_merchant ON gift_cards(merchant_id);
CREATE INDEX idx_gift_cards_active ON gift_cards(merchant_id, active) WHERE active = TRUE;

ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY merchant_manage ON gift_cards
    FOR ALL USING (
        merchant_id IN (SELECT id FROM merchants WHERE auth_user_id = auth.uid())
    );

CREATE POLICY public_read_active ON gift_cards
    FOR SELECT USING (active = TRUE);

CREATE TRIGGER gift_cards_updated_at
    BEFORE UPDATE ON gift_cards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE gift_cards IS 'What the merchant offers. valid_days minimum 365 (Spanish consumer law).';
