# ADR-002: Stripe Connect Over MONEI for Online Payments

## Status: Accepted

## Context
We need to process online payments where money flows from buyer to merchant, with platform taking 5% commission. This is a marketplace payment pattern.

## Options Considered
1. **Stripe Connect (Express)** — Purpose-built marketplace. Stripe is licensed PSP. Handles KYC.
2. **MONEI** — Spain-native, Bizum support, but NOT a marketplace tool. We'd hold funds = regulatory burden.
3. **Dual (Stripe + MONEI)** — Best coverage but double complexity.

## Decision
Stripe Connect for MVP. MONEI considered for V2 (Bizum integration).

## Consequences
- ✅ Zero regulatory burden — Stripe is the licensed PSP
- ✅ KYC handled by Stripe (merchant identity verification)
- ✅ Payout scheduling built into Stripe Connect
- ❌ No native Bizum support in MVP — mitigated by direct Bizum workaround
- ❌ Higher fees than MONEI (~1.4% vs ~1.19%)
