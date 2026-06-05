# ParaUsted — GitHub Copilot Instructions

> These rules apply to EVERY code generation in this repository.
> Full PRD: `docs/PRD/ParaUsted_Gold_Class_PRD.md`

## Product Context

ParaUsted is a digital gift card SaaS platform for local businesses in Spain.
Merchants (barbers, restaurants, tour operators) create personalized gift cards.
Buyers purchase them (online via Stripe or offline via Bizum/cash/bank).
Recipients receive and redeem them. No recipient account needed.

## Architecture

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS
- **Backend:** Next.js API Routes + Supabase Edge Functions
- **Database:** Supabase Postgres (EU Frankfurt) with Row Level Security
- **Auth:** Supabase Auth (Email/Password + Magic Link + Google OAuth)
- **Payments:** Stripe Connect (Express) for online. Direct Bizum/cash/bank for offline.
- **Storage:** Supabase Storage (PDFs, logos)
- **Email:** Resend
- **WhatsApp:** Meta Business API (backend-only)

## Critical Rules — NEVER Violate

### Database & Data

- All monetary amounts in **INTEGER cents**. NEVER use floating point for money.
- Every table with `merchant_id` MUST have RLS policy enforcing tenant isolation.
- `merchant_id` is ALWAYS extracted from JWT/auth session. NEVER from request body or URL params.
- Voucher codes: `crypto.randomUUID()` or `crypto.randomBytes()`. NEVER sequential. NEVER `Math.random()`.
- `ledger_entries`, `audit_events`, `security_events` are **APPEND-ONLY**. No UPDATE. No DELETE.
- Use parameterized queries ONLY. Never concatenate user input into SQL strings.
- `CHECK` constraints on `redemptions`: `amount_cents > 0` and `balance_after >= 0`.

### API Routes

- Validate ALL inputs with **Zod** schemas at the start of every route handler.
- Extract `merchant_id` from `supabase.auth.getUser()` session, NEVER from `req.body` or `req.params`.
- Return **generic error messages** to client: `"Invalid or not found"`. Never expose internal details.
- Log detailed errors server-side with structured JSON (include `request_id`, `merchant_id`, `endpoint`).
- Every state-changing operation MUST insert an `audit_event` record.
- Every public endpoint MUST have rate limiting.
- Use `try/catch` with proper error boundaries. Never let unhandled exceptions reach the client.

### Security

- **NEVER** use `dangerouslySetInnerHTML`. Sanitize all user input before storage.
- **NEVER** put `SUPABASE_SERVICE_ROLE_KEY` or `STRIPE_SECRET_KEY` in client-side code.
- **NEVER** log PII in plain text. Mask emails: `a***@gmail.com`. Mask phones: `+34 6XX XXX X78`.
- **NEVER** log voucher codes in full. Mask: `PU-****-****-X8Q1`.
- **NEVER** generate a voucher before payment is confirmed (webhook or merchant manual confirm).
- **NEVER** return different error messages for "code exists" vs "code not found" (prevents enumeration).
- All card payments require **3D Secure** (Stripe enforces by default).
- Webhook handlers MUST verify Stripe signature and check `processed_webhooks` for idempotency.
- Redemption MUST use `SELECT...FOR UPDATE` row locking inside a database transaction.

### Payments

- **Payment source is metadata, NOT logic.** Redemption flow is identical for online and offline gift cards.
- A valid gift card is a valid gift card — regardless of how it was paid for.
- Online payments: Customer → Stripe Connect → Merchant. Platform collects 5% as `application_fee`.
- Offline payments: Customer → Merchant directly. Platform only TRACKS. No money flows through platform.
- Voucher is generated ONLY inside the payment confirmation handler (webhook for online, merchant confirm for offline).

### Conventions

- TypeScript **strict mode**. No `any` type. No `@ts-ignore` without explanation.
- File naming: `kebab-case.ts`, `kebab-case.tsx`.
- Component naming: `PascalCase`. Export as named export, not default.
- Use `'use server'` and server components by default. Add `'use client'` only when client interactivity is needed.
- Tailwind CSS for all styling. No CSS modules. No styled-components.
- Import order: React → Next.js → external libs → internal libs → components → types → styles.
- Use `const` by default. `let` only when reassignment is needed. Never `var`.
- Prefer early returns over deep nesting.
- Maximum function length: ~50 lines. Extract helpers if longer.
- All dates/times in UTC (TIMESTAMPTZ). Display in user's timezone on frontend only.
- Currency: EUR only (MVP). Always display with € symbol.

### Testing

- Co-locate test files: `__tests__/` folder next to the code being tested.
- Use **Vitest** for unit tests. **Playwright** for E2E.
- Test names: `it('should reject redemption when voucher is expired')`.
- Every API route needs at least: happy path test + auth failure test + validation failure test.
- Every Zod schema needs a validation test with invalid data.

### Git

- Branch naming: `feat/purchase-flow`, `fix/voucher-expiry`, `chore/update-deps`.
- Commit messages: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`).
- Never commit `.env.local` or any secrets.
- PR title = commit message format. Squash merge to main.

## Schema Quick Reference

```
merchants       → Tenant master (business profile, branding, payment config)
gift_cards      → What merchant offers (card types, prices, validity)
purchases       → Transaction (buyer, recipient, personalization, payment)
vouchers        → The actual gift card (code, QR, balance, status, expiry)
redemptions     → Usage tracking (amount, balance change) — APPEND-ONLY
delivery_events → Delivery audit (channel, provider_message_id, status)
ledger_accounts → Financial accounts (per merchant + platform)
ledger_entries  → Double-entry ledger — APPEND-ONLY
payouts         → Merchant payment records (amount, status, schedule)
audit_events    → Every business action — APPEND-ONLY
security_events → Failed logins, rate limits, fraud flags — APPEND-ONLY
processed_webhooks → Webhook idempotency (event_id dedup)
```

## Key Statuses

**Purchase:** `pending` → `payment_confirmed` → `refunded` | `partially_refunded` | `cancelled`

**Voucher:** `issued` → `delivered` → `partially_redeemed` → `redeemed` | `exchanged` | `expired` | `voided`

## Environment Variables

See `.env.example` for all required variables. Variables prefixed with `NEXT_PUBLIC_` are safe for client-side. All others are **server-only**.
