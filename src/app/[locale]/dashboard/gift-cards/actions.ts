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

export type UpdateGiftCardResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

export type ToggleGiftCardActiveResult =
  | { ok: true }
  | { ok: false; message: string };

// ---------------------------------------------------------------------------
// Fallback messages (no i18n keys exist yet for this flow)
// ---------------------------------------------------------------------------

const FALLBACK_MESSAGES = {
  es: {
    unauthenticated: 'Debes iniciar sesión para gestionar tarjetas regalo.',
    merchantRequired: 'Completa primero el perfil de tu negocio.',
    validationFailed: 'Revisa los campos de la tarjeta regalo.',
    createFailed: 'No se pudo crear la tarjeta regalo. Inténtalo de nuevo.',
    updateFailed: 'No se pudo actualizar la tarjeta regalo. Inténtalo de nuevo.',
    toggleFailed: 'No se pudo cambiar el estado de la tarjeta regalo. Inténtalo de nuevo.',
    notFound: 'No se encontró la tarjeta regalo o no tienes permiso para modificarla.',
  },
  en: {
    unauthenticated: 'You must sign in to manage gift cards.',
    merchantRequired: 'Complete your business profile first.',
    validationFailed: 'Please review the gift card fields.',
    createFailed: 'Could not create the gift card. Please try again.',
    updateFailed: 'Could not update the gift card. Please try again.',
    toggleFailed: 'Could not change the gift card status. Please try again.',
    notFound: 'The gift card was not found or you do not have permission to modify it.',
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
    titleEn: getOptionalFormString(formData, 'titleEn'),
    description: getOptionalFormString(formData, 'description'),
    descriptionEn: getOptionalFormString(formData, 'descriptionEn'),
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

async function getAuthenticatedMerchant(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  msg: (typeof FALLBACK_MESSAGES)[Locale],
): Promise<{ ok: true; merchantId: string } | { ok: false; message: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: msg.unauthenticated };
  }

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!merchant) {
    return { ok: false, message: msg.merchantRequired };
  }

  return { ok: true, merchantId: merchant.id as string };
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

  const authResult = await getAuthenticatedMerchant(supabase, msg);
  if (!authResult.ok) {
    return authResult;
  }
  const { merchantId } = authResult;

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
    merchant_id: merchantId,
    card_type: validated.card_type,
    title: validated.title,
    title_en: validated.title_en ?? null,
    description: validated.description ?? null,
    description_en: validated.description_en ?? null,
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

// ---------------------------------------------------------------------------
// Update gift card
// ---------------------------------------------------------------------------

export async function updateGiftCard(
  locale: Locale,
  giftCardId: string,
  formData: FormData,
): Promise<UpdateGiftCardResult> {
  const resolvedLocale = resolveLocale(locale);
  const msg = getMsg(resolvedLocale);

 if (giftCardId.trim().length === 0) {
  return { ok: false, message: msg.notFound };
}

  const supabase = await createSupabaseServerClient();

  const authResult = await getAuthenticatedMerchant(supabase, msg);
  if (!authResult.ok) {
    return authResult;
  }
  const { merchantId } = authResult;

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

  const { data: updated, error: updateError } = await supabase
    .from('gift_cards')
    .update({
      card_type: validated.card_type,
      title: validated.title,
      title_en: validated.title_en ?? null,
      description: validated.description ?? null,
      description_en: validated.description_en ?? null,
      amount_cents: validated.amount_cents ?? null,
      min_amount_cents: validated.min_amount_cents ?? null,
      max_amount_cents: validated.max_amount_cents ?? null,
      valid_days: validated.valid_days,
      active: validated.active,
    })
    .eq('id', giftCardId)
    .eq('merchant_id', merchantId)
    .select('id')
    .maybeSingle();

  if (updateError) {
    return { ok: false, message: msg.updateFailed };
  }

  if (!updated) {
    return { ok: false, message: msg.notFound };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Toggle gift card active status
// ---------------------------------------------------------------------------

export async function toggleGiftCardActive(
  locale: Locale,
  giftCardId: string,
  active: boolean,
): Promise<ToggleGiftCardActiveResult> {
  const resolvedLocale = resolveLocale(locale);
  const msg = getMsg(resolvedLocale);

 
if (giftCardId.trim().length === 0) {
  return { ok: false, message: msg.notFound };
}


  const supabase = await createSupabaseServerClient();

  const authResult = await getAuthenticatedMerchant(supabase, msg);
  if (!authResult.ok) {
    return authResult;
  }
  const { merchantId } = authResult;

  const { data: updated, error: updateError } = await supabase
    .from('gift_cards')
    .update({ active })
    .eq('id', giftCardId)
    .eq('merchant_id', merchantId)
    .select('id')
    .maybeSingle();

  if (updateError) {
    return { ok: false, message: msg.toggleFailed };
  }

  if (!updated) {
    return { ok: false, message: msg.notFound };
  }

  return { ok: true };
}
