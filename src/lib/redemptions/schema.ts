import { z } from 'zod';

/**
 * Validates a voucher code taken from the request URL.
 *
 * Codes are short, opaque, alphanumeric tokens (optionally dash-separated).
 * Normalised to uppercase so lookups are case-insensitive. Kept deliberately
 * strict to reject obviously malformed input at the system boundary before it
 * reaches the redemption RPC.
 */
export const voucherCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[A-Z0-9-]+$/i, 'invalid_code')
  .transform((value) => value.toUpperCase());

/**
 * Validates the JSON body of a redeem request. Notes are an optional,
 * length-capped free-text field recorded with the redemption.
 */
export const redeemRequestSchema = z.object({
  notes: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  amountCents: z
    .number()
    .int('invalid_amount')
    .positive('invalid_amount')
    .max(100_000_000, 'invalid_amount')
    .optional(),
  partnerReference: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9._:-]+$/, 'invalid_partner_reference')
    .optional(),
  idempotencyKey: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .optional(),
});

export type RedeemRequestBody = z.infer<typeof redeemRequestSchema>;
