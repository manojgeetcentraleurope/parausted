import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

export const RELATIONSHIP_VALUES = [
  'mama',
  'papa',
  'hija',
  'hijo',
  'abuelo',
  'abuela',
  'pareja',
  'familia',
  'amigo',
  'custom',
] as const;

export type Relationship = (typeof RELATIONSHIP_VALUES)[number];

export const DESIGN_TEMPLATE_VALUES = [
  'classic',
  'warm',
  'celebration',
  'romantic',
  'family',
] as const;

export type DesignTemplate = (typeof DESIGN_TEMPLATE_VALUES)[number];

export const DIRECT_PAYMENT_METHODS = [
  'bizum_direct',
  'bank_transfer',
  'cash',
] as const;

export type DirectPaymentMethod = (typeof DIRECT_PAYMENT_METHODS)[number];

export const ONLINE_PAYMENT_METHODS = ['card'] as const;
export type OnlinePaymentMethod = (typeof ONLINE_PAYMENT_METHODS)[number];

export const PURCHASE_PAYMENT_METHODS = [
  ...DIRECT_PAYMENT_METHODS,
  ...ONLINE_PAYMENT_METHODS,
] as const;
export type PurchasePaymentMethod = (typeof PURCHASE_PAYMENT_METHODS)[number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

// ---------------------------------------------------------------------------
// Purchase form input schema
//
// Accepts raw FormData-derived fields (strings).
// Validates structure and format only.
// Amount range validation is performed server-side against DB values.
// ---------------------------------------------------------------------------

export const purchaseFormSchema = z.object({
  buyerEmail: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Valid email required'),
  buyerName: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform(normalizeOptionalText),
  recipientName: z
    .string()
    .trim()
    .min(1, 'Recipient name is required')
    .max(120),
  recipientEmail: z
    .string()
    .trim()
    .min(1, 'Recipient email is required')
    .email('Valid recipient email required'),
  relationship: z.enum(RELATIONSHIP_VALUES, { message: 'Relationship is required' }),
  designTemplate: z.enum(DESIGN_TEMPLATE_VALUES, { message: 'Design template is required' }),
  senderName: z
    .string()
    .trim()
    .min(1, 'Sender name is required')
    .max(120),
  personalMessage: z
    .string()
    .trim()
    .min(1, 'Personal message is required')
    .max(500),
  // Raw string; the server action parses and validates range against DB.
  customAmountInput: z.string().trim().optional().transform(normalizeOptionalText),
  paymentMethod: z.enum(PURCHASE_PAYMENT_METHODS, { message: 'Payment method is required' }),
  // Checkbox sends 'on' when checked; absent when unchecked fails literal check.
  consentDelivery: z.literal('on', { message: 'Consent is required' }),
});

export type PurchaseFormInput = z.input<typeof purchaseFormSchema>;
export type PurchaseFormOutput = z.output<typeof purchaseFormSchema>;

// ---------------------------------------------------------------------------
// FormData extraction helper
// ---------------------------------------------------------------------------

export function extractPurchaseFormData(formData: FormData): Record<string, unknown> {
  return {
    buyerEmail: getOptionalString(formData.get('buyerEmail')),
    buyerName: getOptionalString(formData.get('buyerName')),
    recipientName: getOptionalString(formData.get('recipientName')),
    recipientEmail: getOptionalString(formData.get('recipientEmail')),
    relationship: getOptionalString(formData.get('relationship')),
    designTemplate: getOptionalString(formData.get('designTemplate')),
    senderName: getOptionalString(formData.get('senderName')),
    personalMessage: getOptionalString(formData.get('personalMessage')),
    customAmountInput: getOptionalString(formData.get('customAmountInput')),
    paymentMethod: getOptionalString(formData.get('paymentMethod')),
    consentDelivery: getOptionalString(formData.get('consentDelivery')),
  };
}
