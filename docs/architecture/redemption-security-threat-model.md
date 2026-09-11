# Redemption Security Threat Model & Audit

**Status:** Current
**Updated:** 2026-07-13
**Reviewer role:** Cybersecurity / backend architect
**Scope:** Voucher verification and redemption (merchant dashboard + partner M2M API).

This document records the security controls, the threats considered, and the residual risks for the money-bearing redemption paths. It complements `redemption-and-partner-api-architecture.md`.

---

## 1. Assets & trust boundaries

| Asset | Sensitivity |
|---|---|
| Voucher balance (money) | High — integrity critical |
| Voucher code | Bearer credential — confidentiality |
| Partner API token | Secret — confidentiality |
| Buyer/recipient PII | Personal data — confidentiality |
| Redemption/audit ledger | Integrity, non-repudiation |

Trust boundaries: public browser → partner server → ParaUsted API → Postgres RPC. Each boundary re-validates; nothing downstream trusts an upstream-supplied `merchant_id`, amount, or voucher state.

---

## 2. Controls in place (verified)

### 2.1 No secret / PII / code leakage
- All redemption and partner logs emit only `error.message` or a **non-reversible** SHA-256 fingerprint (`fingerprintSensitiveToken`, first 12 hex chars). Verified across every `console.*` in the path.
- Raw voucher codes, partner tokens, JWTs, and PII are never logged, never returned in errors, and never placed in ParaUsted's own client-visible URLs.
- Partner tokens are stored only as SHA-256 hashes; the raw token is shown once at creation.

### 2.2 Money integrity
- All amounts are integer cents; no floating-point math in the path.
- Input bounds (Zod): `amountCents` must be a positive integer `≤ 100,000,000`; non-integer, negative, zero, string, or oversized values are rejected as `invalid_request` before any RPC call.
- RPC bounds: `amount_cents > 0` (`invalid_amount`) and `amount_cents ≤ balance` (`amount_exceeds_balance`); `balance_after ≥ 0` enforced by both arithmetic and the `redemptions` CHECK constraint.
- No integer overflow: max 100M cents fits well within Postgres `INTEGER`.
- Full vs partial cannot be confused: supplying an amount always routes to the partial RPC; the full path ignores client amounts entirely.

### 2.3 Atomicity & double-spend
- `SELECT ... FOR UPDATE` row lock plus compare-and-set on `balance_cents`. Concurrent redemptions serialize; the loser gets `already_processed`, never a double decrement.
- Append-only `redemptions` + `audit_events`; history cannot be mutated.

### 2.4 Tenant isolation
- `merchant_id` is derived from `auth.uid()` (dashboard) or the resolved partner key (M2M); never from the client.
- Cross-tenant voucher access returns `not_found` identically to a nonexistent code — no cross-tenant enumeration.

### 2.5 Authentication & authorization
- Dashboard: unauthenticated requests return generic `unauthorized` **before** any voucher lookup, so state is never leaked to anonymous callers.
- Partner: bearer token required, resolved to one merchant, scope-checked (`voucher:read` / `voucher:redeem`).

### 2.6 Enumeration resistance
- Partner **verify** returns a single generic `invalid_or_not_found` for all ineligible/unknown/cross-tenant vouchers.
- Partner **redeem** and the **dashboard** return specific states, justified by the trust level (see §4).

---

## 3. Threats considered

| # | Threat | Mitigation | Residual |
|---|---|---|---|
| T1 | Public browser triggers irreversible redemption | Commit removed from partner public path; verify is read-only; commit is dashboard/operator-only | None |
| T2 | Voucher enumeration via error differences | Generic responses on public/partner-verify surfaces | None on public surfaces |
| T3 | Over-redemption / negative balance | Zod bounds + RPC `amount ≤ balance` + CHECK `balance_after ≥ 0` | None |
| T4 | Double-spend via concurrency | `FOR UPDATE` + CAS | None |
| T5 | Cross-tenant redemption | `merchant_id` from session/token; tenant-scoped queries | None |
| T6 | Token/code/PII leakage in logs | Masked fingerprints only | None found |
| T7 | Replay / duplicate M2M commit | Persisted per-merchant idempotency key; replay semantics | None (when caller sends a stable key) |
| T8 | Dashboard double-submit (non-idempotent) | Disabled-button UX + atomic CAS + client-supplied idempotency key on partial redemption (replays instead of double-redeeming) | None |
| T9 | Rate-limit store outage bypass | Fail-open by design (availability over strictness) | **Low/Info** — see R2 |

---

## 4. Answered: "Is showing specific dashboard errors a leak?"

**No.** Specific errors (`already_redeemed`, `expired`, `voided`, etc.) on the merchant dashboard are intentional and safe because the surface is:

1. **Authenticated** — an anonymous caller only ever receives generic `unauthorized`, before any voucher lookup.
2. **Tenant-scoped** — the RPC filters by the caller's own `merchant_id`. A code belonging to another merchant returns `not_found`, identical to a nonexistent code, so no cross-tenant information leaks.

A merchant is authorized to know the state of their own vouchers; withholding it would only harm usability. The leak concern applies exclusively to **public/guest** surfaces, which already return generic messages (ParaUsted partner verify → `invalid_or_not_found`; the partner site collapses redeem errors to generic guest copy).

---

## 5. Residual risks & recommendations

- **R1 (Resolved 2026-07-13) — Dashboard partial redemption idempotency.** The dashboard now sends a stable per-intent idempotency key with each partial redemption (`redeem_voucher_partial` 4-arg RPC, migration `20260713000006`). A duplicate submit of the same intent replays the prior result instead of creating a second redemption; the key rotates after success and resets when the code or amount changes. Full redemption remains intentionally key-less: a repeat attempt fails safely with `already_redeemed`.
- **R2 (Info) — Rate limiting is fail-open.** If the rate-limit store is unavailable, throttling is skipped (availability over strictness). Money integrity is unaffected because auth + atomic RPC still apply; only abuse-throttling degrades. Accept and monitor.
- **R3 (Info) — Partner redeem returns per-state errors.** Safe for the trusted M2M caller, but it must never be proxied verbatim to a public browser. The partner site already collapses these to generic guest messaging; keep that contract.
- **R4 (Info) — Raw voucher code reaches the operator** via booking email/WhatsApp for manual dashboard redemption. Not logged, not in client URLs, not persisted by the partner. Reduce once dashboard redemption is the default hand-off.

---

## 6. Verification commands

```powershell
npm run test
npx tsc --noEmit
npm run lint
```

Redemption-specific suites: `src/app/api/vouchers/[code]/redeem/__tests__`, `src/app/api/partner/vouchers/[code]/__tests__`, and `src/app/api/partner/vouchers/[code]/redeem/__tests__`.
