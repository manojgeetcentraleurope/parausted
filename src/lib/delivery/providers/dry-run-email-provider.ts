import 'server-only';

import type { DeliveryContext } from '../types';
import type { DeliveryProvider, DeliveryProviderResult } from './types';

export class DryRunEmailProvider implements DeliveryProvider {
  async send(input: DeliveryContext): Promise<DeliveryProviderResult> {
    if (input.channel !== 'email') {
      return {
        success: false,
        failureReason: 'unsupported_channel',
        retryable: false,
      };
    }

    return {
      success: true,
      providerMessageId: `dry-run:${input.deliveryEventId}`,
      providerResponse: {
        provider: 'dry-run',
        mode: 'dry_run',
        sent: false,
      },
    };
  }
}
