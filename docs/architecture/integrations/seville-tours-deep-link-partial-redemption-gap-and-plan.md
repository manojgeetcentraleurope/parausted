# Seville Tours × ParaUsted — Deep Links & Partial Redemption: Gap Analysis & Implementation Plan

**Project:** ParaUsted
**Integration:** Seville Tours Co. (`seville-tours-co`) → ParaUsted hosted gift-card flow
**Authors:** PM / PO / Architect (consolidated)
**Date:** 2026-06-17
**Status:** PROPOSED — pending sprint approval
**Companion docs:** `seville-tours-deep-link-partial-redemption-sprint-plan.md`,
`seville-tours-parausted-contract-audit-2026-06.md` (full cited Q1–Q7 audit + BLOCKERS)
**Source of truth:** Verified code/contract audit of the ParaUsted repo (see §8 evidence map)

---

## 1. Executive Summary

Seville Tours Co. drives gift-card buyers from its own brand site into ParaUsted's hosted
merchant page (`https://parausted.es/{es|en}/m/seville-tours-co`). Two strategic capabilities
are now requested:

1. **Deep links / cross-link prefill** — let the brand site link straight to a specific gift
   card (SKU), optionally preselecting amount/recipient and returning the buyer to the brand
   site after purchase.
2. **Partial redemption / balance** — let Seville Tours redeem a voucher for less than its full
   value (e.g. a €500 luxury card used across multiple tours), preserving the remaining balance.

This document captures, per system: **what exists today**, **what is missing (gaps)**, and the
**implementation plan on both systems** (ParaUsted platform + Seville Tours brand site).

**Bottom line:**
- The ParaUsted data model is *already shaped* for partial redemption (balance ledger, statuses,
  CHECK constraints) — but **no code path exercises it**. This is a low-risk, high-value addition.
- Deep links require a **new, validated query-param contract** plus **safe `return_url` handling**
  (open-redirect protection). Medium complexity, mostly additive.
- Neither change requires breaking existing flows; both are backward compatible.

---

## 2. System Map & Ownership

```text
┌─────────────────────────────┐        deep link (entry)        ┌──────────────────────────────┐
│  Seville Tours Co. (brand)   │ ───────────────────────────────▶ │  ParaUsted (hosted SaaS)      │
│  - marketing / gift modes    │                                  │  - merchant page /m/{slug}    │
│  - "Buy gift" CTAs           │                                  │  - product page .../gift-cards │
│  - (future) return landing   │ ◀─────────────────────────────── │  - purchase + payment + voucher│
└─────────────────────────────┘     return_url (after purchase)   │  - redemption + audit (truth) │
                                                                   └──────────────────────────────┘
```

| Concern                         | Owner            | Notes                                                   |
|---------------------------------|------------------|---------------------------------------------------------|
| Gift-card catalog / SKUs        | ParaUsted        | `gift_cards` rows, tenant-scoped to merchant            |
| Purchase / payment / voucher    | ParaUsted        | Source of truth, audit, ledger                          |
| Redemption (full & partial)     | ParaUsted        | RPC + dashboard UI                                      |
| Deep-link entry points          | Seville Tours    | Builds outbound URLs to ParaUsted                       |
| `return_url` allowlist          | ParaUsted        | Must validate against an allowlist (security boundary)  |
| Branded landing after purchase  | Seville Tours    | Receives buyer back, no PII passed in URL               |

---

## 3. Current State — What Exists in ParaUsted Today (verified)

### 3.1 Routing & URLs
- Merchant page: `/{locale}/m/{slug}` — **EXISTS**. Param is `slug`, merchant must be `status='active'`.
- Product (SKU) page: `/{locale}/m/{slug}/gift-cards/{giftCardId}` — **EXISTS**. `giftCardId` is the
  `gift_cards` UUID, tenant-scoped (`.eq('id').eq('merchant_id').eq('active', true)`).
- Locales: `es` (default), `en` only. Unknown locale → proxy prefixes `es`; unsupported `[locale]`
  segment at page level → `notFound()` (404).
- Product page already reads **only** `searchParams = { checkout, session_id }` (Stripe return).

### 3.2 Data Model
- `gift_cards` (the offer): `id UUID`, `merchant_id`, `card_type` (`fixed_value|custom_value|service`),
  `title`, `amount_cents`, `min_amount_cents`, `max_amount_cents`, `valid_days (>=365)`, `active`,
  plus `voucher_code_prefix` (branding only — **not** unique, **not** an identifier).
- `vouchers` (the instrument): `id UUID`, `purchase_id UNIQUE`, `merchant_id`, `code TEXT UNIQUE`,
  `qr_data`, `original_amount_cents`, `balance_cents`, `status`, `expires_at`, `created_at`.
  **No currency column** (EUR implicit).
- **Voucher code:** crypto-random via `gen_random_bytes`, format `PREFIX-XXXX-XXXX-XXXX`
  (default prefix `PU`; branded e.g. `ST-GC-LUX`). Charset uppercase hex `0-9A-F`; suffix = 12 hex
  chars = 6 random bytes = **48 bits entropy**. Generated server-side inside the SECURITY DEFINER
  issuance RPC (`confirm_purchase_and_issue_voucher` / Stripe equivalent), only after payment
  confirmation. `qr_data` mirrors the code. It is the stable, URL-usable identifier (`/v/{code}`),
  **not** the DB UUID.
- `redemptions` (append-only ledger): `amount_cents`, `balance_before`, `balance_after`, with
  CHECK constraints `balance_after = balance_before - amount_cents` and `balance_before >= amount_cents`.

### 3.3 Redemption
- Only `redeem_voucher_full(p_voucher_code, p_notes)` exists. It **zeroes balance** and sets
  `status='redeemed'` in one shot. Authenticated merchant only (`GRANT EXECUTE ... TO authenticated`).
- Voucher status machine (CHECK): `issued, delivered, partially_redeemed, redeemed, exchanged, expired, voided`.
  Redeemable-from: `issued | delivered | partially_redeemed`. The `partially_redeemed` state is
  **defined but never produced**.
- Public read RPC `get_public_voucher_page(p_code)` returns display-only fields (no PII, no redeem).

### 3.4 Notifications, Invoicing, Currency
- **No** merchant new-purchase notification (email/webhook/push). Discovery is dashboard-only.
- **No** invoice/factura generation (purchase or refund). No numbering sequence anywhere.
- **No** external/partner API or outbound webhook for lookup/validate/redeem.
- **No** currency field (EUR only).

---

## 4. Current State — What Exists on the Seville Tours Side ("with you")

> Per the existing handoff (`seville-tours-parausted-hosted-gift-flow-handoff.md`), Seville Tours
> already owns the branded acquisition funnel and links buyers into ParaUsted. The following is the
> assumed/required baseline on the brand site for the new work.

| Capability                                   | Status on brand site | Needed for this work |
|----------------------------------------------|----------------------|----------------------|
| Branded gift CTAs linking to `/m/seville-tours-co` | EXISTS          | Reused                |
| Knowledge of specific `gift_cards` UUIDs (SKUs)   | NOT CONFIRMED   | Required for deep links |
| Outbound deep-link builder (amount/recipient)     | MISSING         | Build in Sprint       |
| Post-purchase return landing page                 | MISSING         | Build in Sprint       |
| POS/staff tool to redeem (partial) at point of service | MISSING (uses ParaUsted dashboard) | Optional / phase 2 |

**Key constraint:** Seville Tours must **not** put PII (buyer/recipient email, phone) in inbound
deep-link URLs. Prefill of *recipient name* and *amount* may be acceptable (non-sensitive), but
PII prefill is out of scope for privacy-by-design reasons.

---

## 5. Gap Analysis (consolidated)

### 5.1 Deep Links / Cross-Link Prefill
| # | Gap | System | Severity | Type |
|---|-----|--------|----------|------|
| D1 | No validated query-param contract on product/merchant pages (`amount`, `recipient_name`, `sender_name`, `message`, `return_url`, `utm_*`) | ParaUsted | High | Additive |
| D2 | No short/stable product slug — only UUID product URLs | ParaUsted | Medium | Additive (optional) |
| D3 | No `return_url` post-purchase redirect-back mechanism | Both | High | Additive |
| D4 | No open-redirect-safe external `return_url` allowlist (only internal `/`-paths trusted today) | ParaUsted | High (security) | Additive |
| D5 | Brand site has no deep-link builder / return landing | Seville Tours | High | Additive |

### 5.2 Partial Redemption / Balance
| # | Gap | System | Severity | Type |
|---|-----|--------|----------|------|
| P1 | No `redeem_voucher_partial` RPC; only full redeem exists | ParaUsted | High | Additive |
| P2 | No dashboard UI to enter a partial amount | ParaUsted | High | Additive |
| P3 | No standalone "validate / look up redeemable balance" merchant call | ParaUsted | Medium | Additive |
| P4 | `partially_redeemed` status defined but never set | ParaUsted | (resolved by P1) | — |

### 5.3 Operational / Out-of-Scope-but-Noted
| # | Gap | System | Decision |
|---|-----|--------|----------|
| O1 | No merchant new-purchase notification | ParaUsted | Track separately (not in this scope) |
| O2 | No external/partner redeem API or outbound webhook | ParaUsted | Phase 2 (only if POS integration needed) |
| O3 | No invoice/factura generation | ParaUsted | Track separately (legal/compliance backlog) |
| O4 | No currency field (EUR only) | ParaUsted | Out of scope (single currency MVP) |

---

## 6. Target Design

### 6.1 Deep-Link Query Param Contract (ParaUsted product page)
Add an **optional, validated** searchParams contract to
`/{locale}/m/{slug}/gift-cards/{giftCardId}` (and minimal support on `/{locale}/m/{slug}`):

| Param            | Type / Rule                                              | Behavior |
|------------------|----------------------------------------------------------|----------|
| `amount`         | integer cents; clamped to card min/max; ignored for fixed | Prefill custom amount |
| `recipient_name` | string ≤ 80, sanitized, **non-PII**                       | Prefill recipient field |
| `sender_name`    | string ≤ 80, sanitized                                   | Prefill sender field |
| `message`        | string ≤ 200, sanitized                                  | Prefill personal message |
| `return_url`     | absolute URL, **allowlist-checked** (host must match)    | Stored for post-purchase redirect |
| `utm_*`          | passthrough, stored for attribution                      | Analytics only |

Rules (enforced with **Zod**, server-side):
- All params **optional**; invalid values are **dropped silently**, never error.
- **No PII** params accepted (`recipient_email`, `*_phone` are rejected/ignored).
- `amount` clamped to `[min_amount_cents, max_amount_cents]`; ignored when `card_type='fixed_value'`.
- `return_url` validated against an **allowlist** (e.g. `sevilletours.com`, configured via env).
  Reject anything not on the allowlist; never redirect to arbitrary hosts (OWASP A01/A10).

### 6.2 `return_url` Handling (security boundary — ParaUsted)
- New helper `getSafeExternalReturnUrl(url, allowlist)` alongside existing
  `getSafeInternalNextPath`. Must:
  - require `https://`,
  - parse and match host against allowlist (exact host or configured suffix),
  - strip credentials / fragments,
  - never carry PII in the appended params.
- On purchase success, append only **non-sensitive** confirmation params (e.g. `status=success`,
  optionally a voucher *code* only if product owner approves — default: no code in URL).

### 6.3 Partial Redemption (ParaUsted)
New RPC `redeem_voucher_partial(p_voucher_code TEXT, p_amount_cents INTEGER, p_notes TEXT)`:
- Auth: authenticated merchant; `merchant_id` from `auth.uid()` (never from client).
- Validate code format (reuse existing regex), `p_amount_cents > 0`.
- `SELECT ... FOR UPDATE` the voucher in merchant scope.
- Reject terminal states (`redeemed/expired/voided/exchanged`) and expiry.
- Enforce `p_amount_cents <= balance_cents`.
- Compute `new_balance = balance_cents - p_amount_cents`.
- `status = new_balance > 0 ? 'partially_redeemed' : 'redeemed'`.
- CAS update guarded by `balance_cents = balance_before` to prevent double-spend.
- Insert `redemptions` row (`amount_cents`, `balance_before`, `balance_after`); insert `audit_events`.
- Idempotency: accept optional `idempotency_key` (table already has `UNIQUE` column).
- Permissions: `REVOKE ... FROM anon; GRANT EXECUTE ... TO authenticated`.

> No schema migration to constraints is required — existing CHECKs and the `partially_redeemed`
> status already support this. Only a new function + grants.

Dashboard UI: amount input on the redemption manager; show remaining balance; full-redeem button
remains (calls existing full RPC or partial with full amount).

### 6.4 Seville Tours Brand Site
- **Deep-link builder:** generate URLs like
  `https://parausted.es/es/m/seville-tours-co/gift-cards/{uuid}?amount=10000&return_url=https://sevilletours.com/gift/thanks`.
  Store the small set of `gift_cards` UUIDs (3 SKUs) as config constants.
- **Return landing page:** `/gift/thanks` reading only non-PII confirmation params; shows a friendly
  "thank you" and a link to the voucher page if a code is provided (optional).

---

## 7. Implementation Plan — Both Systems

### Phase A — Partial Redemption (ParaUsted only) — lowest risk, high value
1. Migration: `redeem_voucher_partial` RPC (+ grants, audit, idempotency).
2. Server action `redeemVoucherPartial(code, amountCents, notes?)` with rate limiting (reuse pattern).
3. Dashboard redemption UI: amount field, validation, balance display, success/partial states.
4. Tests: RPC happy path (partial → `partially_redeemed`, then exhaust → `redeemed`), over-balance
   reject, terminal-state reject, concurrency/double-spend (CAS), auth failure.

### Phase B — Deep-Link Param Contract (ParaUsted)
1. Zod schema `deepLinkParamsSchema` (drop-invalid, no PII).
2. Product page: parse `searchParams`, clamp `amount`, prefill form fields.
3. `return_url` allowlist helper + env var `PARAUSTED_RETURN_URL_ALLOWLIST`.
4. Persist `return_url`/`utm_*` through purchase (metadata) so success can redirect back.
5. Tests: clamping, invalid-drop, allowlist accept/reject, PII rejection, fixed-card amount ignore.

### Phase C — Return-to-Brand Redirect (ParaUsted)
1. On purchase success path, if a safe `return_url` exists, render a "Return to Seville Tours" CTA
   (default) or auto-redirect (product-owner decision). No PII appended.
2. Tests: only allowlisted hosts redirect; no PII leakage.

### Phase D — Seville Tours Brand Site
1. Add SKU UUID config + deep-link builder utility.
2. Update gift CTAs to use deep links (amount/recipient prefill where useful).
3. Build `/gift/thanks` return landing.
4. QA the full round trip in staging.

### Phase E (optional / Phase 2) — Partner Validate/Lookup
- If Seville Tours needs POS-side validation without the merchant dashboard, design an authenticated
  machine-to-machine "validate balance" endpoint (scoped token). **Not** in the core sprint.

---

## 8. Evidence Map (verified files)

| Claim | File |
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
| Delivery (recipient-targeted) | `supabase/migrations/20260610165000_queue_delivery_event_on_voucher_insert.sql` |
| Prefix is branding-only | `supabase/migrations/20260615000004_add_seville_tours_luxury_gift_card.sql` |

---

## 9. Risks & Decisions Needed

| # | Risk / Decision | Recommendation |
|---|-----------------|----------------|
| R1 | Open redirect via `return_url` | **Allowlist only**; reject all non-listed hosts. Non-negotiable. |
| R2 | PII in deep-link URLs | **Reject** PII params; prefill non-sensitive fields only. |
| R3 | Voucher code in return URL | Default **no**; product owner to decide. |
| R4 | Partial-redeem double-spend | CAS update guarded by `balance_cents = balance_before` + `FOR UPDATE`. |
| R5 | Short product slugs (D2) | Defer; UUID links work. Add later if marketing needs clean URLs. |
| R6 | Scope creep (invoicing, notifications) | Keep O1/O3 in separate backlog; not in this sprint. |

---

## 10. Definition of Done
- Partial redemption usable end-to-end from the merchant dashboard, fully audited and concurrency-safe.
- Deep links prefill product page safely; invalid/PII params ignored; `return_url` allowlist enforced.
- Buyer can be returned to Seville Tours after purchase with no PII leakage.
- `npx tsc --noEmit` and `npm run lint` pass; new RPC has migration + tests; manual round-trip QA done.
