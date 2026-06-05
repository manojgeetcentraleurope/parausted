# ADR-003: Offline Payments Are Free (No Commission)

## Status: Accepted

## Context
In Seville, most small businesses (barbers, restaurants) prefer cash or Bizum. Charging commission on offline payments is impractical and creates friction.

## Decision
Offline gift card tracking is completely FREE. No commission on cash, direct Bizum, or bank transfer payments. Commission (5%) applies ONLY to online payments through Stripe Connect.

## Consequences
- ✅ Zero adoption friction — merchants try the platform risk-free
- ✅ No regulatory burden — no money flows through platform for offline
- ✅ Natural upsell path: free tracking → see value → enable online payments
- ❌ 70% of transactions may generate zero revenue initially
- ❌ Must demonstrate enough value in online-only features to drive conversion
