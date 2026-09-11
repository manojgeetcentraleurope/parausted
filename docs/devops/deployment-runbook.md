# Deployment Runbook — ParaUsted

## Environments

| Environment | URL | Supabase Project | Stripe Mode | Auto-Deploy |
|------------|-----|-----------------|-------------|:-----------:|
| **Local** | localhost:3001 | Local (supabase start) | Test | N/A |
| **Preview** | *.vercel.app | Staging | Test | ✅ Per PR |
| **Production** | parausted.es | Production (EU Frankfurt) | **Live** | ✅ On merge to main |

## Standard Deployment (Automatic)

1. Merge PR to `main`
2. Vercel auto-deploys (zero downtime, atomic swap)
3. Sentry captures new release version
4. Verify: check `/api/health` returns 200

## Database Migration Deployment

```bash
# 1. Create migration locally
supabase migration new your_migration_name

# 2. Write SQL in the generated file

# 3. Test locally
supabase db reset  # Runs ALL migrations from scratch

# 4. Push to staging
supabase db push --linked  # Against staging project

# 5. Verify staging works

# 6. Push to production
supabase db push --linked  # Against production project
# ⚠️ DESTRUCTIVE MIGRATIONS (DROP, ALTER column type) require extra review
```

## Rollback Procedures

### Application Rollback (< 1 minute)
1. Open Vercel Dashboard → Deployments
2. Find the last working deployment
3. Click "..." → "Promote to Production"
4. Done. Previous version is live.

### Database Rollback
- ⚠️ Database migrations are generally NOT reversible automatically
- For additive changes (ADD COLUMN): safe, no rollback needed
- For destructive changes: write a reverse migration BEFORE deploying
- Emergency: Supabase point-in-time recovery (Pro plan, up to 7 days)

## Go-Live Checklist (First Production Deploy)

- [ ] Supabase production project created (EU Frankfurt)
- [ ] All migrations applied to production
- [ ] Stripe live mode keys in Vercel env vars
- [ ] Stripe webhook endpoint configured for production URL
- [ ] Cloudflare DNS: parausted.es → Vercel
- [ ] SSL certificate active (Cloudflare Full Strict)
- [ ] Sentry DSN configured for production
- [ ] UptimeRobot monitor: parausted.es + /api/health
- [ ] WhatsApp message templates approved by Meta
- [ ] Resend domain verified (parausted.es)
- [ ] SPF + DKIM + DMARC records in Cloudflare DNS
- [ ] Test purchase in production (use real card, small amount, refund after)
- [ ] Verify /api/health returns all services healthy
