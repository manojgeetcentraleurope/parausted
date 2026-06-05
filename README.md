# 🎁 ParaUsted

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

# 6. Start dev server
npm run dev

# 7. Open http://localhost:3000
```

### Stripe Webhook Testing (local)

```bash
# In a separate terminal:
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# Copy the webhook signing secret to .env.local as STRIPE_WEBHOOK_SECRET
```

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
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
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
