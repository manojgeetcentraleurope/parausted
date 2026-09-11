# Verified Contract Audit — ParaUsted (Seville Tours Deep-Link & Partial Redemption)

**Project:** ParaUsted
**Merchant:** Seville Tours Co. (`seville-tours-co`)
**Type:** READ-ONLY research audit (no code changed)
**Date:** 2026-06-18
**Companion docs:**
`seville-tours-deep-link-partial-redemption-gap-and-plan.md`,
`seville-tours-deep-link-partial-redemption-sprint-plan.md`

> Every answer below is verified against the actual source. File paths are cited and code is
> quoted. Where a capability does not exist, it is marked **NOT FOUND** explicitly.

---

## 1. MERCHANT / PRODUCT URLs

**Merchant page route — CONFIRMED.** `/{locale}/m/{slug}` is correct (param is `slug`, not `shortname`).

File: `src/app/[locale]/m/[slug]/page.tsx`
```ts
type MerchantPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};
```
Merchant resolved by `slug`, must be `status = 'active'`:
```ts
.from('merchants').select(...).eq('slug', slug).eq('status', 'active').single();
```

**Locales supported:** only `es` and `en`; `es` is default. File: `src/lib/i18n/config.ts`
```ts
export const SUPPORTED_LOCALES = ['es', 'en'] as const;
export const DEFAULT_LOCALE = 'es' as const;
```

**Unknown locale behavior:** Two layers.
- Middleware/proxy: a path whose first segment isn't a known locale is *prefixed* with `es` and
  redirected (it does not 404 at the edge). File: `src/proxy.ts`
```ts
const locale = getLocaleFromPathname(pathname);
if (!locale) {
  redirectUrl.pathname = `/${DEFAULT_LOCALE}${pathname}`;
  return NextResponse.redirect(redirectUrl);
}
```
- Page-level: if the `[locale]` segment is present but unsupported, the page calls `notFound()` (404).
  File: `src/app/[locale]/m/[slug]/page.tsx`
```ts
if (!isSupportedLocale(locale)) {
  notFound();
}
```

**Single gift-card / SKU URL — CONFIRMED EXISTS.** Pattern: `/{locale}/m/{slug}/gift-cards/{giftCardId}`.

Defined by route folder `src/app/[locale]/m/[slug]/gift-cards/[giftCardId]/page.tsx` and linked from
the merchant page. File: `src/app/[locale]/m/[slug]/page.tsx`
```tsx
<Link href={`/${locale}/m/${merchant.slug}/gift-cards/${card.id}`} ...>
```
The `{giftCardId}` is the **`gift_cards` UUID** (the product/SKU), tenant-scoped:
```ts
.eq('id', giftCardId).eq('merchant_id', merchantId).eq('active', true)
```

There is **NO** `/p/{slug}` short product URL and **no human-friendly product slug** — only the
UUID-based path above.

---

## 2. GIFT-CARD / VOUCHER DATA MODEL

Two distinct tables: **`gift_cards`** (the product/offer) and **`vouchers`** (the issued instrument).

**`gift_cards`** — File: `supabase/migrations/20260605162531_create_gift_cards.sql`
- `id UUID PK` (DB-generated), `merchant_id UUID`, `card_type` (`fixed_value|custom_value|service`),
  `title`, `amount_cents`, `min_amount_cents`, `max_amount_cents`,
  `valid_days INTEGER NOT NULL DEFAULT 365 CHECK (valid_days >= 365)`, `active BOOLEAN`.
- A later migration adds **`voucher_code_prefix`** (branding only — e.g. `ST-GC-LUX`). It is
  **NOT unique** and **NOT an identifier**.
  File: `supabase/migrations/20260615000004_add_seville_tours_luxury_gift_card.sql`
  > "The prefix is branding only … It is not a unique identifier for a gift card or a purchase."

**`vouchers`** — File: `supabase/migrations/20260605200725_create_vouchers.sql`
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
purchase_id UUID UNIQUE NOT NULL REFERENCES purchases(id),
merchant_id UUID NOT NULL REFERENCES merchants(id),
code TEXT UNIQUE NOT NULL,
qr_data TEXT NOT NULL,
original_amount_cents INTEGER NOT NULL CHECK (original_amount_cents > 0),
balance_cents INTEGER NOT NULL CHECK (balance_cents >= 0),
status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN
  ('issued','delivered','partially_redeemed','redeemed','exchanged','expired','voided')),
issued_at TIMESTAMPTZ ... expires_at TIMESTAMPTZ NOT NULL,
... CONSTRAINT balance_not_exceeds_original CHECK (balance_cents <= original_amount_cents)
```
- Currency: **no currency column** — EUR is implicit (MVP). Money is integer cents throughout.
- `created_at TIMESTAMPTZ` present; `expires_at` computed at issuance from `gift_cards.valid_days`.

**Card identifier / voucher code:** The voucher `code` is the human/stable code the buyer receives
and is URL-usable (`/{locale}/v/{code}`). It is **NOT** the DB UUID.

**Voucher code format & generation:** Generated server-side inside the issuance RPC using
cryptographic randomness. Default format `PU-XXXX-XXXX-XXXX` (3 groups of 4 uppercase hex),
optionally a custom branded prefix (e.g. `ST-GC-LUX-XXXX-XXXX-XXXX`).
File: `supabase/migrations/20260609100000_confirm_purchase_and_issue_voucher.sql`
```sql
v_hex := upper(encode(extensions.gen_random_bytes(6), 'hex'));
v_voucher_code := 'PU-' || substr(v_hex,1,4) || '-' || substr(v_hex,5,4) || '-' || substr(v_hex,9,4);
```
- **Charset:** uppercase hex `0-9A-F`.
- **Length / entropy:** suffix is 12 hex chars = 6 random bytes = **48 bits** of entropy (plus prefix).
- **Where generated:** inside the SECURITY DEFINER issuance RPC (`confirm_purchase_and_issue_voucher`,
  and the Stripe equivalent), only after payment confirmation.
- `qr_data` is set to the same code string.

Public page validation regex confirms the accepted format. File: `src/app/[locale]/v/[code]/page.tsx`
```ts
const safeCode = /^[A-Z0-9]+(-[A-Z0-9]+)*-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/i.test(code)
  ? code.toUpperCase() : null;
```

---

## 3. REDEMPTION CONTRACT (most important)

**How redeemed today: FULL-BALANCE ONLY. Partial/multi-use is NOT implemented.** The only redemption
RPC zeroes the balance and marks `redeemed` in one shot.
File: `supabase/migrations/20260609114236_create_redeem_voucher_rpc.sql`
```sql
-- V1 supports full remaining-balance redemption only.
-- Partial redemption, QR scanning, and staff roles are deferred.
```
```sql
UPDATE vouchers SET balance_cents = 0, status = 'redeemed'
WHERE id = v_voucher.id AND merchant_id = v_merchant_id
  AND balance_cents = v_balance_before
  AND status IN ('issued','delivered','partially_redeemed');
```
> The schema *supports* a `partially_redeemed` status and a `redemptions` ledger with
> `balance_before/after`, but **no code path ever produces a partial redemption** today.

**State machine (`voucher.status`):**
- Statuses (CHECK): `issued`, `delivered`, `partially_redeemed`, `redeemed`, `exchanged`, `expired`,
  `voided`. File: `supabase/migrations/20260605200725_create_vouchers.sql`
- Issuance sets `issued`. File: `supabase/migrations/20260609100000_confirm_purchase_and_issue_voucher.sql`
- Redeemable-from states: `issued | delivered | partially_redeemed` → `redeemed`.
  Terminal/blocked: `redeemed`, `expired`, `voided`, `exchanged`.
  File: `supabase/migrations/20260609114236_create_redeem_voucher_rpc.sql`
- `delivered`, `exchanged`, `expired` transitions are defined as states but **no application code sets
  `delivered` or `exchanged`** (delivery worker records `delivery_events`, not voucher.status flips;
  see §6). The redemption manager only does the full-redeem transition.
  File: `src/app/[locale]/dashboard/redemptions/actions.ts`

**API/endpoint for merchants to look up / validate / redeem:**
- There is **NO public REST/HTTP API** for lookup/validate/redeem. There is **NO external merchant API**.
- Redemption is a Supabase **RPC** `redeem_voucher_full(p_voucher_code, p_notes)`, callable **only by
  `authenticated`** (the logged-in merchant), invoked via a Next.js Server Action. Method = Supabase
  RPC (POST under the hood); **auth = merchant Supabase session**, `merchant_id` derived from
  `auth.uid()`. File: `supabase/migrations/20260609114236_create_redeem_voucher_rpc.sql`
```sql
REVOKE ALL ... FROM anon;
GRANT EXECUTE ON FUNCTION public.redeem_voucher_full(TEXT, TEXT) TO authenticated;
```
- (a) Look up by code: public read RPC `get_public_voucher_page(p_code)` exists (granted to
  `anon`/`authenticated`) but returns **only display fields** and **does not validate redeemability
  nor expose redeem**.
  File: `supabase/migrations/20260613000003_accept_custom_prefix_in_lookup_and_redemption.sql`
- (b) Validate: **NOT FOUND** as a standalone endpoint (validation only happens inside
  `redeem_voucher_full`).
- (c) Mark redeemed: `redeem_voucher_full` RPC, authenticated merchant only.

**Who can trigger redemption:** Only the **authenticated merchant** via the dashboard redemptions UI.
NOT buyer, NOT recipient, NOT webhook, NOT admin.
Files: `src/app/[locale]/dashboard/redemptions/redemption-manager.tsx`,
`supabase/migrations/20260609114236_create_redeem_voucher_rpc.sql` (RPC auth check requires
`merchants.auth_user_id = auth.uid()`).

---

## 4. PARTIAL REDEMPTION / BALANCE

**Balance-ledger concept EXISTS in the data model but is unused for partial redemption.**
- `vouchers.balance_cents` tracks remaining value; `redemptions` is an append-only ledger with
  `amount_cents`, `balance_before`, `balance_after` and integrity CHECKs.
  File: `supabase/migrations/20260605200913_create_redemptions.sql`
```sql
amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
balance_before INTEGER NOT NULL CHECK (balance_before >= 0),
balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
CONSTRAINT consistent_balance CHECK (balance_after = balance_before - amount_cents),
CONSTRAINT sufficient_balance CHECK (balance_before >= amount_cents)
```
- The **only writer always passes `amount_cents = full balance` and forces `balance_after = 0,
  status = 'redeemed'`**. File: `supabase/migrations/20260609114236_create_redeem_voucher_rpc.sql`

**What's required to add partial redemption:** a new RPC (e.g.
`redeem_voucher_partial(code, amount_cents)`) that validates `0 < amount <= balance_cents`; locks the
row with `SELECT ... FOR UPDATE`; sets `balance_cents = balance - amount`; sets
`status = 'partially_redeemed'` when remainder > 0 else `redeemed`; inserts the `redemptions` row with
the partial `amount_cents`; audits. The CHECK constraints and `partially_redeemed` status already
support this — **no schema migration is strictly required**, only a new RPC plus dashboard UI to enter
an amount.

---

## 5. INVOICING / LEGAL

**NOT FOUND.** No invoice/factura artifacts are generated on purchase or refund. No `invoice` /
`factura` / `rectificativa` table, column, numbering sequence, or generator exists anywhere in
`supabase/migrations/` or `src/`.
- Code search for `invoice|receipt|factura` in `src/` returns only one unrelated legal-copy string
  (no generation). File: `src/app/[locale]/legal/page.tsx`
- Docs reference "buyer receipts" only as **future/V1.5** items (e.g. Resend email spec), not
  implemented. File: `docs/architecture/integration-specs/resend-email.md`
- Therefore: **no** `factura simplificada/completa/rectificativa`, **no** numbering, **no**
  sequential/race-safe counter exists today.

---

## 6. MERCHANT NOTIFICATION

**NOT FOUND (not implemented).** When a gift card for `seville-tours-co` is purchased, the merchant is
**not** notified by email or webhook. Discovery is **dashboard-only** (the merchant views their pending
purchases / dashboard).
- The voucher-issuance trigger queues a `delivery_events` row aimed at the **recipient/buyer**, never
  the merchant. File: `supabase/migrations/20260610165000_queue_delivery_event_on_voucher_insert.sql`
  (channels resolve to recipient/buyer email/phone only).
- Multiple docs explicitly list merchant new-purchase notification as **not yet enabled / V1.5**.
  Files: `docs/architecture/integration-specs/v1-production-readiness-limitations.md`
  ("Merchant notification for new pending purchases is not yet enabled."),
  `docs/PRD/ParaUsted_PRD_Sprint_Review_Notes.md`.

---

## 7. CROSS-LINK PARAMETERS

**Merchant page (`/m/{slug}`): NOT FOUND — accepts no query params.** Its props type is only
`{ locale, slug }`; there is no `searchParams`. File: `src/app/[locale]/m/[slug]/page.tsx`.
A search for `searchParams|preselect|return_url|prefill|gift_card_id` under `src/app/[locale]/m/**`
returned no matches → any inbound query params (preselected product, amount, recipient, return URL,
PII) are **silently ignored**.

**Product page (`/m/{slug}/gift-cards/{giftCardId}`): accepts only Stripe checkout-return params**, not
deep-link prefill params. File: `src/app/[locale]/m/[slug]/gift-cards/[giftCardId]/page.tsx`
```ts
searchParams?: Promise<{ checkout?: string; session_id?: string }>;
```
Only `checkout` (`success|cancelled`) and `session_id` (`cs_…`) are read; everything else is ignored.
No `amount`, `recipient`, `email`, `gift_card_id`, or `return_url` prefill is supported.

**PII / amount / gift_card_id in inbound URL:** **Not supported — ignored.** The product is selected
via the path segment `giftCardId` (not a query param), and no buyer/recipient/amount prefill from URL
exists. Passing PII in the URL would be ignored (and is undesirable for privacy).

---

## BLOCKERS FOR DEEP LINKS & PARTIAL REDEMPTION

What does NOT exist yet that Seville Tours would need:

**Deep links / cross-link prefill**
1. No query-param contract on either the merchant page or product page (no `amount`,
   `recipient_name`, `recipient_email`, `sender_name`, `message`, `return_url`, `utm_*` prefill).
   Inbound params are ignored.
2. No short/stable product slug — only UUID product URLs (`…/gift-cards/{uuid}`). Seville Tours must
   hardcode/store the gift_card UUIDs to deep-link to a SKU.
3. No `return_url` / post-purchase redirect-back mechanism to send buyers back to the Seville Tours
   brand site.
4. No signed/validated inbound parameter handling — adding prefill would require Zod validation +
   open-redirect-safe `return_url` handling (only internal `/`-prefixed paths are currently treated as
   safe; an external brand-site return URL would need an allowlist).

**Partial redemption / balance**
5. No partial-redemption RPC or UI — only `redeem_voucher_full` (zeroes balance). The
   `partially_redeemed` status and `redemptions` ledger exist but are never exercised; a new
   `redeem_voucher_partial(code, amount_cents)` RPC + amount-input UI is required.
6. No merchant-facing API to look up / validate a voucher independently of redeeming it (the public
   lookup RPC returns display data only and doesn't assert redeemability).

**Operational / integration gaps**
7. No merchant notification (email/webhook/push) on new purchase — Seville Tours can't be alerted
   programmatically; dashboard polling only.
8. No external/partner API or webhook out — there is no authenticated machine-to-machine endpoint a
   brand site or POS could call to look up, validate, or redeem a voucher; all redemption requires an
   interactive merchant Supabase session.
9. No invoicing/factura generation (purchase or refund) — required for Spanish legal compliance if
   Seville Tours needs facturas; numbering/sequence is entirely absent.
10. No currency field on vouchers — EUR is implicit; multi-currency deep links unsupported.

---

## Evidence Map (files inspected)

| Topic | File |
|-------|------|
| Merchant page route/params | `src/app/[locale]/m/[slug]/page.tsx` |
| Product (SKU) page + searchParams | `src/app/[locale]/m/[slug]/gift-cards/[giftCardId]/page.tsx` |
| Locale config | `src/lib/i18n/config.ts` |
| Unknown-locale proxy behavior | `src/proxy.ts` |
| Vouchers schema/status | `supabase/migrations/20260605200725_create_vouchers.sql` |
| Gift cards schema | `supabase/migrations/20260605162531_create_gift_cards.sql` |
| Redemptions ledger | `supabase/migrations/20260605200913_create_redemptions.sql` |
| Full redeem RPC | `supabase/migrations/20260609114236_create_redeem_voucher_rpc.sql` |
| Voucher code generation | `supabase/migrations/20260609100000_confirm_purchase_and_issue_voucher.sql` |
| Public voucher lookup RPC | `supabase/migrations/20260613000003_accept_custom_prefix_in_lookup_and_redemption.sql` |
| Redemption server action | `src/app/[locale]/dashboard/redemptions/actions.ts` |
| Redemption UI | `src/app/[locale]/dashboard/redemptions/redemption-manager.tsx` |
| Delivery (recipient-targeted) | `supabase/migrations/20260610165000_queue_delivery_event_on_voucher_insert.sql` |
| Prefix is branding-only | `supabase/migrations/20260615000004_add_seville_tours_luxury_gift_card.sql` |
| Voucher code validation regex | `src/app/[locale]/v/[code]/page.tsx` |
| No invoice in src | `src/app/[locale]/legal/page.tsx` |
