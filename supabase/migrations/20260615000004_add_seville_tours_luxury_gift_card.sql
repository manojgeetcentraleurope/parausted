-- ============================================================
-- Migration: Add active luxury/private gift card for Seville Tours Co.
-- ParaUsted - Digital Gift Card SaaS
-- ============================================================
--
-- Context:
--   Merchant     : Seville Tours Co.
--   merchant_id  : 44b8bc03-f869-4715-9905-5d0e3e5ec93d
--   Slug         : seville-tours-co
--
-- Problem:
--   The luxury/private gift card could not be inserted previously because
--   the old inactive historical card (id: 51a75ecd-c4e7-4c7e-94fb-10599274dbf7)
--   already held voucher_code_prefix = 'ST-GC-LUX', and the caller assumed a
--   uniqueness conflict. No such unique constraint exists on
--   gift_cards.voucher_code_prefix. The column has only:
--     - NULL allowed (NULL = system default prefix 'PU')
--     - chk_voucher_code_prefix: format CHECK only (uppercase A-Z/0-9/hyphen,
--       length 2-20, no leading/trailing/consecutive hyphens, value <> 'PU')
--   There is NO UNIQUE INDEX and NO UNIQUE CONSTRAINT on voucher_code_prefix,
--   either globally or scoped per merchant_id.
--
-- Prefix decision: ST-GC-LUX (preferred, no conflict)
--   Rationale:
--     1. No DB constraint prevents reuse on a second card.
--     2. Individual voucher codes are globally unique (vouchers.code UNIQUE,
--        generated with cryptographic randomness via gen_random_bytes in the
--        confirm_purchase_and_issue_voucher / confirm_stripe_purchase RPCs).
--     3. The prefix is branding only — it appears as a human-readable prefix on
--        the voucher code string (e.g. ST-GC-LUX-XXXX-XXXX-XXXX). It is not a
--        unique identifier for a gift card or a purchase.
--     4. Old inactive card's existing vouchers retain full meaning. They remain
--        permanently associated with their original purchases and can still be
--        redeemed via redeem_voucher. Nothing in the redemption path looks up
--        the gift card by prefix — it always resolves by vouchers.code.
--     5. New luxury/private vouchers will bear the same ST-GC-LUX-* format,
--        which is the intended branding continuity for this tier.
--   The old inactive card is NOT renamed, NOT modified, NOT touched.
--
-- Safety:
--   - No explicit BEGIN/COMMIT. Supabase CLI wraps each migration file in its
--     own transaction automatically.
--   - DO block 1: Asserts merchant exists, slug = 'seville-tours-co', and
--     status = 'active'. Aborts the entire migration if any assertion fails.
--   - DO block 2: Inserts the new card ONLY when no active card at sort_order=30
--     already exists for this merchant (idempotent re-run guard).
--   - Does NOT touch: purchases, vouchers, redemptions, ledger_entries,
--     audit_events, delivery_events, or any inactive gift_cards row.
--
-- Card lineup after this migration:
--   sort_order=10  ST-GC-FIX  fixed_value   €50.00 fixed
--   sort_order=20  ST-GC-FLX  custom_value  €35.00 – €500.00 flexible
--   sort_order=30  ST-GC-LUX  custom_value  €100.00 – €1000.00 luxury/private
-- ============================================================


-- ── 1. Pre-insert assertions ──────────────────────────────────────────────────
--
-- Aborts migration (RAISE EXCEPTION rolls back the implicit transaction) if:
--   - The merchant UUID is not found in the merchants table.
--   - The merchant slug is not exactly 'seville-tours-co'.
--   - The merchant status is not 'active'.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    v_merchant_id  UUID := '44b8bc03-f869-4715-9905-5d0e3e5ec93d';
    v_slug         TEXT;
    v_status       TEXT;
BEGIN
    SELECT slug, status
      INTO v_slug, v_status
      FROM public.merchants
     WHERE id = v_merchant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'MIGRATION ABORT: merchant % not found in public.merchants.',
            v_merchant_id;
    END IF;

    IF v_slug <> 'seville-tours-co' THEN
        RAISE EXCEPTION
            'MIGRATION ABORT: slug mismatch. Expected seville-tours-co, got ''%''.',
            v_slug;
    END IF;

    IF v_status <> 'active' THEN
        RAISE EXCEPTION
            'MIGRATION ABORT: merchant % is not active (status = ''%'').',
            v_merchant_id, v_status;
    END IF;

    RAISE NOTICE
        'Pre-insert assertions passed: merchant_id=% slug=% status=%.',
        v_merchant_id, v_slug, v_status;
END;
$$;


-- ── 2. Conditional insert — idempotent ───────────────────────────────────────
--
-- Guard: if an active gift card at sort_order=30 already exists for this
-- merchant, log a notice and skip. sort_order=30 is reserved exclusively for
-- the luxury tier in the Seville Tours card lineup (fixed=10, flex=20, lux=30).
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    v_merchant_id  UUID := '44b8bc03-f869-4715-9905-5d0e3e5ec93d';
    v_existing_id  UUID;
BEGIN
    SELECT id
      INTO v_existing_id
      FROM public.gift_cards
     WHERE merchant_id = v_merchant_id
       AND active      = TRUE
       AND sort_order  = 30
     LIMIT 1;

    IF FOUND THEN
        RAISE NOTICE
            'Luxury/private card already active (id=%). No insert needed.',
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
        min_amount_cents,
        max_amount_cents,
        valid_days,
        voucher_code_prefix,
        sort_order,
        active
    ) VALUES (
        v_merchant_id,
        'custom_value',
        'Tarjeta regalo Luxury & Private Seville Tours Co.',
        'Luxury & Private Seville Tours Co. Gift Card',
        'Regala una experiencia privada o premium. La compra se completa de forma segura y los detalles de itinerario, fecha y planificación se coordinan con Seville Tours Co. después de la compra.',
        'Gift a private or premium experience. The purchase is completed securely and itinerary, date, and planning details are coordinated with Seville Tours Co. after purchase.',
        10000,
        100000,
        365,
        'ST-GC-LUX',
        30,
        TRUE
    );

    RAISE NOTICE
        'Luxury & Private gift card inserted successfully for merchant_id=%.',
        v_merchant_id;
END;
$$;


-- ============================================================
-- Post-migration verification queries
-- Run manually in psql or the Supabase SQL editor after supabase db push.
-- ============================================================

-- 1. Merchant identity — must return 1 row: name, slug, status=active
-- SELECT id, name, slug, status
--   FROM public.merchants
--  WHERE id = '44b8bc03-f869-4715-9905-5d0e3e5ec93d';

-- 2. All active gift cards ordered by sort_order — must return exactly 3 rows
-- SELECT id,
--        card_type,
--        title,
--        title_en,
--        amount_cents,
--        min_amount_cents,
--        max_amount_cents,
--        valid_days,
--        voucher_code_prefix,
--        sort_order,
--        active
--   FROM public.gift_cards
--  WHERE merchant_id = '44b8bc03-f869-4715-9905-5d0e3e5ec93d'
--    AND active = TRUE
--  ORDER BY sort_order;
-- Expected rows (sort_order / prefix / type):
--   10  ST-GC-FIX  fixed_value   amount_cents=5000
--   20  ST-GC-FLX  custom_value  min=3500  max=50000
--   30  ST-GC-LUX  custom_value  min=10000 max=100000

-- 3. Old inactive cards remain inactive — must return exactly 3 rows
-- SELECT id, title, active, voucher_code_prefix, sort_order, created_at
--   FROM public.gift_cards
--  WHERE merchant_id = '44b8bc03-f869-4715-9905-5d0e3e5ec93d'
--    AND active = FALSE
--  ORDER BY created_at;
-- Expected: the 3 historical cards (51a75ecd, 0f146885, db5df688) all active=false

-- 4. No duplicate active luxury card — must return count=1
-- SELECT COUNT(*), sort_order
--   FROM public.gift_cards
--  WHERE merchant_id = '44b8bc03-f869-4715-9905-5d0e3e5ec93d'
--    AND active = TRUE
--    AND sort_order = 30
--  GROUP BY sort_order;
-- Expected: count=1, sort_order=30

-- 5. Confirm voucher_code_prefix uniqueness is NOT a DB constraint
--    (no constraint means sharing ST-GC-LUX across inactive+active is safe)
-- SELECT conname, contype, pg_get_constraintdef(oid)
--   FROM pg_constraint
--  WHERE conrelid = 'public.gift_cards'::regclass
--  ORDER BY conname;
-- Expected: chk_voucher_code_prefix present as type='c' (check), NOT type='u' (unique)
