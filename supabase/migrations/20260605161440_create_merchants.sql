-- ============================================================
-- Migration 001: merchants (tenant master table)
-- ParaUsted — Digital Gift Card SaaS
-- ============================================================

CREATE TABLE merchants (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id        UUID UNIQUE NOT NULL,
    name                TEXT NOT NULL,
    slug                TEXT UNIQUE NOT NULL,
    category            TEXT NOT NULL CHECK (category IN ('barber','restaurant','tour','gym','school','other')),
    description         TEXT,
    logo_url            TEXT,
    cover_image_url     TEXT,
    brand_color         TEXT NOT NULL DEFAULT '#000000',
    phone               TEXT,
    email               TEXT NOT NULL,
    website_url         TEXT,
    address             TEXT,
    city                TEXT NOT NULL DEFAULT 'Sevilla',
    country             TEXT NOT NULL DEFAULT 'ES',
    timezone            TEXT NOT NULL DEFAULT 'Europe/Madrid',
    stripe_account_id   TEXT,
    stripe_onboarded    BOOLEAN NOT NULL DEFAULT FALSE,
    bizum_phone         TEXT,
    bank_iban           TEXT,
    plan_tier           TEXT NOT NULL DEFAULT 'free' CHECK (plan_tier IN ('free','basic','pro')),
    status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','closed')),
    onboarded_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_merchants_slug ON merchants(slug);
CREATE INDEX idx_merchants_city ON merchants(city);
CREATE INDEX idx_merchants_category ON merchants(category);
CREATE INDEX idx_merchants_status ON merchants(status) WHERE status = 'active';

ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;

CREATE POLICY merchant_isolation ON merchants
    FOR ALL USING (auth_user_id = auth.uid());

CREATE POLICY public_read_active ON merchants
    FOR SELECT USING (status = 'active');

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER merchants_updated_at
    BEFORE UPDATE ON merchants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE merchants IS 'Tenant master table — each merchant is a tenant in the multi-tenant SaaS';
