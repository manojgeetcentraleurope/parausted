import { describe, expect, it } from 'vitest';

import { purchaseFormSchema } from '../schema';

const validPurchase = {
  buyerEmail: 'buyer@example.com',
  recipientName: 'Alex',
  recipientEmail: 'alex@example.com',
  relationship: 'amigo',
  designTemplate: 'classic',
  senderName: 'Sam',
  personalMessage: 'Enjoy every moment of this experience.',
  paymentMethod: 'card',
  consentDelivery: 'on',
} as const;

describe('purchaseFormSchema personalization', () => {
  it('should apply safe personalization defaults for existing clients', () => {
    const result = purchaseFormSchema.safeParse(validPurchase);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.occasion).toBe('just_because');
      expect(result.data.fontStyle).toBe('elegant');
    }
  });

  it('should accept a supported occasion and font style', () => {
    const result = purchaseFormSchema.safeParse({
      ...validPurchase,
      occasion: 'birthday',
      fontStyle: 'handwritten',
    });

    expect(result.success).toBe(true);
  });

  it.each([
    { occasion: 'retirement', fontStyle: 'elegant' },
    { occasion: 'birthday', fontStyle: 'comic_sans' },
  ])('should reject unsupported personalization values %#', (personalization) => {
    const result = purchaseFormSchema.safeParse({
      ...validPurchase,
      ...personalization,
    });

    expect(result.success).toBe(false);
  });
});