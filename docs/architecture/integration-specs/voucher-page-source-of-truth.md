# Voucher Page Source Of Truth

## Status

State: implemented, hardened, and verified.

This document describes the ParaUsted public voucher page as the canonical gift experience and source of truth.

The canonical voucher page route is:

```text
/[locale]/v/[code]
```

Example:

```text
/es/v/PU-XXXX-XXXX-XXXX
/en/v/PU-XXXX-XXXX-XXXX
```

The voucher page is the authoritative place to view the current gift-card state. Email, WhatsApp, PDF, download links, and QR codes are delivery/access channels only.

## Scope

This document covers:

- public voucher page purpose
- safe voucher lookup by code
- public data boundary
- RLS and RPC access model
- PII minimization
- displayed voucher fields
- status and balance display
- delivery status display
- localization and SEO safety
- operational rules
- verification queries

This document does not cover:

- merchant redemption dashboard internals
- payment confirmation internals
- email provider production rollout
- WhatsApp delivery implementation
- PDF voucher generation
- QR scanner UX
- refund workflow
- partial redemption
- rich-media personalization

## Product Principle

The PRD states that the secure voucher page is the source of truth.

Delivery channels should point to the voucher page, but they should not become the canonical gift experience.

```text
Email/WhatsApp/download/QR -> access channel
/v/[code]                  -> canonical voucher state
```

The voucher page should show the current state of the gift card and should remain safe to share with the intended recipient.

## Core Responsibilities

The voucher page is responsible for showing:

- merchant/business name
- recipient name
- sender name
- personal message
- voucher code
- available balance
- original amount if different from balance
- current voucher status
- expiry/validity date
- delivery channel/status when available

The voucher page must not expose:

- buyer email
- buyer phone
- recipient email
- recipient phone
- Stripe/payment internals
- provider responses
- audit payloads
- internal database IDs
- raw database errors

## Route

The implemented route is:

```text
src/app/[locale]/v/[code]/page.tsx
```

This route supports localized voucher pages under the configured locale routes.

## Voucher Code As Access Token

The voucher code is treated as an access-token-like secret.

The page validates the format before querying the database.

Expected format:

```text
PU-XXXX-XXXX-XXXX
```

Invalid voucher-code formats should return a safe not-found response.

The page must not log voucher codes in server logs.

## Public Access Model

The public voucher page no longer reads directly from the `vouchers` table.

Instead, it calls the safe database RPC:

```text
public.get_public_voucher_page(TEXT)
```

The page uses:

```text
supabase.rpc('get_public_voucher_page', { p_code: safeCode })
```

This keeps the voucher page usable while avoiding broad public table access.

## Database Access Boundary

The base `vouchers` table is not directly readable by anonymous users.

The previous broad policy was removed:

```text
public_read_by_code
```

The current public access boundary is:

```text
anon -> EXECUTE get_public_voucher_page(code)
public.vouchers direct anon SELECT -> blocked
```

## Safe Public Voucher RPC

The safe RPC is:

```text
public.get_public_voucher_page(p_code TEXT)
```

It is configured as:

```text
SECURITY DEFINER
search_path = public, pg_temp
```

It validates the voucher-code format and returns only safe fields needed by the public voucher page.

## RPC Return Fields

The RPC returns these fields:

```text
code
original_amount_cents
balance_cents
status
expires_at
recipient_name
sender_name
personal_message
merchant_name
delivery_channel
delivery_status
```

These fields support the gift experience while avoiding contact PII and payment internals.

## PII Exclusion Rules

The public voucher RPC must not return:

```text
buyer_email
buyer_phone
recipient_email
recipient_phone
stripe_payment_intent_id
provider_response
audit payloads
internal IDs
```

The B11.2 verification confirmed the RPC source does not mention buyer/recipient contact fields, Stripe internals, or provider responses.

## Current Displayed Fields

The voucher page currently displays:

```text
merchant name
recipient name
sender name
personal message
available balance
original amount when different from balance
expiry date
voucher status
delivery channel and delivery status
voucher code
```

This is aligned with the PRD direction for a personalized gift experience.

## Status Handling

The page maps voucher statuses to localized labels.

Supported status labels include:

```text
issued
delivered
partially_redeemed
redeemed
exchanged
expired
voided
```

For V1, the most important user-facing states are:

```text
issued/delivered -> usable
redeemed         -> already used
expired          -> not redeemable
voided           -> not valid
exchanged        -> no longer redeemable in this form
```

## Balance Display

The voucher page shows:

```text
balance_cents
```

If the balance differs from the original value, it also shows:

```text
original_amount_cents
```

This supports current full redemption and future partial redemption visibility.

## Expiry And Validity

The page shows:

```text
expires_at
```

Public copy must remain conservative because Spain gift-card validity and expiry require legal review.

Avoid absolute or aggressive claims such as:

```text
No refund ever.
Legally guaranteed.
Expires without conditions.
```

Use careful language around validity and merchant conditions.

## Delivery Status

The voucher page can display the latest delivery event returned by the RPC.

Safe public delivery fields are:

```text
delivery_channel
delivery_status
```

The page must not expose provider response payloads, recipient contact addresses, message IDs beyond safe display needs, or internal delivery metadata.

## SEO And Indexing

Voucher pages are private/shareable access-token pages, not SEO landing pages.

The page sets:

```text
robots: index false, follow false
```

This is correct because voucher codes should not be indexed by search engines.

## Localization

The voucher page uses localized messages from:

```text
src/lib/i18n/messages/es.ts
src/lib/i18n/messages/en.ts
```

Spanish is the primary language and English is the secondary language.

The route supports localized paths through the existing locale routing system.

## Error Handling

Invalid codes, unsupported locales, missing vouchers, and query errors should return safe not-found behavior.

Server logs must not include voucher codes.

Safe logging example:

```text
[VoucherPage] query error: { message }
```

Unsafe logging example:

```text
[VoucherPage] query error: { code, message }
```

The unsafe pattern was removed during B11.2.

## Security Verification Summary

B11.2 remote verification confirmed:

```text
public_read_by_code policy removed
merchant_manage voucher policy remains
anon has no direct vouchers table privileges
get_public_voucher_page is SECURITY DEFINER
get_public_voucher_page search_path = public, pg_temp
anon can execute get_public_voucher_page
authenticated can execute get_public_voucher_page
public cannot execute get_public_voucher_page
```

B11.2 source verification also confirmed the RPC does not mention:

```text
buyer_email
buyer_phone
recipient_email
recipient_phone
stripe
provider_response
```

and does return:

```text
recipient_name
sender_name
personal_message
merchant_name
```

## Operational Rules

Do not restore broad public SELECT on `vouchers`.

Do not re-create `public_read_by_code` with `USING (true)`.

Do not query `vouchers` directly from the public voucher page.

Do not expose contact PII on `/v/[code]`.

Do not log voucher codes from public page errors.

Do not expose payment provider internals on the voucher page.

Do not index voucher pages.

Do not treat delivery email/WhatsApp/PDF as the source of truth.

## Verification Queries

### Voucher Policies

```sql
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'vouchers'
ORDER BY policyname;
```

Expected:

```text
public_read_by_code should not exist
merchant_manage should still exist
```

### Voucher Table Privileges

```sql
SELECT
  table_schema,
  table_name,
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'vouchers'
  AND grantee IN ('anon', 'authenticated', 'public')
ORDER BY grantee, privilege_type;
```

Expected:

```text
anon should not have direct privileges on vouchers
authenticated may retain privileges constrained by RLS
```

### Public Voucher RPC Permission

```sql
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  p.prosecdef AS security_definer,
  p.proconfig AS function_config,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
  has_function_privilege('public', p.oid, 'EXECUTE') AS public_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'get_public_voucher_page';
```

Expected:

```text
security_definer = true
function_config includes search_path=public, pg_temp
anon_can_execute = true
authenticated_can_execute = true
public_can_execute = false
```

### Safe Field Verification

```sql
SELECT
  p.proname AS function_name,
  position('buyer_email' IN pg_get_functiondef(p.oid)) > 0 AS mentions_buyer_email,
  position('buyer_phone' IN pg_get_functiondef(p.oid)) > 0 AS mentions_buyer_phone,
  position('recipient_email' IN pg_get_functiondef(p.oid)) > 0 AS mentions_recipient_email,
  position('recipient_phone' IN pg_get_functiondef(p.oid)) > 0 AS mentions_recipient_phone,
  position('stripe' IN lower(pg_get_functiondef(p.oid))) > 0 AS mentions_stripe,
  position('provider_response' IN pg_get_functiondef(p.oid)) > 0 AS mentions_provider_response,
  position('recipient_name' IN pg_get_functiondef(p.oid)) > 0 AS returns_recipient_name,
  position('sender_name' IN pg_get_functiondef(p.oid)) > 0 AS returns_sender_name,
  position('personal_message' IN pg_get_functiondef(p.oid)) > 0 AS returns_personal_message,
  position('merchant_name' IN pg_get_functiondef(p.oid)) > 0 AS returns_merchant_name
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'get_public_voucher_page';
```

Expected:

```text
mentions_buyer_email = false
mentions_buyer_phone = false
mentions_recipient_email = false
mentions_recipient_phone = false
mentions_stripe = false
mentions_provider_response = false
returns_recipient_name = true
returns_sender_name = true
returns_personal_message = true
returns_merchant_name = true
```

## Acceptance Criteria

- [ ] Voucher page validates voucher code format before lookup.
- [ ] Voucher page uses `get_public_voucher_page`, not direct `vouchers` table reads.
- [ ] `public_read_by_code` broad policy is removed.
- [ ] Anonymous users have no direct `vouchers` table privileges.
- [ ] Public voucher RPC is `SECURITY DEFINER`.
- [ ] Public voucher RPC has safe `search_path`.
- [ ] Public voucher RPC returns only safe public display fields.
- [ ] Public voucher RPC excludes buyer/recipient contact PII.
- [ ] Public voucher RPC excludes payment/provider internals.
- [ ] Voucher code is not logged on page query errors.
- [ ] Voucher pages are not indexed by search engines.
- [ ] Voucher page remains localized in Spanish and English.

## PRD Alignment

This implementation supports the PRD principle:

```text
Secure voucher page is source of truth.
```

The page displays the personal gift experience while keeping contact PII and payment internals out of public responses.

This keeps ParaUsted aligned with:

```text
Spain-first legal safety
privacy-conscious public pages
secure voucher lifecycle
personalized digital gift experience
```

## Related Files

Application:

```text
src/app/[locale]/v/[code]/page.tsx
src/lib/i18n/messages/es.ts
src/lib/i18n/messages/en.ts
```

Database:

```text
supabase/migrations/20260605200725_create_vouchers.sql
supabase/migrations/20260612120000_harden_public_voucher_page_access.sql
```

Related docs:

```text
docs/architecture/integration-specs/payment-confirmation-voucher-issuance.md
docs/architecture/integration-specs/voucher-redemption-flow.md
docs/architecture/integration-specs/delivery-worker.md
docs/architecture/integration-specs/resend-production-rollout-gate.md
```

## Known Deferred Items

- richer voucher page design
- merchant logo/branding
- QR code rendering
- merchant redemption instructions
- conservative legal/validity copy review
- PDF voucher generation
- WhatsApp-specific voucher sharing
- rich-media personalization
- relationship/design theme display
- wallet pass investigation

## Non-Goals

- No payment flow changes.
- No redemption flow changes.
- No email provider changes.
- No WhatsApp implementation.
- No PDF generation.
- No rich-media implementation.
- No marketplace/discovery changes.
