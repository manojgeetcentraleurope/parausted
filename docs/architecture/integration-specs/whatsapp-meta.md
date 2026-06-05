# Integration Spec: WhatsApp (Meta Business API)

## Overview
WhatsApp is the primary delivery channel for gift cards in Spain. All messages are sent from the BACKEND only. Frontend never triggers WhatsApp messages.

## Setup
1. Create Meta Business Account
2. Create WhatsApp Business App in Meta Developer Portal
3. Get phone number ID + API token
4. Submit message templates for approval (required by Meta)

## Message Templates

### Gift Card Delivery
```
Template Name: gift_card_delivery
Language: es (Spanish)

Body:
🎁 ¡Tienes un regalo!

{{1}} te ha enviado un regalo especial de {{2}}.

"{{3}}"

Abre tu regalo aquí: {{4}}

— Enviado con ParaUsted
```

Parameters:
1. `sender_name` (e.g., "Ana")
2. `merchant_name` (e.g., "Peluquería Carlos")
3. `personal_message` (e.g., "Feliz cumpleaños mamá!")
4. `voucher_url` (e.g., "parausted.es/v/PU-A7F3-K9P2-X8Q1")

## API Call (Backend Only)

```typescript
const response = await fetch(
  `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${WHATSAPP_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: recipientPhone,  // E.164 format: +34612345678
      type: 'template',
      template: {
        name: 'gift_card_delivery',
        language: { code: 'es' },
        components: [{
          type: 'body',
          parameters: [
            { type: 'text', text: senderName },
            { type: 'text', text: merchantName },
            { type: 'text', text: personalMessage },
            { type: 'text', text: voucherUrl },
          ]
        }]
      }
    })
  }
);
```

## Security Rules
- API token stored in server environment variables ONLY
- Frontend NEVER sends WhatsApp messages
- Store `provider_message_id` from response for audit trail
- Rate limit: max 3 deliveries per phone per hour
- Log all delivery attempts in `delivery_events` table

## Costs
- First 1,000 service conversations/month: FREE
- After that: ~€0.04 per conversation (Spain)
