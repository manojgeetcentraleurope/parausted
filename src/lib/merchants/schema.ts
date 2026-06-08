import { z } from 'zod';

import { sanitizeMerchantSlug } from './slug';

export const MERCHANT_CATEGORIES = [
  'barber',
  'restaurant',
  'tour',
  'gym',
  'school',
  'other',
] as const;

export type MerchantCategory = (typeof MERCHANT_CATEGORIES)[number];

const MERCHANT_SLUG_PATTERN = /^[a-z0-9-]+$/;
const MERCHANT_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const IBAN_PATTERN = /^[A-Z]{2}[0-9A-Z]{13,32}$/;
const URL_LIKE_SLUG_PATTERN = /:\/\/|^www\.|[/.]/i;

function normalizeText(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function normalizeIban(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.replace(/\s+/g, '').toUpperCase();
}

function isValidWebsiteUrl(value: string): boolean {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
}

function isUrlLikeSlug(value: string): boolean {
  return URL_LIKE_SLUG_PATTERN.test(value.trim());
}

function isValidMerchantSlug(value: string): boolean {
  return (
    value.length >= 3 &&
    value.length <= 50 &&
    MERCHANT_SLUG_PATTERN.test(value)
  );
}

const merchantCategorySchema = z
  .string()
  .trim()
  .transform((value) => value.toLowerCase())
  .pipe(z.enum(MERCHANT_CATEGORIES));

const merchantSlugSchema = z
  .string()
  .trim()
  .refine((value) => !isUrlLikeSlug(value), {
    message:
      'Enter only the short public URL name, such as seville-tours. Do not paste a full website URL.',
  })
  .transform((value) => sanitizeMerchantSlug(value))
  .refine(isValidMerchantSlug, {
    message:
      'Slug must be 3 to 50 characters and contain only lowercase letters, numbers, and hyphens.',
  });

function createOptionalTextSchema(maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .transform((value) => normalizeOptionalText(value));
}

const optionalWebsiteUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .optional()
  .transform((value) => normalizeOptionalText(value))
  .refine((value) => value === undefined || isValidWebsiteUrl(value), {
    message: 'Website URL must be a valid http or https URL.',
  });

const optionalIbanSchema = z
  .string()
  .optional()
  .transform((value) => normalizeIban(value))
  .refine((value) => value === undefined || IBAN_PATTERN.test(value), {
    message: 'Bank IBAN must be a valid IBAN.',
  });

const brandColorSchema = z
  .string()
  .optional()
  .transform((value) => normalizeText(value, '#000000').toLowerCase())
  .refine((value) => MERCHANT_COLOR_PATTERN.test(value), {
    message: 'Brand color must be a valid hex color such as #000000.',
  });

const citySchema = z
  .string()
  .optional()
  .transform((value) => normalizeText(value, 'Sevilla'));

export const merchantOnboardingSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(120),
    slug: merchantSlugSchema,
    category: merchantCategorySchema,
    description: createOptionalTextSchema(1000),
    descriptionEn: createOptionalTextSchema(1000),
    phone: createOptionalTextSchema(32),
    website_url: optionalWebsiteUrlSchema,
    address: createOptionalTextSchema(255),
    city: citySchema,
    bizum_phone: createOptionalTextSchema(32),
    bank_iban: optionalIbanSchema,
    brand_color: brandColorSchema,
  })
  .strict();

export type MerchantOnboardingInput = z.input<typeof merchantOnboardingSchema>;