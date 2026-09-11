# Seville Tours White-Label Integration Plan

**Status:** IN PROGRESS  
**Updated:** 2026-07-13  
**Systems:** ParaUsted and Seville Tours

## Goal

Deliver a Seville Tours-branded gift-card purchase and booking journey while ParaUsted remains the authoritative system for checkout, issuance, voucher balances, redemption, refunds, expiry, and audit records.

## Security Boundary

- ParaUsted partner credentials remain server-only.
- ParaUsted resolves `merchant_id` from the partner credential.
- Customer-facing verification never mutates voucher state.
- Redemption happens only after Seville Tours has persisted an accepted booking or an authenticated operator approves it.
- Every redemption retry reuses the persisted booking reference as the idempotency key.
- Seville Tours stores reconciliation identifiers, not an independent voucher balance.

## Phases

### Phase 1: ParaUsted Verification Contract

- [x] Add `voucher:read` partner scope.
- [x] Add tenant-scoped, service-role-only voucher verification RPC.
- [x] Add `GET /api/partner/vouchers/[code]`.
- [x] Return no buyer or recipient PII.
- [x] Use a generic `invalid_or_not_found` response for unknown, expired, terminal, or cross-tenant vouchers.
- [x] Add route tests for success, authentication, authorization, validation, rate limiting, and generic failure.
- [x] Apply the migration to the linked Supabase environment.
- [ ] Publish the request/response contract to the Seville Tours repository.

Verification is advisory. Eligibility can change between verification and redemption, so the atomic redemption RPC remains authoritative.

### Phase 2: Seville Tours Redemption Containment

- [ ] Remove the browser-triggered full-balance commit from the current "Verify code" action.
- [ ] Call the ParaUsted verification endpoint from a server-only adapter.
- [ ] Collapse provider errors into generic guest-facing copy.
- [ ] Add local rate limiting and abuse controls.
- [ ] Keep the ParaUsted bearer credential server-only.
- [ ] Add focused tests proving verification cannot mutate a voucher.

### Phase 3: Booking-Linked Commit

**Decision (PO + security + backend architect):** Redemption is committed by an authenticated operator (Carlos) inside the ParaUsted merchant dashboard after the booking is confirmed. Seville Tours owns no commit route, booking ledger, or operator session. Automatic commit is deferred until a defined confirmed-booking state machine and timeout reconciliation exist. Partial redemption is supported because flexible and luxury gift cards can exceed a single booking value.

- [x] Add partner partial-redemption RPC and `amountCents` support on the M2M redeem endpoint (full-balance remains the default when no amount is sent).
- [x] Add merchant-session partial-redemption RPC, REST branch, and dashboard amount field so Carlos can redeem full or partial balance from the authenticated ParaUsted dashboard.
- [ ] Persist a pending booking before redemption (Seville Tours advisory verification only).
- [ ] Define timeout reconciliation via same-key replay (no lookup endpoint yet).
- [ ] Stop retransmitting full voucher codes through email and WhatsApp once dashboard redemption is the norm.

### Phase 4: Purchase UX and White Label

- [ ] Map Alcazar, flexible-value, and luxury CTAs to distinct ParaUsted product IDs.
- [ ] Use consistent same-tab purchase navigation and a safe return journey.
- [ ] Add allowlisted return destinations and opaque attribution state.
- [ ] Configure `gifts.sevilletours.com`, DNS ownership, TLS, theme, favicon, support links, and legal links.
- [ ] Brand transactional email, voucher PDF, claim page, and balance page.
- [ ] Keep checkout, confirmation, claim, balance, and redemption pages `noindex`.

### Phase 5: Seville Tours UI, SEO, and Accessibility

- [ ] Replace repeated CTA copy with product-specific labels.
- [ ] Add semantic section and product headings.
- [ ] Remove duplicated terms and the empty stretched desktop aside.
- [ ] Reserve mobile space for the fixed action bar.
- [ ] Fix locale-specific tour canonicals.
- [ ] Add gift-card `Product`/`Offer` structured data to the acquisition page.
- [ ] Update stale integration documentation and add automated integration tests.

## Required Contract

### Verify

```http
GET /api/partner/vouchers/{code}
Authorization: Bearer <partner-token>
```

Eligible response:

```json
{
  "success": true,
  "eligible": true,
  "voucherCode": "PU-...",
  "balanceCents": 5000,
  "status": "delivered",
  "expiresAt": "2027-07-13T00:00:00+00:00"
}
```

All ineligible or unknown vouchers return the same response shape:

```json
{
  "success": false,
  "error": "invalid_or_not_found"
}
```

### Commit

The existing endpoint remains authoritative:

```http
POST /api/partner/vouchers/{code}/redeem
Authorization: Bearer <partner-token>
Idempotency-Key: <persisted-booking-reference>
```

## Open Decisions

- Whether Carlos must approve every redemption or confirmed inventory may trigger it automatically.
- How to handle a voucher whose value exceeds the booking while partner redemption remains full-balance only.
- The final flexible and luxury product IDs.
- Approved return hosts and attribution fields.
- Whether ParaUsted attribution is hidden, contractual footer copy, or visible co-branding.

## Validation

```powershell
npm run test -- src/app/api/partner/vouchers/[code]/__tests__/route.test.ts
npx tsc --noEmit
npm run lint
supabase db push
```
