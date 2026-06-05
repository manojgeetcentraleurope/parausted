# Integration Spec: Resend (Email)

## Overview
Resend handles all transactional emails: gift card delivery, receipts, merchant notifications, password resets, expiry reminders.

## Setup
1. Create Resend account
2. Verify sending domain: parausted.es
3. Add DNS records: SPF, DKIM, DMARC (in Cloudflare)
4. Get API key → store in `RESEND_API_KEY` env var

## Email Types

| Email | Recipient | Trigger |
|-------|-----------|---------|
| Gift card delivery | Recipient | Purchase confirmed + delivery method = email |
| Purchase receipt | Buyer | Purchase confirmed |
| Payment verification request | Merchant | New offline purchase awaiting confirmation |
| Redemption confirmation | Recipient | Voucher redeemed |
| Expiry reminder (90d) | Recipient | 90 days before voucher expiry |
| Expiry reminder (30d) | Recipient | 30 days before voucher expiry |
| Refund confirmation | Buyer | Refund processed |
| Password reset | Merchant | Password reset requested |
| Magic link | Merchant | Magic link login requested |

## API Call

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'ParaUsted <regalos@parausted.es>',
  to: recipientEmail,
  subject: '🎁 ¡Tienes un regalo de ' + senderName + '!',
  html: renderGiftCardEmail({
    senderName,
    recipientName,
    merchantName,
    personalMessage,
    voucherUrl,
    designTemplate,
  }),
});
```

## Costs
- Free: 3,000 emails/month
- Pro: 50,000 emails/month — €20/mo
