# Environment Matrix — ParaUsted

## Environments

| Setting | Local Dev | Preview (PR) | Production |
|---------|-----------|-------------|------------|
| **URL** | localhost:3000 | *.vercel.app | parausted.es |
| **Supabase** | Local (supabase start) | Staging project | Production project (EU Frankfurt) |
| **Stripe** | Test mode (pk_test_, sk_test_) | Test mode | **Live mode (pk_live_, sk_live_)** |
| **WhatsApp** | Test phone number | Test phone number | Production phone number |
| **Resend** | Test mode (sandbox) | Test mode | Production (verified domain) |
| **Sentry** | Disabled | Staging DSN | Production DSN |
| **PostHog** | Disabled | Disabled | Production key |
| **Cloudflare** | N/A | N/A | Production (parausted.es) |

## Environment Variable Checklist

| Variable | Local | Preview | Production |
|----------|:-----:|:-------:|:----------:|
| `NEXT_PUBLIC_SUPABASE_URL` | Local URL | Staging URL | Production URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Local key | Staging key | Production key |
| `SUPABASE_SERVICE_ROLE_KEY` | Local key | Staging key | Production key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | pk_test_ | pk_test_ | **pk_live_** |
| `STRIPE_SECRET_KEY` | sk_test_ | sk_test_ | **sk_live_** |
| `STRIPE_WEBHOOK_SECRET` | Local CLI | Staging endpoint | Production endpoint |
| `WHATSAPP_API_TOKEN` | Test token | Test token | Production token |
| `RESEND_API_KEY` | Test key | Test key | Production key |
| `NEXT_PUBLIC_SENTRY_DSN` | (empty) | Staging DSN | Production DSN |

## Rules

1. **NEVER** use production Stripe keys in local/preview
2. **NEVER** commit `.env.local` to git
3. **ALWAYS** use Vercel Environment Variables for preview/production (encrypted at rest)
4. **ALWAYS** test with Stripe test mode before switching to live
