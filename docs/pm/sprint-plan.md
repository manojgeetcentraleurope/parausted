# ParaUsted — MVP Sprint Plan (8 Weeks)

## Week 1: Foundation

### Day 1-2: Project Setup
- [ ] Create Next.js project: `npx create-next-app@latest parausted --typescript --tailwind --app --src-dir`
- [ ] Create Supabase project (EU Frankfurt region)
- [ ] Configure Cloudflare DNS for parausted.es
- [ ] Set up GitHub repo + branch protection on `main`
- [ ] Create `.env.example` + `.env.local`
- [ ] Create `.github/copilot-instructions.md`
- [ ] Set up Husky + lint-staged (pre-commit: lint + typecheck)
- [ ] Create CI workflow: `.github/workflows/ci.yml`

### Day 3-5: Database Schema
- [ ] Run all 13 migration files (see `supabase/migrations/`)
- [ ] Create seed script with test data
- [ ] Verify RLS policies work (test cross-tenant access is blocked)
- [ ] Run `supabase db reset` — confirm clean setup

**Milestone:** Project runs locally. Database has all tables. CI passes.

---

## Week 2: Merchant Experience

### Day 1-2: Authentication
- [ ] Supabase Auth: email/password signup + login
- [ ] Supabase Auth: magic link
- [ ] Supabase Auth: Google OAuth
- [ ] Password recovery flow
- [ ] Auth middleware: extract merchant_id, set RLS context
- [ ] Protected route layout for `/dashboard/*`
- [ ] Login page + Signup page (Spanish UI)

### Day 3-5: Merchant Dashboard (Basic)
- [ ] Onboarding form: business name, slug, category, logo upload, address, phone
- [ ] Gift card CRUD: create, edit, list, toggle active/inactive
- [ ] Three card types: fixed_value, custom_value, service
- [ ] Settings page: Bizum phone, bank IBAN, brand color
- [ ] Merchant profile display on public page

**Milestone:** Merchant can sign up, create gift cards, configure settings.

---

## Week 3: Buyer Experience

### Day 1-3: Public Gift Card Page
- [ ] SSR merchant page: `parausted.es/[slug]`
- [ ] Merchant branding (logo, color, cover image)
- [ ] Gift card list with prices
- [ ] Family card selection UI (Mamá, Papá, Hija, etc.)
- [ ] Design template selection (3-4 templates per family type)
- [ ] Personalization form: recipient name, sender name, personal message (all required)
- [ ] Gift card preview (live preview as user types)
- [ ] OG meta tags for WhatsApp/Instagram sharing

### Day 4-5: Offline Purchase Flow
- [ ] Payment method selection: Bizum / Bank Transfer / Cash
- [ ] Display merchant Bizum phone + reference code (PU-XXXX)
- [ ] "I've sent the payment" button
- [ ] Create purchase record (status: pending)
- [ ] Merchant notification (email): "New payment to verify!"
- [ ] Merchant dashboard: "Confirm Payment" / "Not Received" buttons
- [ ] On confirm → generate voucher → queue delivery
- [ ] 48h auto-expiry cron for unconfirmed purchases

**Milestone:** Complete offline purchase flow works end-to-end.

---

## Week 4: Voucher & Delivery

### Day 1-2: Voucher System
- [ ] Crypto-random voucher code generation (PU-XXXX-XXXX-XXXX)
- [ ] QR code generation (embed voucher URL)
- [ ] Voucher status page: `parausted.es/v/[code]`
- [ ] PDF voucher generation (HTML → PDF, luxury template)
- [ ] PDF stored in Supabase Storage

### Day 3-4: Delivery
- [ ] Email delivery via Resend (branded HTML template)
- [ ] "Download & Send Yourself" option (PDF + shareable link)
- [ ] Delivery events table tracking (queued → sent → delivered → failed)
- [ ] Scheduled delivery: date picker in purchase flow
- [ ] Cron job: process scheduled deliveries every 5 minutes

### Day 5: Redemption
- [ ] Merchant redemption page: enter code OR scan QR
- [ ] Voucher validation: code exists? balance > 0? not expired? correct merchant?
- [ ] Atomic redemption: SELECT...FOR UPDATE + transaction
- [ ] Partial redemption: deduct amount, update balance
- [ ] Redemption confirmation email to recipient
- [ ] Audit event on every redemption

**Milestone:** Full lifecycle works: create → buy (offline) → deliver → redeem.

---

## Week 5: Online Payments (Stripe)

### Day 1-2: Stripe Connect Setup
- [ ] Stripe Connect Express onboarding flow
- [ ] Merchant connects Stripe from dashboard settings
- [ ] Store `stripe_account_id` + `stripe_onboarded` flag
- [ ] Handle Stripe onboarding completion callback

### Day 3-4: Stripe Payment Flow
- [ ] Stripe.js Payment Element on purchase page
- [ ] Create PaymentIntent with `application_fee_amount` (5%)
- [ ] Webhook handler: `payment_intent.succeeded`
- [ ] Webhook signature verification (HMAC)
- [ ] Idempotency: check `processed_webhooks` before processing
- [ ] Auto-generate voucher + queue delivery on payment confirmation

### Day 5: Refund Flow
- [ ] Refund API route: validate refund eligibility (24h / 14d rules)
- [ ] Stripe Refund API call
- [ ] Voucher voiding on full refund
- [ ] Processing fee split calculation (50/50)
- [ ] Refund audit event
- [ ] Refund notification to buyer

**Milestone:** Online payments work. Revenue model active.

---

## Week 6: Financial Engine + WhatsApp

### Day 1-2: Ledger System
- [ ] Create ledger accounts on merchant creation (payable_85, reserve_15, revenue)
- [ ] Auto-create ledger entries on purchase confirmation
- [ ] Double-entry: every entry has matching debit/credit
- [ ] Payout calculation: 85% after 72h, 15% after 14d
- [ ] Payout cron jobs (daily 06:00 UTC)
- [ ] Payout records in `payouts` table

### Day 3-4: WhatsApp Delivery
- [ ] Meta Business API integration (backend Edge Function)
- [ ] WhatsApp message template approval (gift card notification)
- [ ] Send gift card via WhatsApp (link + preview text)
- [ ] Track delivery: `provider_message_id` in `delivery_events`
- [ ] Fallback to email on WhatsApp failure

### Day 5: Dashboard Analytics
- [ ] Sales overview: total cards sold, total revenue, total redeemed
- [ ] Gift card status breakdown (issued, delivered, redeemed, expired)
- [ ] Payout history (pending, completed, total paid out)
- [ ] Recent activity feed (last 20 events)

**Milestone:** Financial tracking complete. WhatsApp delivery works.

---

## Week 7: Security + Audit + Polish

### Day 1-2: Security Hardening
- [ ] Rate limiting middleware (per endpoint — see rate limiting matrix)
- [ ] Security headers (CSP, HSTS, X-Frame-Options, etc.)
- [ ] Zod validation on EVERY API route (review all routes)
- [ ] Input sanitization on personal_message, merchant name, description
- [ ] Fraud flags: velocity checks, self-dealing detection
- [ ] Security events logging

### Day 3-4: Audit + Cron Jobs
- [ ] Audit event insertion on every state change (verify all flows)
- [ ] Cron: `voucher_expiry` (expire past-due vouchers)
- [ ] Cron: `expiry_reminders` (90d + 30d before expiry)
- [ ] Cron: `pii_cleanup` (delete buyer/recipient PII 30d after expiry)
- [ ] Cron: `webhook_cleanup` (delete old processed_webhooks)

### Day 5: UI Polish
- [ ] Mobile responsiveness (buyer page + merchant dashboard)
- [ ] Spanish copy review (every UI string)
- [ ] Loading states (skeletons, spinners)
- [ ] Empty states ("No gift cards yet. Create your first!")
- [ ] Error states (friendly messages, retry buttons)
- [ ] Toast notifications for actions (created, redeemed, etc.)

**Milestone:** Production-quality security. Clean UI.

---

## Week 8: Launch

### Day 1-2: Legal Pages
- [ ] Terms of Service page (`/terminos`)
- [ ] Privacy Policy page (`/privacidad`)
- [ ] Cookie consent banner (essential cookies only, no dark patterns)
- [ ] Purchase consent checkbox (immediate delivery + personalization)
- [ ] Refund policy clearly visible before payment

### Day 3: Testing
- [ ] E2E: Merchant signup → create card → buyer purchases (offline) → deliver → redeem
- [ ] E2E: Merchant signup → connect Stripe → buyer purchases (online) → auto-deliver → redeem
- [ ] E2E: Refund flow (24h full + 14d partial)
- [ ] E2E: Scheduled delivery
- [ ] Security checklist review (Appendix B of PRD)
- [ ] Mobile testing (iOS Safari + Android Chrome)

### Day 4: Go Live
- [ ] Stripe: switch to live mode (pk_live_, sk_live_)
- [ ] Verify production Supabase project (EU Frankfurt)
- [ ] DNS: parausted.es → Vercel production
- [ ] SSL: HTTPS verified
- [ ] Monitoring: Sentry DSN configured for production
- [ ] Monitoring: UptimeRobot checking /api/health every 60s
- [ ] Health check endpoint returns 200
- [ ] Run one test purchase end-to-end in production

### Day 5: First Merchant 🎉
- [ ] Walk into first barbershop in Seville
- [ ] Demo ParaUsted on your phone
- [ ] Help merchant sign up + create first gift card
- [ ] Help them add link to Instagram bio
- [ ] Celebrate first gift card sold 🎁

**Milestone:** LAUNCHED. First paying merchant. Revenue generating.**
