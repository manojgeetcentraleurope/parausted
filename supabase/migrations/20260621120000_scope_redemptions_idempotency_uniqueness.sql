-- ============================================================
-- Migration: scope redemptions idempotency uniqueness by merchant
-- ParaUsted - Digital Gift Card SaaS
-- ============================================================

-- Older environments may still have the original global unique constraint on
-- redemptions.idempotency_key. Replace it with merchant-scoped uniqueness so
-- tenant-namespaced hashed keys can be reused safely across merchants.

ALTER TABLE public.redemptions
    DROP CONSTRAINT IF EXISTS redemptions_idempotency_key_key;

-- Defensive cleanup in case the old uniqueness exists as a standalone index.
DROP INDEX IF EXISTS public.redemptions_idempotency_key_key;
DROP INDEX IF EXISTS public.idx_redemptions_idempotency_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_redemptions_merchant_idempotency_key
ON public.redemptions(merchant_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

COMMENT ON INDEX public.idx_redemptions_merchant_idempotency_key
IS 'Enforces idempotency per merchant while allowing the same hashed key to exist across tenants.';