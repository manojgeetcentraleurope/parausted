-- ============================================================
-- Slice 8b.1: schema for online Stripe refund saga (schema only)
-- ParaUsted - Digital Gift Card SaaS
--
-- Adds the minimal schema needed for the two-phase online/card
-- (Stripe Connect destination charge) refund saga. No RPCs, no app
-- code, no Stripe calls, no webhook/ledger/payout/delivery/email
-- changes are included here. Those are deferred to Slice 8b.2+.
--
-- What this migration does:
--   1. Adds purchases.stripe_refund_id (nullable).
--      Stores the Stripe Refund id once the refund succeeds or is
--      recovered, for audit, retry-safety, and reconciliation.
--   2. Extends the purchases.status CHECK to add two saga states:
--        - refund_pending : online refund started; voucher voided and
--                           DB marked before/around the Stripe call.
--                           Resolves to 'refunded' or 'refund_failed'.
--        - refund_failed  : Stripe refund attempt did not succeed.
--                           Support can retry the deterministic,
--                           idempotent refund from this state.
--
-- Existing statuses are preserved unchanged:
--   pending, payment_confirmed, cancelled, refunded, partially_refunded
--
-- No existing rows are modified.
--
-- Out of scope (deferred): stripe_charge_id / stripe_transfer_id /
-- stripe_checkout_session_id columns, ledger entries, payouts, and
-- external Stripe Dashboard refund reconciliation via webhooks
-- (e.g. charge.refunded / refund.updated) — handled in a later slice.
-- ============================================================

-- 1. Stripe refund id (nullable; populated on refund success/recovery).
ALTER TABLE purchases
    ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT;

COMMENT ON COLUMN purchases.stripe_refund_id
IS 'Stripe Refund id (re_...) stored after a successful online refund or recovery. NULL until an online/card refund succeeds. External Stripe Dashboard refund reconciliation is deferred to a later slice.';

-- 2. Replace the status CHECK to include the online refund saga states.
--    The inline CHECK from 20260605200523_create_purchases.sql is
--    auto-named 'purchases_status_check' by Postgres.
ALTER TABLE purchases
    DROP CONSTRAINT IF EXISTS purchases_status_check;

ALTER TABLE purchases
    ADD CONSTRAINT purchases_status_check
    CHECK (status IN (
        'pending',
        'payment_confirmed',
        'cancelled',
        'refunded',
        'partially_refunded',
        'refund_pending',
        'refund_failed'
    ));
