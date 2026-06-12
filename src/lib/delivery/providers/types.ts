import type { DeliveryContext } from '../types';

export type DeliveryProviderResult =
  | {
      success: true;
      providerMessageId: string;
      providerResponse: Record<string, unknown>;
    }
  | {
      success: false;
      failureReason: string;
      retryable: boolean;
      retryAfterSeconds?: number;
      providerResponse?: Record<string, unknown>;
    };

export interface DeliveryProvider {
  send(input: DeliveryContext): Promise<DeliveryProviderResult>;
}
