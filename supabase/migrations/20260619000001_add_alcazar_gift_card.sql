-- ============================================================
-- Migration: Add dedicated Alcázar fixed gift card for Seville Tours Co.
--            and retire the generic ST-GC-FIX card if history-free.
-- ParaUsted - Digital Gift Card SaaS
-- ============================================================
--
-- Context:
--   Merchant     : Seville Tours Co.
--   merchant_id  : 44b8bc03-f869-4715-9905-5d0e3e5ec93d
--   Slug         : seville-tours-co
--   Route        : /tours/seville-alcazar-guided-tour
--
-- Problem:
--   The existing ST-GC-FIX card (id: 9dec3401-916c-43a9-9944-f0694b9adba2)
--   is a generic €50 fixed card with no specific tour branding.
--   The Alcázar route CTA requires a dedicated product promise:
--   "Tarjeta regalo Tour guiado del Alcázar" (ES) /
--   "Alcázar Guided Tour Gift Card" (EN).
--
-- Decision:
--   1. Insert a new dedicated fixed card: ST-GC-ALC, €50, sort_order=11.
--   2. Deactivate the old generic ST-GC-FIX card — but ONLY if it has
--      zero purchases and zero vouchers at migration runtime.
--      If any history exists, deactivation is skipped (NOTICE raised for
--      manual review). This protects all existing customer relationships.
--
-- Safety:
--   - No explicit BEGIN/COMMIT. Supabase CLI wraps each migration file in
--     its own implicit transaction automatically.
--   - DO block 1: Asserts merchant exists, slug = 'seville-tours-co', and
--     status = 'active'. Aborts the entire migration on any assertion failure.
--   - DO block 2: Inserts new ST-GC-ALC card ONLY when no active card with
--     prefix 'ST-GC-ALC' already exists for this merchant (idempotent re-run).
--   - DO block 3: Deactivates ST-GC-FIX ONLY when purchase_count=0 AND
--     voucher_count=0 at migration runtime. If history has accumulated since
--     DB discovery, this block safely skips and does NOT abort the migration.
--     The ST-GC-ALC insert in DO block 2 is unaffected by the skip.
--   - Does NOT touch: vouchers, redemptions, ledger_entries, audit_events,
--     delivery_events, payouts, processed_webhooks, or any other gift card.
--
-- Card lineup after this migration (active cards, assuming FIX is history-free):
--   sort_order=10  ST-GC-FIX  fixed_value   €50.00 — deactivated (was generic)
--   sort_order=11  ST-GC-ALC  fixed_value   €50.00 — NEW Alcázar dedicated card
--   sort_order=20  ST-GC-FLX  custom_value  €35.00 – €500.00 flexible (untouched)
--   sort_order=30  ST-GC-LUX  custom_value  €100.00 – €1000.00 luxury (untouched)
-- ============================================================


-- ── 1. Pre-insert assertions ──────────────────────────────────────────────────
--
-- Derives merchant_id at runtime from slug = 'seville-tours-co' and
-- status = 'active'. Aborts the entire migration (RAISE EXCEPTION rolls back
-- the implicit transaction) if no matching active merchant is found.
-- Using slug-derived lookup makes this migration environment-portable
-- (local dev, staging, prod) without relying on a hardcoded UUID.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    v_merchant_id  UUID;
BEGIN
    SELECT id
      INTO v_merchant_id
      FROM public.merchants
     WHERE slug   = 'seville-tours-co'
       AND status = 'active';

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'MIGRATION ABORT: no active merchant with slug ''seville-tours-co'' found in public.merchants.';
    END IF;

    RAISE NOTICE
        'Pre-insert assertions passed: merchant_id=% slug=seville-tours-co status=active.',
        v_merchant_id;
END;
$$;


-- ── 2. Conditional insert — idempotent ───────────────────────────────────────
--
-- Derives merchant_id from slug at runtime (same logic as block 1).
-- Guard: if an active gift card with voucher_code_prefix = 'ST-GC-ALC' already
-- exists for this merchant, log a notice and skip. This makes the migration safe
-- to re-run (e.g. after a partially applied supabase db push that was retried).
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    v_merchant_id  UUID;
    v_existing_id  UUID;
BEGIN
    -- Derive merchant_id by slug. Aborts if no active merchant found.
    SELECT id
      INTO v_merchant_id
      FROM public.merchants
     WHERE slug   = 'seville-tours-co'
       AND status = 'active';

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'MIGRATION ABORT: no active merchant with slug ''seville-tours-co'' found in public.merchants.';
    END IF;

    SELECT id
      INTO v_existing_id
      FROM public.gift_cards
     WHERE merchant_id         = v_merchant_id
       AND voucher_code_prefix = 'ST-GC-ALC'
       AND active              = TRUE
     LIMIT 1;

    IF FOUND THEN
        RAISE NOTICE
            'ST-GC-ALC card already active (id=%). No insert needed.',
            v_existing_id;
        RETURN;
    END IF;

    INSERT INTO public.gift_cards (
        merchant_id,
        card_type,
        title,
        title_en,
        description,
        description_en,
        amount_cents,
        valid_days,
        voucher_code_prefix,
        sort_order,
        active
    ) VALUES (
        v_merchant_id,
        'fixed_value',
        'Tarjeta regalo Tour guiado del Alcázar',
        'Alcázar Guided Tour Gift Card',
        'Regala un tour guiado del Alcázar con Seville Tours Co. La fecha y disponibilidad se coordinan con Seville Tours Co. después de la compra.',
        'Gift an Alcázar guided tour with Seville Tours Co. Date and availability are coordinated with Seville Tours Co. after purchase.',
        5000,
        365,
        'ST-GC-ALC',
        11,
        TRUE
    );

    RAISE NOTICE
        'Alcázar guided tour gift card (ST-GC-ALC) inserted successfully for merchant_id=%.',
        v_merchant_id;
END;
$$;


-- ── 3. Conditional deactivation of generic ST-GC-FIX card ───────────────────
--
-- Derives merchant_id from slug at runtime (same logic as blocks 1 and 2).
-- The generic ST-GC-FIX card (sort_order=10, €50) has no specific tour branding
-- and is superseded by the dedicated ST-GC-ALC card. It is safe to deactivate
-- ONLY when it has zero purchases and zero vouchers at runtime.
--
-- Why this runtime guard matters (not just trusting the DB discovery snapshot):
--   - At time of DB discovery: purchase_count=0, voucher_count=0 (safe to deactivate).
--   - Between DB discovery and migration execution it is theoretically possible
--     for a purchase to be made against ST-GC-FIX.
--   - If any history exists at runtime, this block emits a NOTICE and skips
--     the deactivation. The migration still succeeds — the ST-GC-ALC insert
--     in DO block 2 is fully independent and unaffected by this skip.
--
-- Note on voucher ownership:
--   vouchers.gift_card_id does not exist as a direct column.
--   Voucher history is resolved by joining:
--     vouchers.purchase_id → purchases.id → purchases.gift_card_id
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    v_merchant_id     UUID;
    v_fix_card_id     UUID;
    v_purchase_count  BIGINT;
    v_voucher_count   BIGINT;
BEGIN
    -- Derive merchant_id by slug. Aborts if no active merchant found.
    SELECT id
      INTO v_merchant_id
      FROM public.merchants
     WHERE slug   = 'seville-tours-co'
       AND status = 'active';

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'MIGRATION ABORT: no active merchant with slug ''seville-tours-co'' found in public.merchants.';
    END IF;

    -- Locate the active generic fixed card by prefix and derived merchant_id.
    -- Lookup by prefix+merchant is robust across environments where seeded IDs differ.
    SELECT id
      INTO v_fix_card_id
      FROM public.gift_cards
     WHERE merchant_id         = v_merchant_id
       AND voucher_code_prefix = 'ST-GC-FIX'
       AND active              = TRUE
     LIMIT 1;

    IF NOT FOUND THEN
        RAISE NOTICE
            'ST-GC-FIX active card not found for merchant_id=%. Already inactive or removed — nothing to deactivate.',
            v_merchant_id;
        RETURN;
    END IF;

    -- Count all purchases directly referencing this gift card.
    SELECT COUNT(*)
      INTO v_purchase_count
      FROM public.purchases
     WHERE gift_card_id = v_fix_card_id;

    -- Count vouchers issued via purchases referencing this gift card.
    -- Joined through purchases because vouchers has no gift_card_id column.
    SELECT COUNT(*)
      INTO v_voucher_count
      FROM public.vouchers v
      JOIN public.purchases p ON p.id = v.purchase_id
     WHERE p.gift_card_id = v_fix_card_id;

    IF v_purchase_count > 0 OR v_voucher_count > 0 THEN
        -- History exists — deactivation is unsafe. Skip and let operator review.
        RAISE NOTICE
            'DEACTIVATION SKIPPED: ST-GC-FIX (id=%) has % purchase(s) and % voucher(s). Review manually before deactivating.',
            v_fix_card_id, v_purchase_count, v_voucher_count;
        RETURN;
    END IF;

    -- Zero history confirmed at runtime — safe to deactivate the generic card.
    UPDATE public.gift_cards
       SET active     = FALSE,
           updated_at = now()
     WHERE id = v_fix_card_id;

    RAISE NOTICE
        'ST-GC-FIX card (id=%) deactivated — confirmed 0 purchases and 0 vouchers.',
        v_fix_card_id;
END;
$$;


-- ============================================================
-- Post-migration verification queries
-- Run manually in psql or the Supabase SQL editor after supabase db push.
-- ============================================================

-- 1. Merchant identity — must return exactly 1 row with status='active'
-- SELECT id, name, slug, status
--   FROM public.merchants
--  WHERE id = '44b8bc03-f869-4715-9905-5d0e3e5ec93d';

-- 2. All active gift cards ordered by sort_order
--    Expected active rows: sort_order 11 (ST-GC-ALC), 20 (ST-GC-FLX), 30 (ST-GC-LUX).
--    sort_order=10 (ST-GC-FIX) must be absent from active cards if it had zero history.
-- SELECT id,
--        card_type,
--        title,
--        title_en,
--        amount_cents,
--        valid_days,
--        voucher_code_prefix,
--        sort_order,
--        active
--   FROM public.gift_cards
--  WHERE merchant_id = '44b8bc03-f869-4715-9905-5d0e3e5ec93d'
--    AND active = TRUE
--  ORDER BY sort_order;

-- 3. Verify ST-GC-ALC card content matches spec exactly
-- SELECT id, title, title_en, description, description_en,
--        amount_cents, valid_days, voucher_code_prefix, sort_order, active
--   FROM public.gift_cards
--  WHERE merchant_id         = '44b8bc03-f869-4715-9905-5d0e3e5ec93d'
--    AND voucher_code_prefix = 'ST-GC-ALC';
-- Expected: 1 row, active=true, amount_cents=5000, sort_order=11, valid_days=365

-- 4. Verify ST-GC-FIX is now inactive (if deactivation was not skipped)
-- SELECT id, title, voucher_code_prefix, sort_order, active, updated_at
--   FROM public.gift_cards
--  WHERE merchant_id         = '44b8bc03-f869-4715-9905-5d0e3e5ec93d'
--    AND voucher_code_prefix = 'ST-GC-FIX';
-- Expected: 1 row, active=false

-- 5. Confirm ST-GC-FIX has no purchase or voucher history
-- SELECT
--     (SELECT COUNT(*)
--        FROM public.purchases
--       WHERE gift_card_id = '9dec3401-916c-43a9-9944-f0694b9adba2') AS purchase_count,
--     (SELECT COUNT(*)
--        FROM public.vouchers v
--        JOIN public.purchases p ON p.id = v.purchase_id
--       WHERE p.gift_card_id = '9dec3401-916c-43a9-9944-f0694b9adba2') AS voucher_count;
-- Expected: purchase_count=0, voucher_count=0

-- 6. Full card lineup including inactive — all cards for this merchant
-- SELECT id, title, voucher_code_prefix, sort_order, active, created_at, updated_at
--   FROM public.gift_cards
--  WHERE merchant_id = '44b8bc03-f869-4715-9905-5d0e3e5ec93d'
--  ORDER BY sort_order, created_at;
