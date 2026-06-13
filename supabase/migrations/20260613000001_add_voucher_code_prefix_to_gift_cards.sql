-- Slice 2: Add voucher_code_prefix column to gift_cards.
--
-- Purpose:
--   Allow merchants to configure a branded voucher code prefix per gift card.
--   Example: ST-GC-PRV, ST-GC-LUX.
--   NULL means use the system default prefix PU.
--
-- Rules:
--   - Column is optional (NULL allowed). Existing rows are unaffected.
--   - No default value. NULL is the intentional no-prefix signal.
--   - No data backfill.
--   - PU is reserved as the system default and is rejected as a custom prefix.
--   - When not null: uppercase A-Z and digits 0-9 and hyphen only;
--     no leading or trailing hyphen; no consecutive hyphens;
--     length 2 to 20 characters.
--   - RPC changes are in a separate slice.

ALTER TABLE public.gift_cards
    ADD COLUMN voucher_code_prefix TEXT NULL;

ALTER TABLE public.gift_cards
    ADD CONSTRAINT chk_voucher_code_prefix CHECK (
        voucher_code_prefix IS NULL
        OR (
            voucher_code_prefix ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'
            AND length(voucher_code_prefix) BETWEEN 2 AND 20
            AND voucher_code_prefix <> 'PU'
        )
    );

COMMENT ON COLUMN public.gift_cards.voucher_code_prefix IS
    'Optional branded voucher code prefix. NULL defaults to PU. Must be uppercase A-Z, 0-9, hyphen. No leading/trailing/consecutive hyphens. Length 2-20. PU is reserved.';

-- ---------------------------------------------------------------------------
-- Verification queries (run manually after migration)
-- ---------------------------------------------------------------------------

-- Verify column exists:
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'gift_cards'
--   AND column_name = 'voucher_code_prefix';
-- Expected: 1 row, data_type = 'text', is_nullable = 'YES'

-- Verify CHECK constraint exists:
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.gift_cards'::regclass
--   AND conname = 'chk_voucher_code_prefix';
-- Expected: 1 row showing the constraint definition

-- Verify PU is rejected:
-- INSERT INTO gift_cards (..., voucher_code_prefix) VALUES (..., 'PU');
-- Expected: ERROR - new row violates check constraint "chk_voucher_code_prefix"

-- Verify valid prefix accepted:
-- UPDATE gift_cards SET voucher_code_prefix = 'ST-GC-LUX' WHERE id = '<test-id>';
-- Expected: UPDATE 1

-- Verify valid short prefix accepted:
-- UPDATE gift_cards SET voucher_code_prefix = 'AB' WHERE id = '<test-id>';
-- Expected: UPDATE 1

-- Verify invalid lowercase prefix rejected:
-- UPDATE gift_cards SET voucher_code_prefix = 'st-gc-lux' WHERE id = '<test-id>';
-- Expected: ERROR - new row violates check constraint "chk_voucher_code_prefix"

-- Verify leading hyphen rejected:
-- UPDATE gift_cards SET voucher_code_prefix = '-ST-GC' WHERE id = '<test-id>';
-- Expected: ERROR - new row violates check constraint "chk_voucher_code_prefix"

-- Verify trailing hyphen rejected:
-- UPDATE gift_cards SET voucher_code_prefix = 'ST-GC-' WHERE id = '<test-id>';
-- Expected: ERROR - new row violates check constraint "chk_voucher_code_prefix"

-- Verify consecutive hyphens rejected:
-- UPDATE gift_cards SET voucher_code_prefix = 'ST--GC' WHERE id = '<test-id>';
-- Expected: ERROR - new row violates check constraint "chk_voucher_code_prefix"

-- Verify space rejected:
-- UPDATE gift_cards SET voucher_code_prefix = 'ST GC LUX' WHERE id = '<test-id>';
-- Expected: ERROR - new row violates check constraint "chk_voucher_code_prefix"

-- Verify 21-char string rejected:
-- UPDATE gift_cards SET voucher_code_prefix = 'ABCDEFGHIJKLMNOPQRSTU' WHERE id = '<test-id>';
-- Expected: ERROR - new row violates check constraint "chk_voucher_code_prefix"

-- Verify NULL accepted (existing rows and explicit null set):
-- UPDATE gift_cards SET voucher_code_prefix = NULL WHERE id = '<test-id>';
-- Expected: UPDATE 1

-- Verify existing rows with NULL pass constraint (no rows should violate):
-- SELECT id FROM gift_cards WHERE voucher_code_prefix IS NOT NULL
--   AND NOT (
--     voucher_code_prefix ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$'
--     AND length(voucher_code_prefix) BETWEEN 2 AND 20
--     AND voucher_code_prefix <> 'PU'
--   );
-- Expected: 0 rows
