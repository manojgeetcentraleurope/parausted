import { describe, expect, it } from 'vitest';

import { redeemRequestSchema } from '../schema';

describe('redeemRequestSchema', () => {
  it.each([
    'ST-BOOKING-1001',
    'booking:1001',
    'seville_tours.redemption-abc123',
  ])('accepts partnerReference %s', (partnerReference) => {
    const result = redeemRequestSchema.safeParse({ partnerReference });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.partnerReference).toBe(partnerReference);
    }
  });

  it.each([
    { partnerReference: 'x'.repeat(129), notes: 'valid notes' },
    { partnerReference: 'booking 1001', notes: 'valid notes' },
    { partnerReference: 'booking/1001', notes: 'valid notes' },
    { partnerReference: 'booking:1001', notes: 'x'.repeat(501) },
  ])('rejects invalid payload %#', (payload) => {
    const result = redeemRequestSchema.safeParse(payload);

    expect(result.success).toBe(false);
  });
});