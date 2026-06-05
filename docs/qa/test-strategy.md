# Test Strategy — ParaUsted

## Testing Pyramid

```
        /‾‾‾‾‾‾‾‾‾\
       /   E2E      \       5-10 tests (Playwright)
      /   (critical   \     Full user journeys
     /    paths only)  \
    /‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
   /    Integration       \   20-40 tests (Vitest)
  /   (API routes +        \  Route handlers + DB
 /     Supabase queries)    \
/‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
/         Unit Tests          \  50-100 tests (Vitest)
/ (validation, helpers, utils) \  Pure functions, Zod schemas
/‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾\
```

## Tools

| Type | Tool | Config |
|------|------|--------|
| Unit + Integration | Vitest | `vitest.config.ts` |
| E2E | Playwright | `playwright.config.ts` |
| Coverage | Vitest (v8) | Target: 70% for MVP |

## What to Test

### Unit Tests (every Zod schema, every helper)

```
src/lib/validation/
  purchase-schema.test.ts     → Valid/invalid purchase inputs
  voucher-code.test.ts        → Code generation is random, correct format
  amount-utils.test.ts        → Cents ↔ display conversion
  reference-code.test.ts      → Reference code generation + uniqueness

src/lib/ledger/
  entries.test.ts             → Ledger entry creation, balance calculation

src/utils/
  mask-pii.test.ts            → Email/phone masking
  format-currency.test.ts     → €35.00 display formatting
```

### Integration Tests (every API route)

Each API route needs at minimum:
1. ✅ Happy path (correct input → correct output)
2. ❌ Auth failure (no JWT → 401)
3. ❌ Validation failure (bad input → 400)
4. ❌ Not found (wrong merchant → empty result via RLS)

```
src/app/api/purchases/
  route.test.ts               → Create purchase (online + offline)
  
src/app/api/vouchers/[code]/
  route.test.ts               → Voucher lookup (valid, invalid, expired)
  redeem/route.test.ts        → Redemption (full, partial, double, expired)

src/app/api/webhooks/stripe/
  route.test.ts               → Valid webhook, invalid signature, replay
```

### E2E Tests (critical paths only)

```
tests/e2e/
  merchant-onboarding.spec.ts → Signup → create gift card → see on page
  purchase-offline.spec.ts    → Buy via Bizum → merchant confirms → voucher delivered
  purchase-online.spec.ts     → Buy via Stripe → auto-confirm → voucher delivered
  redemption.spec.ts          → Merchant redeems voucher → balance updates
  refund.spec.ts              → Buyer requests refund → processed correctly
```

## Security Tests

Run before every release:

- [ ] Cross-tenant access blocked (RLS)
- [ ] Invalid webhook signature rejected
- [ ] Rate limiting works on purchase endpoint
- [ ] Expired voucher cannot be redeemed
- [ ] Negative redemption amount rejected
- [ ] SQL injection in search/filter inputs blocked
- [ ] XSS in personal_message field sanitized
- [ ] service_role key not in any client bundle
