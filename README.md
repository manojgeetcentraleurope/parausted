# ParaUsted

> **"El regalo perfecto, para quien tú quieras"**

Digital gift card SaaS platform for local businesses in Spain.

## What is ParaUsted?

ParaUsted enables barbers, restaurants, tour operators, gyms, and any local business to create, sell, deliver, and track personalized digital gift cards — without a website, technical knowledge, or upfront cost.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind CSS |
| Backend | Next.js API Routes + Supabase Edge Functions |
| Database | Supabase Postgres (EU Frankfurt) + Row Level Security |
| Auth | Supabase Auth (Email/Password, Magic Link, Google OAuth) |
| Payments | Stripe Connect (Express) |
| Storage | Supabase Storage |
| Email | Resend |
| WhatsApp | Meta Business API |
| CDN/DNS | Cloudflare |
| Monitoring | Sentry + Vercel Analytics |

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- Supabase CLI (`npm install -g supabase`)
- Stripe CLI (for webhook testing)

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/your-org/parausted.git
cd parausted

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env.local
# Edit .env.local with your Supabase, Stripe, and other credentials

# 4. Start Supabase locally
supabase start

# 5. Run migrations
supabase db reset

# 6. Start the dev server on http://localhost:3001
npm run dev

# 7. Open http://localhost:3001
```

Both `npm run dev` and `npm run start` always use port `3001`. They also start
Node.js with `--use-system-ca`, allowing TLS connections signed by certificate
authorities trusted by the operating system (including a configured corporate
CA) without disabling certificate verification.

Do not set `NODE_TLS_REJECT_UNAUTHORIZED=0`. It bypasses TLS certificate
verification for every request made by the process. If a private CA is not in
the operating-system trust store, configure `NODE_EXTRA_CA_CERTS` with the path
to its PEM certificate before starting the server.

```powershell
$env:NODE_EXTRA_CA_CERTS = "C:\path\to\corporate-ca.pem"
npm run dev
```

### Local Stripe Webhook

Keep `npm run dev` running, then start the Stripe CLI in a separate terminal:

```powershell
stripe login
stripe listen --forward-to http://localhost:3001/api/webhooks/stripe
```

Copy the `whsec_...` signing secret printed by Stripe CLI to
`STRIPE_WEBHOOK_SECRET` in `.env.local`, then restart `npm run dev`. Keep the
Stripe listener running while testing payments.

### Local Resend Delivery

Configure the following values in `.env.local`. Use a team-controlled test
mailbox and keep real-recipient delivery disabled:

```dotenv
DELIVERY_WORKER_ENABLED=true
DELIVERY_WORKER_SECRET=replace-with-a-strong-local-secret
DELIVERY_WORKER_MODE=resend
DELIVERY_WORKER_BATCH_SIZE=1
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL="ParaUsted <onboarding@resend.dev>"
RESEND_REPLY_TO_EMAIL=your-team@example.com
RESEND_TEST_RECIPIENT=your-team@example.com
RESEND_ALLOW_REAL_RECIPIENTS=false
```

Restart `npm run dev` after changing `.env.local`. With exactly one test email
in the `delivery_events` queue, invoke the delivery worker from another
PowerShell terminal:

```powershell
$workerSecret = "replace-with-the-same-DELIVERY_WORKER_SECRET"
$headers = @{ Authorization = "Bearer $workerSecret" }
$body = @{ batchSize = 1 } | ConvertTo-Json

Invoke-RestMethod `
	-Method Post `
	-Uri "http://localhost:3001/api/jobs/process-deliveries" `
	-Headers $headers `
	-ContentType "application/json" `
	-Body $body
```

This processes at most one queued email. While
`RESEND_ALLOW_REAL_RECIPIENTS=false`, the provider redirects delivery to
`RESEND_TEST_RECIPIENT`. Do not enable real recipients without completing the
documented production rollout gate.

## Project Structure

```
parausted/
├── .github/              # CI/CD + Copilot instructions
├── docs/                 # All documentation
├── public/               # Static assets
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── (public)/     # Public pages (no auth)
│   │   ├── (merchant)/   # Merchant dashboard (auth required)
│   │   ├── (admin)/      # Platform admin (MFA required)
│   │   └── api/          # API routes
│   ├── components/       # Reusable UI components
│   ├── lib/              # Core libraries (supabase, stripe, delivery)
│   ├── types/            # TypeScript types
│   └── utils/            # Helper functions
├── supabase/
│   ├── migrations/       # SQL migrations (version controlled)
│   └── seed.sql          # Dev test data
└── tests/                # Unit + integration + E2E
```

## Key Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port 3001 with system CAs |
| `npm run build` | Production build |
| `npm run start` | Start production server on port 3001 with system CAs |
| `npm run lint` | ESLint check |
| `npm run typecheck` | TypeScript strict check |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:e2e` | Run E2E tests (Playwright) |
| `supabase db reset` | Reset local DB + run all migrations |
| `supabase db diff` | Generate migration from schema changes |

## Documentation

| Document | Location |
|----------|----------|
| Product Requirements (PRD) | `docs/PRD/ParaUsted_Gold_Class_PRD.md` |
| Architecture Decisions | `docs/architecture/ADR/` |
| API Contract | `docs/architecture/api-contract.md` |
| Code Conventions | `docs/developer/code-conventions.md` |
| Test Strategy | `docs/qa/test-strategy.md` |
| Deployment Runbook | `docs/devops/deployment-runbook.md` |

## License

Proprietary. All rights reserved.
