'use server';

import { isSupportedLocale } from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n/config';
import { merchantOnboardingSchema } from '@/lib/merchants/schema';
import { sanitizeMerchantSlug } from '@/lib/merchants/slug';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export type CreateMerchantProfileResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

// ---------------------------------------------------------------------------
// Fallback messages (no i18n keys exist yet for these flows)
// ---------------------------------------------------------------------------

const FALLBACK_MESSAGES = {
  es: {
    unauthenticated: 'Debes iniciar sesión para crear un perfil de negocio.',
    emailRequired:
      'Tu cuenta necesita un correo electrónico para crear el perfil.',
    duplicateProfile: 'Ya existe un perfil de negocio para esta cuenta.',
    duplicateSlug: 'Esta URL pública ya está en uso.',
    validationFailed: 'Revisa los campos del formulario.',
    createFailed:
      'No se pudo crear el perfil del negocio. Inténtalo de nuevo.',
  },
  en: {
    unauthenticated: 'You must sign in to create a business profile.',
    emailRequired:
      'Your account needs an email address to create the profile.',
    duplicateProfile: 'A business profile already exists for this account.',
    duplicateSlug: 'This public URL is already in use.',
    validationFailed: 'Please review the form fields.',
    createFailed: 'Could not create the business profile. Please try again.',
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveLocale(locale: string): Locale {
  return isSupportedLocale(locale) ? locale : 'es';
}

function getMsg(
  locale: Locale,
): (typeof FALLBACK_MESSAGES)[Locale] {
  return FALLBACK_MESSAGES[locale];
}

function getOptionalFormString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);

  return typeof value === 'string' ? value : undefined;
}

function extractFormFields(formData: FormData): Record<string, unknown> {
  return {
    name: getOptionalFormString(formData, 'name'),
    slug: getOptionalFormString(formData, 'slug'),
    category: getOptionalFormString(formData, 'category'),
    description: getOptionalFormString(formData, 'description'),
    descriptionEn: getOptionalFormString(formData, 'descriptionEn'),
    phone: getOptionalFormString(formData, 'phone'),
    website_url: getOptionalFormString(formData, 'websiteUrl'),
    address: getOptionalFormString(formData, 'address'),
    city: getOptionalFormString(formData, 'city'),
    bizum_phone: getOptionalFormString(formData, 'bizumPhone'),
    bank_iban: getOptionalFormString(formData, 'bankIban'),
    brand_color: getOptionalFormString(formData, 'brandColor'),
  };
}

// ---------------------------------------------------------------------------
// Server action
// ---------------------------------------------------------------------------

export async function createMerchantProfile(
  locale: Locale,
  formData: FormData,
): Promise<CreateMerchantProfileResult> {
  const resolvedLocale = resolveLocale(locale);
  const msg = getMsg(resolvedLocale);

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: msg.unauthenticated };
  }

  if (!user.email) {
    return { ok: false, message: msg.emailRequired };
  }

  // Validate and sanitize form input server-side
  const rawFields = extractFormFields(formData);
  const parsed = merchantOnboardingSchema.safeParse(rawFields);

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.');
      if (!fieldErrors[key]) {
        fieldErrors[key] = [];
      }
      fieldErrors[key].push(issue.message);
    }
    return { ok: false, message: msg.validationFailed, fieldErrors };
  }

  const validated = parsed.data;

  // Ensure slug is sanitized (schema already calls sanitizeMerchantSlug,
  // but we enforce it explicitly as a defense-in-depth measure)
  const slug = sanitizeMerchantSlug(validated.slug);

  // Check if this authenticated user already owns a merchant profile
  const { data: existingProfile } = await supabase
    .from('merchants')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (existingProfile) {
    return { ok: false, message: msg.duplicateProfile };
  }

  // Check if slug is already taken by any merchant
  const { data: slugOwner } = await supabase
    .from('merchants')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (slugOwner) {
    return {
      ok: false,
      message: msg.duplicateSlug,
      fieldErrors: { slug: [msg.duplicateSlug] },
    };
  }

  // Insert the new merchant row — auth_user_id and email come from the session
  const { error: insertError } = await supabase.from('merchants').insert({
    auth_user_id: user.id,
    email: user.email,
    name: validated.name,
    slug,
    category: validated.category,
    description: validated.description ?? null,
    description_en: validated.descriptionEn ?? null,
    phone: validated.phone ?? null,
    website_url: validated.website_url ?? null,
    address: validated.address ?? null,
    city: validated.city,
    bizum_phone: validated.bizum_phone ?? null,
    bank_iban: validated.bank_iban ?? null,
    brand_color: validated.brand_color,
    country: 'ES',
    timezone: 'Europe/Madrid',
    status: 'active',
    plan_tier: 'free',
    onboarded_at: new Date().toISOString(),
  });

  if (insertError) {
    return { ok: false, message: msg.createFailed };
  }

  return { ok: true };
}
