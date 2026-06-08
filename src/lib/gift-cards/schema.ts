import { z } from 'zod';

import { eurosToCents } from './money';

export const GIFT_CARD_TYPES = ['fixed_value', 'custom_value', 'service'] as const;

export type GiftCardType = (typeof GIFT_CARD_TYPES)[number];

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmedValue = value?.trim();

  return trimmedValue && trimmedValue.length > 0 ? trimmedValue : undefined;
}

function createOptionalTextSchema(maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .transform((value) => normalizeOptionalText(value));
}

function createOptionalEuroAmountSchema(fieldLabel: string) {
  return z
    .string()
    .trim()
    .optional()
    .transform((value, ctx): number | undefined => {
      if (value === undefined || value.length === 0) {
        return undefined;
      }

      const cents = eurosToCents(value);

      if (cents === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${fieldLabel} must be a positive EUR amount.`,
        });
        return z.NEVER;
      }

      return cents;
    });
}

const validDaysSchema = z.preprocess((value) => {
  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    return trimmedValue.length === 0 ? 365 : Number(trimmedValue);
  }

  return value ?? 365;
}, z.number().int().min(365).max(3650));

const activeSchema = z.preprocess((value) => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return ['1', 'true', 'on', 'yes'].includes(value.trim().toLowerCase());
  }

  return true;
}, z.boolean());

const giftCardBaseSchema = z
  .object({
    cardType: z.enum(GIFT_CARD_TYPES),
    title: z.string().trim().min(1, 'Title is required').max(120),
    description: createOptionalTextSchema(1000),
    amount: createOptionalEuroAmountSchema('Amount'),
    minAmount: createOptionalEuroAmountSchema('Minimum amount'),
    maxAmount: createOptionalEuroAmountSchema('Maximum amount'),
    validDays: validDaysSchema,
    active: activeSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    const isSingleAmountCard =
      value.cardType === 'fixed_value' || value.cardType === 'service';

    if (isSingleAmountCard) {
      if (value.amount === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['amount'],
          message: 'Amount is required.',
        });
      }

      if (value.minAmount !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['minAmount'],
          message: 'Minimum amount is not allowed for this card type.',
        });
      }

      if (value.maxAmount !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['maxAmount'],
          message: 'Maximum amount is not allowed for this card type.',
        });
      }

      return;
    }

    if (value.amount !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amount'],
        message: 'Amount is not allowed for this card type.',
      });
    }

    if (value.minAmount === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minAmount'],
        message: 'Minimum amount is required.',
      });
    }

    if (value.maxAmount === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxAmount'],
        message: 'Maximum amount is required.',
      });
    }

    if (
      typeof value.minAmount === 'number' &&
      typeof value.maxAmount === 'number' &&
      value.minAmount >= value.maxAmount
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minAmount'],
        message: 'Minimum amount must be less than maximum amount.',
      });
    }
  })
  .transform((value) => {
    if (value.cardType === 'custom_value') {
      return {
        card_type: value.cardType,
        title: value.title,
        description: value.description,
        amount_cents: undefined,
        min_amount_cents: value.minAmount,
        max_amount_cents: value.maxAmount,
        valid_days: value.validDays,
        active: value.active,
      };
    }

    return {
      card_type: value.cardType,
      title: value.title,
      description: value.description,
      amount_cents: value.amount,
      min_amount_cents: undefined,
      max_amount_cents: undefined,
      valid_days: value.validDays,
      active: value.active,
    };
  });

export const giftCardFormSchema = giftCardBaseSchema;

export type GiftCardFormInput = z.input<typeof giftCardFormSchema>;

export type GiftCardFormData = z.output<typeof giftCardFormSchema>;