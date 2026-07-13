import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redeemVoucherFullMock = vi.fn();
const redeemVoucherPartialMock = vi.fn();

vi.mock('@/lib/redemptions/redeem-voucher', () => ({
  redeemVoucherFull: redeemVoucherFullMock,
  redeemVoucherPartial: redeemVoucherPartialMock,
}));

const routeModulePromise = import('../route');

function createRequest(body?: unknown): Request {
  return new Request('https://example.test/api/vouchers/PU-123/redeem', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function invokePost(request: Request, code = 'PU-1A2B-3C4D-5E6F'): Promise<Response> {
  const { POST } = await routeModulePromise;
  return POST(request as never, { params: Promise.resolve({ code }) });
}

describe('POST /api/vouchers/[code]/redeem', () => {
  beforeEach(() => {
    redeemVoucherFullMock.mockResolvedValue({
      success: true,
      voucherCode: 'PU-1A2B-3C4D-5E6F',
      amountCents: 5000,
      balanceBefore: 5000,
      balanceAfter: 0,
      redemptionId: 'redemption-1',
      status: 'redeemed',
    });
    redeemVoucherPartialMock.mockResolvedValue({
      success: true,
      voucherCode: 'PU-1A2B-3C4D-5E6F',
      amountCents: 3000,
      balanceBefore: 5000,
      balanceAfter: 2000,
      redemptionId: 'redemption-2',
      status: 'partially_redeemed',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('redeems the full balance when no amount is provided', async () => {
    const response = await invokePost(createRequest({ notes: 'front desk' }));

    expect(redeemVoucherFullMock).toHaveBeenCalledWith('PU-1A2B-3C4D-5E6F', 'front desk');
    expect(redeemVoucherPartialMock).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      status: 'redeemed',
      balanceAfter: 0,
    });
  });

  it('redeems a partial amount and surfaces partially_redeemed status', async () => {
    const response = await invokePost(createRequest({ amountCents: 3000 }));

    expect(redeemVoucherPartialMock).toHaveBeenCalledWith('PU-1A2B-3C4D-5E6F', 3000, undefined, undefined);
    expect(redeemVoucherFullMock).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      amountCents: 3000,
      balanceAfter: 2000,
      status: 'partially_redeemed',
    });
  });

  it('forwards a stable idempotency key to the partial redemption', async () => {
    const response = await invokePost(
      createRequest({ amountCents: 3000, idempotencyKey: 'intent-123' }),
    );

    expect(redeemVoucherPartialMock).toHaveBeenCalledWith(
      'PU-1A2B-3C4D-5E6F',
      3000,
      undefined,
      'intent-123',
    );
    expect(response.status).toBe(200);
  });

  it('rejects a non-positive amount at the schema boundary', async () => {
    const response = await invokePost(createRequest({ amountCents: 0 }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ success: false, error: 'invalid_request' });
    expect(redeemVoucherFullMock).not.toHaveBeenCalled();
    expect(redeemVoucherPartialMock).not.toHaveBeenCalled();
  });

  it('maps amount_exceeds_balance to HTTP 409', async () => {
    redeemVoucherPartialMock.mockResolvedValueOnce({
      success: false,
      error: 'amount_exceeds_balance',
    });

    const response = await invokePost(createRequest({ amountCents: 999999 }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'amount_exceeds_balance',
    });
  });

  it('rejects a malformed voucher code before calling any helper', async () => {
    const response = await invokePost(createRequest({ amountCents: 3000 }), 'not a code');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ success: false, error: 'invalid_code' });
    expect(redeemVoucherPartialMock).not.toHaveBeenCalled();
  });

  it('maps an unauthorized helper result to HTTP 401', async () => {
    redeemVoucherFullMock.mockResolvedValueOnce({ success: false, error: 'unauthorized' });

    const response = await invokePost(createRequest({}));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ success: false, error: 'unauthorized' });
  });
});
