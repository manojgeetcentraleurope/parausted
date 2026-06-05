<!-- BEGIN:nextjs-agent-rules -->
# ParaUsted Agent Rules

This repository prioritizes correctness, security, tenant isolation, SEO, accessibility, maintainability, and operational safety over speed or cleverness.

---

## 1. This is NOT the Next.js you know

This project uses **Next.js 16**. This version has breaking changes — APIs, conventions, routing behavior, metadata APIs, cookies, middleware, and file structure may differ from older examples or model training data.

Before writing or modifying any Next.js code:

1. Check the installed package versions in `package.json`.
2. Read the relevant local documentation in `node_modules/next/dist/docs/`.
3. Read installed TypeScript definitions when API behavior is unclear.
4. Heed all deprecation notices.
5. Do not rely only on training memory.

Examples:

- `cookies()` may be async.
- App Router route params/search params may be async.
- Metadata should use the App Router Metadata API, not legacy `next/head`.
- Middleware and cookie mutation rules may differ from older examples.

If unsure, inspect the local installed docs/types first.

---

## 2. Product Context

This repository implements **ParaUsted**, a multilingual digital gift card SaaS platform for local businesses in Spain.

Primary market:

- Spain

Primary language:

- Spanish (`es`)

Secondary language:

- English (`en`)

Future:

- More languages later

Core stack:

- Next.js 16 App Router
- TypeScript strict
- Tailwind CSS
- Supabase Auth
- Supabase Postgres with Row Level Security
- Supabase SSR
- Stripe Connect later
- Resend later
- Meta WhatsApp Business API later

Important project docs:

- `docs/PRD/ParaUsted_Gold_Class_PRD.md`
- `.github/copilot-instructions.md`
- `docs/ai/context-pack.md`
- `docs/ai/code-review-checklist.md`
- `docs/developer/code-conventions.md`
- `docs/architecture/ADR/`

Read these before making architecture-level changes.

---

## 3. Architecture Rules

### Multi-tenancy

ParaUsted is multi-tenant. Every tenant is a merchant.

Rules:

- `merchant_id` must come from authenticated session/database lookup.
- Never trust `merchant_id` from request body, query params, URL params, localStorage, or client input.
- Every merchant-owned table must enforce tenant isolation through RLS.
- Every merchant-owned query must be tenant-scoped.
- Never bypass RLS except in trusted server-only admin flows.
- Public pages may read only intentionally public data.

### Money

All money values must be stored and processed as integer cents.

Allowed:

```ts
const amountCents = 3500;
```

Forbidden:

```ts
const amount = 35.0;
```

Rules:

- Never use floating point for money.
- Currency is EUR for MVP.
- Display formatting happens only at UI boundary.
- Payment calculations must be deterministic and auditable.

### Immutable records

These tables are append-only:

- `ledger_entries`
- `audit_events`
- `security_events`
- `redemptions`

Do not generate UPDATE or DELETE operations for immutable records.

---

## 4. i18n and SEO Rules

All user-facing routes must be locale-prefixed.

Supported current routes:

```text
/es
/en
/es/login
/en/login
/es/signup
/en/signup
/es/dashboard
/en/dashboard
/es/m/[slug]
/en/m/[slug]
/es/v/[code]
/en/v/[code]
```

Technical routes remain non-localized:

```text
/api/*
/auth/callback
```

Rules:

- Spanish (`es`) is the default locale.
- `/` redirects to `/es`.
- `/login` redirects to `/es/login`.
- `/signup` redirects to `/es/signup`.
- `/dashboard` redirects to `/es/dashboard`.
- Do not create non-localized user-facing pages unless they redirect.
- Do not use query-param language routing like `?lang=es`.
- Do not rely on cookies for SEO language discovery.
- Do not introduce `next-intl` unless explicitly requested.
- User-facing text should come from typed dictionaries where available.

SEO rules:

- Localized pages should be self-canonical.
- Alternate language URLs must include `es`, `en`, and `x-default`.
- `x-default` points to Spanish.
- Use absolute canonical URLs.
- Use `NEXT_PUBLIC_APP_URL` as base URL with local fallback.
- Merchant pages must later support dynamic SEO metadata and LocalBusiness JSON-LD.
- Metadata must be server-generated for SEO-critical pages.
- Do not use client-side-only metadata for SEO-critical pages.

---

## 5. Supabase Rules

Existing Supabase helper files:

```text
src/lib/supabase/client.ts
src/lib/supabase/server.ts
src/lib/supabase/admin.ts
```

Rules:

- Use `supabaseBrowserClient` only in client components.
- Use `createSupabaseServerClient()` in server components, route handlers, and server actions.
- Use `supabaseAdminClient` only in trusted server-side code.
- Never import `admin.ts` into client components.
- `admin.ts` must remain protected with `import 'server-only';`.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser/client code.

For middleware:

- Do not import `src/lib/supabase/server.ts` if incompatible with middleware cookies.
- Use the official Supabase SSR middleware cookie-bridging pattern.
- Preserve auth session refresh behavior.
- Do not use the service role key in middleware.

---

## 6. Architecture, Code Quality & Security Guardrails

All AI-generated code must be production-quality, secure, maintainable, testable, and aligned with professional software architecture standards.

### Architecture Principles

Follow these principles by default:

- **SOLID** — keep responsibilities clear, dependencies explicit, and abstractions purposeful.
- **DRY** — avoid duplicated business logic, validation rules, query logic, and security checks.
- **KISS** — prefer the simplest correct solution over clever or overly abstract solutions.
- **YAGNI** — do not build speculative features, extensibility, or abstractions unless required now.
- **Separation of Concerns** — keep UI, validation, data access, auth, payment logic, and business rules separated.
- **Single Source of Truth** — centralize shared constants, route helpers, i18n config, SEO helpers, validation schemas, and status enums.
- **Explicit Boundaries** — client code, server code, middleware code, admin code, and database code must not leak into each other.
- **Fail-Safe Defaults** — deny access by default when auth, role, tenant, or validation state is unclear.
- **Defense in Depth** — validate at the edge, API boundary, business layer, and database layer where appropriate.
- **Privacy by Design** — minimize, protect, and clean up personal data.
- **Security by Design** — treat every public input, callback, webhook, and redirect as potentially hostile.

### Design Patterns

Use Gang of Four or common architectural patterns only when they clearly improve the design.

Allowed when useful:

- **Factory** for client creation or service construction.
- **Strategy** for payment methods, delivery methods, fraud rules, or localization behavior.
- **Adapter** for Stripe, Resend, WhatsApp, Supabase, or third-party APIs.
- **Repository-like data access helpers** only when they reduce duplication and enforce tenant/security rules.
- **Command/Handler pattern** for state-changing business operations such as redeem voucher, confirm payment, issue refund.

Do not force design patterns where a simple function is clearer.

### Complexity Limits

Keep code easy to reason about:

- Prefer small functions.
- Prefer early returns.
- Avoid deeply nested conditionals.
- Avoid large switch statements unless modeling a clear state machine.
- Keep cyclomatic complexity low.
- Keep cognitive complexity low.
- Extract pure helpers for:
  - route classification
  - locale handling
  - SEO URL generation
  - validation
  - status transitions
  - money formatting
  - PII masking
  - voucher code generation
  - safe redirect handling

If a function becomes hard to read, split it before adding more logic.

### TypeScript Quality

- TypeScript strict mode is mandatory.
- No `any`.
- No unexplained `@ts-ignore`.
- Prefer discriminated unions for status/state machines.
- Prefer explicit return types on exported functions.
- Prefer typed constants over string literals scattered across files.
- Use Zod for request/input validation.
- Never trust untyped external input.
- Named exports only unless framework conventions require otherwise.

---

## 7. Security Rules

Never generate code that violates these rules:

- No `dangerouslySetInnerHTML`.
- No secrets in client-side code.
- No service role key in browser bundles.
- No raw SQL string concatenation with user input.
- No PII in logs.
- No full voucher codes in logs.
- No open redirects.
- No trusting client-provided `merchant_id`.
- No trusting client-provided role, amount, voucher status, payment status, or redemption status.
- No voucher generation before payment confirmation.
- No redemption without atomic balance protection.
- No public endpoint without rate limiting or an explicit documented reason.
- No stack traces or internal errors exposed to users.

Open redirect prevention:

- `next` must be internal only.
- `next` must start with `/`.
- `next` must not start with `//`.
- Reject absolute URLs like `https://evil.com`.
- Preserve locale in safe redirects.

PII masking:

- Mask emails in logs.
- Mask phone numbers in logs.
- Mask voucher codes in logs.
- Never log auth cookies, JWTs, refresh tokens, API keys, card data, or service role keys.

---

## 8. Privacy by Design

ParaUsted handles buyer, recipient, and merchant personal data.

Rules:

- Collect the minimum data required.
- Store PII only when required for delivery, receipt, support, or legal obligations.
- Mask PII in logs.
- Keep buyer/recipient PII cleanup behavior aligned with GDPR/LOPDGDD requirements.
- Do not add analytics or tracking without explicit consent architecture.
- Do not store email/phone locally unless explicitly required by architecture.
- Do not add marketing consent, analytics consent, or cookie tracking casually.

---

## 9. Financial Safety

Money and voucher state must be correct.

Rules:

- Use integer cents for all money.
- Never use floating point for money.
- Ledger entries must be append-only.
- Redemptions must be append-only.
- Voucher balance updates must be atomic.
- Refunds must preserve audit trail.
- Payment webhooks must be idempotent.
- Stripe webhook signatures must be verified.
- Processed webhook IDs must be stored before or during safe transaction handling.
- A voucher must be issued only after payment confirmation or explicit merchant confirmation for offline payments.
- Offline payment tracking must not imply ParaUsted processed or held funds.

---

## 10. Operational Safety

Generated code must be observable and support production operations.

Rules:

- State changes must create audit events.
- Security-relevant events must create security events.
- Errors should include request IDs in server logs where available.
- User-facing errors must be safe and generic.
- Background jobs must be idempotent.
- Retry behavior must avoid duplicate voucher creation, duplicate delivery, duplicate payouts, and duplicate ledger entries.
- External API failures must degrade safely.
- Do not add silent failures unless the failure is explicitly safe and documented.

---

## 11. Performance & Memory Safety

Avoid avoidable performance and memory issues:

- Do not create unnecessary global mutable state.
- Do not create unbounded in-memory caches.
- Do not keep long-lived references to request-specific data.
- Do not fetch data repeatedly when a single server-side fetch is enough.
- Avoid N+1 database query patterns.
- Add indexes for frequently filtered columns.
- Keep client bundles small.
- Use Server Components by default.
- Use Client Components only when interactivity is required.
- Avoid importing heavy server-only dependencies into client bundles.
- Avoid expensive work inside middleware.

---

## 12. Accessibility & UX Quality

User-facing UI must be accessible and clear:

- Use semantic HTML.
- Use labels for form fields.
- Buttons must have disabled/loading states.
- Errors must be visible and understandable.
- Spanish copy is primary.
- English copy follows the same dictionary shape.
- Do not hardcode user-facing strings directly in components when dictionary usage is available.
- Use accessible focus states.
- Do not block keyboard navigation.

---

## 13. Next.js Coding Rules

Before writing Next.js code:

1. Confirm current API behavior from installed docs/types.
2. Use App Router patterns.
3. Do not use legacy Pages Router patterns.
4. Do not use `next/head` for metadata.
5. Use Server Components by default.
6. Use `'use client'` only when client interactivity is required.
7. Do not import server-only modules into client files.
8. Do not import client-only modules into server files.
9. Keep middleware small and fast.
10. Avoid unnecessary dynamic rendering.

For metadata:

- Use `metadata` or `generateMetadata`.
- Metadata must be server-generated for SEO-critical pages.
- Prepare canonical and hreflang metadata via helper functions.

For middleware:

- Keep matcher precise.
- Exclude static assets.
- Exclude `/api/*`.
- Exclude `/auth/callback`.
- Avoid unnecessary redirects.
- Preserve Supabase auth session refresh behavior.

---

## 14. Validation Rules

After code changes, always run:

```powershell
npx tsc --noEmit
npm run lint
```

For middleware, auth, SEO, or routing changes, also manually verify:

```text
/ -> /es
/login -> /es/login
/signup -> /es/signup
/dashboard -> /es/dashboard
/es/dashboard unauthenticated -> /es/login?next=/es/dashboard
/en/dashboard unauthenticated -> /en/login?next=/en/dashboard
/api/health not redirected by middleware
/auth/callback not redirected by middleware
```

For database changes, verify:

```powershell
supabase db push
```

Do not claim a task is done unless TypeScript and lint pass.

---

## 15. Git Rules

Use conventional commits:

```text
feat:
fix:
docs:
chore:
test:
refactor:
```

Do not commit:

- `.env.local`
- secrets
- API keys
- generated temporary files
- debugging artifacts
- accidental downloads

Before commit:

```powershell
git status --short
npx tsc --noEmit
npm run lint
```

---

## 16. AI Agent Behavior

When asked to implement something:

1. Read relevant existing files first.
2. Read relevant local docs/types if framework APIs are involved.
3. Make the smallest safe change.
4. Explain what changed.
5. Provide exact validation commands.
6. Do not perform unrelated cleanup.
7. Do not refactor working code unless required.
8. Do not invent schema fields not present in migrations/PRD.
9. Ask only if blocked; otherwise proceed with safe assumptions.
10. Prefer correctness and security over speed.

For complex changes:

- State the affected files.
- State risks.
- State verification steps.

For security-sensitive changes:

- Prefer boring, explicit code.
- Avoid clever code.
- Make failure modes safe.
- Deny by default when uncertain.

For AI-generated code review, verify:

- Does this follow SOLID, DRY, KISS, and YAGNI?
- Is the solution simpler than the abstraction?
- Are security boundaries respected?
- Is tenant isolation preserved?
- Are money values handled in cents?
- Are PII and secrets protected?
- Are external inputs validated?
- Are errors safe?
- Is the code easy to test?
- Can this be maintained without refactoring soon?

If any answer is uncertain, improve the code before committing.

<!-- END:nextjs-agent-rules -->
