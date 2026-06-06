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

function extractFormFields(formData: FormData): Record<string, unknown> {
  return {
    name: formData.get('name'),
    slug: formData.get('slug'),
    category: formData.get('category'),
    description: formData.get('description'),
    phone: formData.get('phone'),
    website_url: formData.get('websiteUrl'),
    address: formData.get('address'),
    city: formData.get('city'),
    bizum_phone: formData.get('bizumPhone'),
    bank_iban: formData.get('bankIban'),
    brand_color: formData.get('brandColor'),
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
