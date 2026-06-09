-- Add missing updated_at column required by purchases_updated_at trigger.
-- The purchases table already has a BEFORE UPDATE trigger using update_updated_at(),
-- and that trigger expects NEW.updated_at to exist.
ALTER TABLE purchases
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();