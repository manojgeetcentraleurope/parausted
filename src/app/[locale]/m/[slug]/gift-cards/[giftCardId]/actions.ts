'use server';

import { headers } from 'next/headers';

import { isSupportedLocale } from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n/config';
import { eurosToCents, centsToEuros } from '@/lib/gift-cards/money';
import type { GiftCardType } from '@/lib/gift-cards/schema';
import {
  purchaseFormSchema,
  extractPurchaseFormData,
  type DirectPaymentMethod,
} from '@/lib/purchases/schema';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getStripeClient } from '@/lib/stripe/server';
import { getClientIpFromHeaders } from '@/lib/security/client-ip';
import { buildRateLimitKey, checkRateLimit } from '@/lib/security/rate-limit';
import { recordSecurityEvent } from '@/lib/security/security-events';
import { resolveAppUrl } from '@/lib/utils/app-url';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RouteContext = {
  locale: string;
  slug: string;
  giftCardId: string;
};

export type PurchaseSuccessData =
  | {
      kind: 'offline_pending';
      referenceCode: string;
      paymentMethod: DirectPaymentMethod;
      displayAmount: string;
      merchantBizumPhone?: string;
      merchantBankIban?: string;
    }
  | {
      kind: 'stripe_checkout';
      checkoutUrl: string;
      referenceCode: string;
      displayAmount: string;
    };

export type PurchaseActionState =
  | null
  | { ok: true; data: PurchaseSuccessData }
  | { ok: false; message: string; fieldErrors?: Partial<Record<string, string[]>> };

type MerchantRecord = {
  id: string;
  bizum_phone: string | null;
  bank_iban: string | null;
  stripe_onboarded: boolean;
  stripe_account_id: string | null;
};

type GiftCardRecord = {
  id: string;
  card_type: GiftCardType;
  title: string;
  amount_cents: number | null;
  min_amount_cents: number | null;
  max_amount_cents: number | null;
};

// ---------------------------------------------------------------------------
// Fallback messages
// ---------------------------------------------------------------------------

const MESSAGES = {
  es: {
    validationFailed: 'Revisa los campos del formulario.',
    merchantNotFound: 'No se encontró el comercio.',
    cardNotFound: 'No se encontró la tarjeta regalo.',
    amountRequired: 'El importe es obligatorio para esta tarjeta.',
    amountInvalid: 'Introduce un importe válido en euros.',
    amountBelowMin: (min: string) => `El importe mínimo es €${min}.`,
    amountAboveMax: (max: string) => `El importe máximo es €${max}.`,
    createFailed: 'No se pudo crear la solicitud. Inténtalo de nuevo.',
    cardNotAvailable: 'El pago con tarjeta no está disponible para este comercio.',
    checkoutFailed: 'No se pudo iniciar el pago. Inténtalo de nuevo.',
    tooManyRequests: 'Demasiadas solicitudes. Inténtalo de nuevo más tarde.',
  },
  en: {
    validationFailed: 'Please review the form fields.',
    merchantNotFound: 'Merchant not found.',
    cardNotFound: 'Gift card not found.',
    amountRequired: 'Amount is required for this gift card.',
    amountInvalid: 'Enter a valid EUR amount.',
    amountBelowMin: (min: string) => `Minimum amount is €${min}.`,
    amountAboveMax: (max: string) => `Maximum amount is €${max}.`,
    createFailed: 'Could not create the request. Please try again.',
    cardNotAvailable: 'Card payment is not available for this merchant.',
    checkoutFailed: 'Could not start card payment. Please try again.',
    tooManyRequests: 'Too many requests. Please try again later.',
  },
} as const;

// ---------------------------------------------------------------------------
// Reference code generation
// ---------------------------------------------------------------------------

// 32-character alphabet with no ambiguous characters (0/O, 1/I/l).
// 256 / 32 = 8 → no modulo bias.
const REFERENCE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateReferenceCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const chars = Array.from(
    bytes,
    (byte) => REFERENCE_CODE_ALPHABET[byte % REFERENCE_CODE_ALPHABET.length],
  );
  return `PU-${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}`;
}

function isUniqueConstraintError(error: { code?: string }): boolean {
  return error.code === '23505';
}

// ---------------------------------------------------------------------------
// Amount derivation
// ---------------------------------------------------------------------------

type AmountResult =
  | { ok: true; amountCents: number; displayAmount: string }
  | { ok: false; fieldError: string };

function deriveAmount(
  card: GiftCardRecord,
  customAmountInput: string | undefined,
  msg: (typeof MESSAGES)[Locale],
): AmountResult {
  if (card.card_type === 'fixed_value' || card.card_type === 'service') {
    const amountCents = card.amount_cents;
    if (amountCents === null || amountCents <= 0) {
      return { ok: false, fieldError: msg.cardNotFound };
    }
    return { ok: true, amountCents, displayAmount: `€${centsToEuros(amountCents)}` };
  }

  // custom_value
  if (!customAmountInput || customAmountInput.length === 0) {
    return { ok: false, fieldError: msg.amountRequired };
  }

  const amountCents = eurosToCents(customAmountInput);
  if (amountCents === null) {
    return { ok: false, fieldError: msg.amountInvalid };
  }

  const min = card.min_amount_cents;
  const max = card.max_amount_cents;

  if (min !== null && amountCents < min) {
    return { ok: false, fieldError: msg.amountBelowMin(centsToEuros(min)) };
  }

  if (max !== null && amountCents > max) {
    return { ok: false, fieldError: msg.amountAboveMax(centsToEuros(max)) };
  }

  return { ok: true, amountCents, displayAmount: `€${centsToEuros(amountCents)}` };
}

// ---------------------------------------------------------------------------
// Payment detail revelation
//
// bizum_phone and bank_iban are fetched but never logged or returned
// unless the buyer specifically selected that payment method after a
// valid pending purchase was successfully created.
// ---------------------------------------------------------------------------

type OfflinePaymentDetails = {
  merchantBizumPhone?: string;
  merchantBankIban?: string;
};

function resolvePaymentDetails(
  paymentMethod: DirectPaymentMethod,
  merchant: MerchantRecord,
): OfflinePaymentDetails {
  if (paymentMethod === 'bizum_direct') {
    return { merchantBizumPhone: merchant.bizum_phone ?? undefined };
  }

  if (paymentMethod === 'bank_transfer') {
    return { merchantBankIban: merchant.bank_iban ?? undefined };
  }

  return {};
}

// ---------------------------------------------------------------------------
// Server action
// ---------------------------------------------------------------------------

export async function createPurchaseAction(
  context: RouteContext,
  _prevState: PurchaseActionState,
  formData: FormData,
): Promise<PurchaseActionState> {
  const locale = isSupportedLocale(context.locale) ? context.locale : 'es';
  const msg = MESSAGES[locale];

  // 0. Rate limit abuse-sensitive purchase creation per client IP (5/min).
  // Throttle before any DB work so spam never reaches the database.
  const clientIp = getClientIpFromHeaders(await headers());
  const rateLimitDecision = await checkRateLimit(
    buildRateLimitKey('purchase_create', clientIp),
    5,
    60,
  );
  if (rateLimitDecision.enforced && !rateLimitDecision.allowed) {
    await recordSecurityEvent({
      eventType: 'rate_limit_purchase_create',
      endpoint: 'createPurchaseAction',
      severity: 'warning',
      ipAddress: clientIp,
      autoAction: 'blocked',
      details: {
        scope: 'purchase_create',
        count: rateLimitDecision.count,
        limit: rateLimitDecision.limit,
      },
    });
    return { ok: false, message: msg.tooManyRequests };
  }

  // 1. Validate form input
  const rawFields = extractPurchaseFormData(formData);
  const parsed = purchaseFormSchema.safeParse(rawFields);

  if (!parsed.success) {
    const fieldErrors: Partial<Record<string, string[]>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.');
      if (key) {
        fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
      }
    }
    return { ok: false, message: msg.validationFailed, fieldErrors };
  }

  const validated = parsed.data;
  const supabase = await createSupabaseServerClient();

  // 2. Fetch active merchant by slug
  const { data: merchantData, error: merchantError } = await supabase
    .from('merchants')
    .select('id, bizum_phone, bank_iban, stripe_onboarded, stripe_account_id')
    .eq('slug', context.slug)
    .eq('status', 'active')
    .single();

  if (merchantError !== null || merchantData === null) {
    return { ok: false, message: msg.merchantNotFound };
  }

  const merchant = merchantData as MerchantRecord;

  // 2a. Server-side card eligibility check — fast fail before DB insert
  if (validated.paymentMethod === 'card') {
    if (!merchant.stripe_onboarded || !merchant.stripe_account_id) {
      return { ok: false, message: msg.cardNotAvailable };
    }
  }

  // 3. Fetch active gift card, verifying it belongs to this merchant
  const { data: cardData, error: cardError } = await supabase
    .from('gift_cards')
    .select('id, card_type, title, amount_cents, min_amount_cents, max_amount_cents')
    .eq('id', context.giftCardId)
    .eq('merchant_id', merchant.id)
    .eq('active', true)
    .single();

  if (cardError !== null || cardData === null) {
    return { ok: false, message: msg.cardNotFound };
  }

  const card = cardData as GiftCardRecord;

  // 4. Derive amount server-side
  const amountResult = deriveAmount(card, validated.customAmountInput, msg);

  if (!amountResult.ok) {
    return {
      ok: false,
      message: msg.validationFailed,
      fieldErrors: { customAmountInput: [amountResult.fieldError] },
    };
  }

  // 5. Insert purchase with retry on unique reference_code collision
  // Initialize Stripe client before insert so a missing key fails fast
  // without leaving an orphaned pending purchase row.
  let stripe: ReturnType<typeof getStripeClient> | null = null;

  if (validated.paymentMethod === 'card') {
  try {
    stripe = getStripeClient();
  } catch (err) {
    console.error('[createPurchaseAction] Stripe client initialization failed', {
      error: err instanceof Error ? err.message : 'unknown',
    });
    return { ok: false, message: msg.checkoutFailed };
  }
}
  const purchaseId = crypto.randomUUID();
  const purchaseInsertData = {
    id: purchaseId,
    merchant_id: merchant.id,
    gift_card_id: card.id,
    amount_cents: amountResult.amountCents,
    currency: 'EUR',
    buyer_email: validated.buyerEmail,
    buyer_name: validated.buyerName ?? null,
    recipient_name: validated.recipientName,
    recipient_email: validated.recipientEmail,
    relationship: validated.relationship,
    design_template: validated.designTemplate,
    occasion: validated.occasion,
    font_style: validated.fontStyle,
    personal_message: validated.personalMessage,
    sender_name: validated.senderName,
    payment_source: validated.paymentMethod === 'card' ? 'ONLINE' : 'OFFLINE',
    payment_method: validated.paymentMethod,
    delivery_method: 'email',
    status: 'pending',
    consent_immediate_delivery: true,
    consent_accepted_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  };

  let insertedReferenceCode: string | null = null;
  const MAX_ATTEMPTS = 3;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const referenceCode = generateReferenceCode();

    const { error: insertError } = await supabase
      .from('purchases')
      .insert({ ...purchaseInsertData, reference_code: referenceCode });

    if (insertError === null) {
      insertedReferenceCode = referenceCode;
      break;
    }

    if (!isUniqueConstraintError(insertError as { code?: string })) {
      return { ok: false, message: msg.createFailed };
    }
  }

  if (insertedReferenceCode === null) {
    return { ok: false, message: msg.createFailed };
  }

  // 6. Card payment: create Stripe Checkout Session
  if (validated.paymentMethod === 'card') {
    const stripeAccountId = merchant.stripe_account_id;
    if (!stripeAccountId) {
      // Defensive: should not reach here due to step 2a check
      return { ok: false, message: msg.cardNotAvailable };
    }

    if (stripe === null) {
      return { ok: false, message: msg.checkoutFailed };
    }

    let checkoutUrl: string;
    try {
      const baseUrl = resolveAppUrl();
      const successUrl = `${baseUrl}/${locale}/m/${context.slug}/gift-cards/${context.giftCardId}?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${baseUrl}/${locale}/m/${context.slug}/gift-cards/${context.giftCardId}?checkout=cancelled`;

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'eur',
              unit_amount: amountResult.amountCents,
              product_data: {
                name: card.title,
              },
            },
            quantity: 1,
          },
        ],
        customer_email: validated.buyerEmail,
        client_reference_id: purchaseId,
        metadata: {
          purchase_id: purchaseId,
          merchant_id: merchant.id,
          gift_card_id: card.id,
        },
        payment_intent_data: {
          metadata: {
            purchase_id: purchaseId,
          },
          transfer_data: {
            destination: stripeAccountId,
          },
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
      });

      if (!session.url) {
        console.error('[createPurchaseAction] Stripe session URL was null', {
          reference_code: `PU-****-${insertedReferenceCode.slice(-4)}`,
        });
        return { ok: false, message: msg.checkoutFailed };
      }

      checkoutUrl = session.url;
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : 'unknown';
      console.error('[createPurchaseAction] Stripe checkout session creation failed', {
        reference_code: `PU-****-${insertedReferenceCode.slice(-4)}`,
        error: errMessage,
      });
      return { ok: false, message: msg.checkoutFailed };
    }

    return {
      ok: true,
      data: {
        kind: 'stripe_checkout',
        checkoutUrl,
        referenceCode: insertedReferenceCode,
        displayAmount: amountResult.displayAmount,
      },
    };
  }

  // 7. Offline payment — return safe success data; details revealed only now
  const paymentDetails = resolvePaymentDetails(validated.paymentMethod, merchant);

  return {
    ok: true,
    data: {
      kind: 'offline_pending',
      referenceCode: insertedReferenceCode,
      paymentMethod: validated.paymentMethod,
      displayAmount: amountResult.displayAmount,
      ...paymentDetails,
    },
  };
}
