'use server';

import { isSupportedLocale } from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n/config';
import { giftCardFormSchema } from '@/lib/gift-cards/schema';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type CreateGiftCardResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

// ---------------------------------------------------------------------------
// Fallback messages (no i18n keys exist yet for this flow)
// ---------------------------------------------------------------------------

const FALLBACK_MESSAGES = {
  es: {
    unauthenticated: 'Debes iniciar sesión para crear una tarjeta regalo.',
    merchantRequired: 'Completa primero el perfil de tu negocio.',
    validationFailed: 'Revisa los campos de la tarjeta regalo.',
    createFailed: 'No se pudo crear la tarjeta regalo. Inténtalo de nuevo.',
  },
  en: {
    unauthenticated: 'You must sign in to create a gift card.',
    merchantRequired: 'Complete your business profile first.',
    validationFailed: 'Please review the gift card fields.',
    createFailed: 'Could not create the gift card. Please try again.',
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveLocale(locale: string): Locale {
  return isSupportedLocale(locale) ? locale : 'es';
}

function getMsg(locale: Locale): (typeof FALLBACK_MESSAGES)[Locale] {
  return FALLBACK_MESSAGES[locale];
}

function getOptionalFormString(
  formData: FormData,
  key: string,
): string | undefined {
  const value = formData.get(key);
  return typeof value === 'string' ? value : undefined;
}

function extractFormFields(formData: FormData): Record<string, unknown> {
  return {
    cardType: getOptionalFormString(formData, 'cardType'),
    title: getOptionalFormString(formData, 'title'),
    description: getOptionalFormString(formData, 'description'),
    amount: getOptionalFormString(formData, 'amount'),
    minAmount: getOptionalFormString(formData, 'minAmount'),
    maxAmount: getOptionalFormString(formData, 'maxAmount'),
    validDays: getOptionalFormString(formData, 'validDays'),
    active: getOptionalFormString(formData, 'active'),
  };
}

function buildFieldErrors(
  issues: ReadonlyArray<{
    path: ReadonlyArray<PropertyKey>;
    message: string;
  }>,
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.');
    if (!fieldErrors[key]) {
      fieldErrors[key] = [];
    }
    fieldErrors[key].push(issue.message);
  }
  return fieldErrors;
}

// ---------------------------------------------------------------------------
// Server action
// ---------------------------------------------------------------------------

export async function createGiftCard(
  locale: Locale,
  formData: FormData,
): Promise<CreateGiftCardResult> {
  const resolvedLocale = resolveLocale(locale);
  const msg = getMsg(resolvedLocale);

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: msg.unauthenticated };
  }

  // merchant_id comes from the database — never from the client
  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!merchant) {
    return { ok: false, message: msg.merchantRequired };
  }

  const rawFields = extractFormFields(formData);
  const parsed = giftCardFormSchema.safeParse(rawFields);

  if (!parsed.success) {
    return {
      ok: false,
      message: msg.validationFailed,
      fieldErrors: buildFieldErrors(parsed.error.issues),
    };
  }

  const validated = parsed.data;

  const { error: insertError } = await supabase.from('gift_cards').insert({
    merchant_id: merchant.id,
    card_type: validated.card_type,
    title: validated.title,
    description: validated.description ?? null,
    amount_cents: validated.amount_cents ?? null,
    min_amount_cents: validated.min_amount_cents ?? null,
    max_amount_cents: validated.max_amount_cents ?? null,
    valid_days: validated.valid_days,
    active: validated.active,
    sort_order: 0,
  });

  if (insertError) {
    return { ok: false, message: msg.createFailed };
  }

  return { ok: true };
}
