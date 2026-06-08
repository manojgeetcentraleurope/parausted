'use server';

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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RouteContext = {
  locale: string;
  slug: string;
  giftCardId: string;
};

export type PurchaseSuccessData = {
  referenceCode: string;
  paymentMethod: DirectPaymentMethod;
  displayAmount: string;
  merchantBizumPhone?: string;
  merchantBankIban?: string;
};

export type PurchaseActionState =
  | null
  | { ok: true; data: PurchaseSuccessData }
  | { ok: false; message: string; fieldErrors?: Partial<Record<string, string[]>> };

type MerchantRecord = {
  id: string;
  bizum_phone: string | null;
  bank_iban: string | null;
};

type GiftCardRecord = {
  id: string;
  card_type: GiftCardType;
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

function resolvePaymentDetails(
  paymentMethod: DirectPaymentMethod,
  merchant: MerchantRecord,
): Pick<PurchaseSuccessData, 'merchantBizumPhone' | 'merchantBankIban'> {
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
    .select('id, bizum_phone, bank_iban')
    .eq('slug', context.slug)
    .eq('status', 'active')
    .single();

  if (merchantError !== null || merchantData === null) {
    return { ok: false, message: msg.merchantNotFound };
  }

  const merchant = merchantData as MerchantRecord;

  // 3. Fetch active gift card, verifying it belongs to this merchant
  const { data: cardData, error: cardError } = await supabase
    .from('gift_cards')
    .select('id, card_type, amount_cents, min_amount_cents, max_amount_cents')
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
  const insertData = {
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
    personal_message: validated.personalMessage,
    sender_name: validated.senderName,
    payment_source: 'OFFLINE',
    payment_method: validated.paymentMethod,
    delivery_method: 'email',
    status: 'pending',
    consent_immediate_delivery: true,
    consent_accepted_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  } as const;

  let insertedReferenceCode: string | null = null;
  const MAX_ATTEMPTS = 3;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const referenceCode = generateReferenceCode();

    const { error: insertError } = await supabase
      .from('purchases')
      .insert({ ...insertData, reference_code: referenceCode });

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

  // 6. Return safe success data — payment details revealed only now
  const paymentDetails = resolvePaymentDetails(validated.paymentMethod, merchant);

  return {
    ok: true,
    data: {
      referenceCode: insertedReferenceCode,
      paymentMethod: validated.paymentMethod,
      displayAmount: amountResult.displayAmount,
      ...paymentDetails,
    },
  };
}
