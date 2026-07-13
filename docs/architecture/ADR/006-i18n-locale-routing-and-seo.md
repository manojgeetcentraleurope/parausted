# ADR 006 — i18n Locale Routing and SEO Architecture

- **Status:** Accepted
- **Date:** 2026-06-05
- **Author:** Engineering
- **Supersedes:** —
- **Related:** ADR-005 (Next.js App Router)

---

## Context

ParaUsted is a Spanish-first SaaS platform targeting local businesses in Spain. Before building any auth or merchant-facing pages, the team must lock the multilingual URL architecture. Decisions made at this stage directly affect SEO crawlability, duplicate-content risk, future-language extensibility, and how the Next.js App Router organises file-system routes.

Requirements driving this decision:

1. Spanish is the primary SEO language for launch. English is secondary.
2. Future languages must be addable without restructuring existing routes.
3. Every user-facing page must be crawlable at a clean, stable, locale-prefixed URL.
4. Duplicate content between Spanish and English variants must be handled via canonical/hreflang, not by hiding pages from crawlers.
5. Technical routes (`/api/*`, `/auth/callback`) must never be localised.

---

## Decision

### 1. Path-prefix locale routing (`/es/…`, `/en/…`)

We use the URL path segment as the sole locale signal. Every user-facing route is prefixed with an ISO 639-1 language code:

```
/es          Spanish home
/en          English home
/es/login    Spanish login
/en/login    English login
/es/dashboard
/en/dashboard
/es/m/[slug]
/en/m/[slug]
/es/v/[code]
/en/v/[code]
```

**Why not `?lang=es` query params?** Query-param routing is not crawlable by default: Googlebot treats `?lang=es` and `?lang=en` as variants of the same URL, and CDNs/caches require `Vary: Accept-Language` configuration that is error-prone. Path-based routing is unambiguous to every crawler.

**Why not cookie-based locale detection?** Cookies are invisible to crawlers. A page served in Spanish to a user but indexed without the correct `lang` attribute is an SEO anti-pattern. Canonical and hreflang tags require stable, predictable URLs — cookies provide neither.

**Why not subdomain routing (`es.parausted.es`)?** Subdomains require separate DNS records, wildcard TLS certificates, and distinct Vercel/CDN deployments. The added operational cost is not justified for the 2-locale MVP.

### 2. Spanish as `DEFAULT_LOCALE`; always redirect to `/es`

Visiting `/` redirects to `/es`. Non-localised paths (e.g., `/login`) redirect to their Spanish equivalents (`/es/login`), not to a language auto-detected from `Accept-Language`.

**Why always Spanish, not browser language?** `Accept-Language`-based detection produces inconsistent indexed URLs. If Google crawls `/login` from a US IP, it might be redirected to `/en/login` and index that as the canonical version — undermining the Spanish SEO strategy. By always redirecting to `/es` we guarantee that search engines always see the same canonical starting point.

### 3. `/m/[slug]` and `/v/[code]` namespace prefixes

Public merchant gift-card pages live at `/es/m/[slug]` rather than `/es/[slug]`. Voucher redemption pages live at `/es/v/[code]`.

**Why the `/m/` and `/v/` prefixes?** Without namespacing, a merchant slug like `login` or `dashboard` would collide with auth routes. Prefixes create a clean, collision-free namespace and make URL semantics obvious to users and crawlers alike.

### 4. `/api/*` and `/auth/callback` remain non-localised

API routes are machine-to-machine; locale is irrelevant. The Supabase OAuth callback (`/auth/callback`) must be a fixed URL registered in the Supabase project settings and cannot be locale-prefixed. The proxy matcher explicitly excludes both to avoid accidental redirects.

### 5. Canonical and hreflang strategy (prepared, not yet implemented)

Each localised page will eventually declare:

- A **self-canonical** URL: `/es/login` → `canonical = https://parausted.es/es/login`
- **hreflang alternates**:
  - `<link rel="alternate" hreflang="es" href="https://parausted.es/es/login" />`
  - `<link rel="alternate" hreflang="en" href="https://parausted.es/en/login" />`
  - `<link rel="alternate" hreflang="x-default" href="https://parausted.es/es/login" />`

`x-default` points to the Spanish version because Spanish is the primary commercial market. Helper functions in `src/lib/seo/metadata.ts` (`getCanonicalUrl`, `getAlternateLanguageUrls`) codify this strategy so every `generateMetadata` call is consistent.

The canonical base URL is driven by `NEXT_PUBLIC_APP_URL`. In production this is `https://parausted.es`; in local development it falls back to `http://localhost:3001`.

### 6. No `next-intl` (or equivalent i18n library) at this stage

`next-intl`, `next-i18next`, and `react-i18next` all provide message interpolation, plural forms, and date/number formatting. ParaUsted has a small, well-defined message set at MVP. Adding a library now would:

- Increase bundle size and dependency surface.
- Require wrapping every Server Component in a provider or async import.
- Add configuration complexity before the first real page exists.

The lightweight dictionary pattern (`src/lib/i18n/messages/`) is sufficient for now. It uses `as const satisfies` to enforce structural parity between language files at compile time, with zero runtime overhead. Switching to a full i18n library later is a one-step refactor: replace dictionary imports with library calls.

### 7. `middleware.ts` deprecated → `proxy.ts`

Next.js 16 deprecated the `middleware.ts` file convention and renamed it to `proxy.ts` (export named `proxy`). Following the project's `AGENTS.md` directive to heed deprecation notices, all routing logic lives in `src/proxy.ts`. The old `src/middleware.ts` is retained as an empty stub (comment + `export {}`) for git-history continuity only; Next.js uses `proxy.ts` exclusively.

---

## Consequences

### Positive

- Every user-facing URL is unique, stable, and crawlable without server-side logic.
- Adding a third language requires: one new entry in `SUPPORTED_LOCALES`, one new messages file, and no changes to the proxy or route structure.
- SEO helper functions are available from day one; `generateMetadata` implementations are a thin wrapper.
- TypeScript enforces message-shape parity at compile time via `satisfies typeof esMessages`.
- The proxy is deterministic: non-localised paths always redirect to Spanish regardless of `Accept-Language`, ensuring consistent Googlebot indexing.

### Negative / Trade-offs

- Users whose browser is set to English will land on the Spanish version before being shown the English toggle. This is an intentional SEO-over-UX trade-off for the MVP; a future preference cookie (never used for crawlers) can override the display language.
- All locale-aware pages must pass the `lang` param through `generateStaticParams`. This is three extra lines per route but keeps static generation possible.
- `/auth/callback` and `/api/*` are excluded from locale routing; this must be clearly documented so future developers do not add localised redirects there.

---

## Alternatives Considered

| Alternative | Rejected because |
|---|---|
| Subdomain routing (`es.parausted.es`) | Extra DNS/TLS/deployment overhead; no benefit at 2-locale MVP |
| Query-param routing (`?lang=es`) | Not crawlable; CDN `Vary` complexity; unstable canonical URLs |
| Cookie-based detection | Invisible to crawlers; incompatible with canonical/hreflang tags |
| `next-intl` library | Premature abstraction; too heavy for current message set |
| Auto-detect locale via `Accept-Language` | Non-deterministic indexing; Google crawls from US IPs, undermining Spanish SEO |
