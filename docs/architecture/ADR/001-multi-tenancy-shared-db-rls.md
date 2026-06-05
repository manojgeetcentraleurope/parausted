# ADR-001: Multi-Tenancy — Shared DB + Row Level Security

## Status: Accepted

## Context
ParaUsted serves multiple merchants (tenants) from one platform. We need data isolation between merchants.

## Options Considered
1. **Separate DB per tenant** — Perfect isolation but cost explosion (10K merchants = 10K databases)
2. **Shared DB, separate schema** — Good isolation but migration nightmare at scale
3. **Shared DB, shared schema, tenant_id + RLS** — One DB, one schema, database-enforced isolation

## Decision
Option 3: Shared DB with `merchant_id` column on every table + Postgres Row Level Security (RLS).

## Consequences
- ✅ One migration applies to all tenants instantly
- ✅ Cross-tenant analytics trivial (single query)
- ✅ Cost: one Supabase instance handles 10,000+ merchants
- ✅ RLS enforces isolation at DB level — even buggy app code can't leak data
- ⚠️ Must ensure RLS policy on EVERY new table
- ⚠️ Noisy neighbor possible — solved with read replicas + tier-based sharding (V3)
