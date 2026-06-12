import 'server-only';

import type { DeliveryWorkerMode } from '../types';
import { DryRunEmailProvider } from './dry-run-email-provider';
import { ResendEmailProvider } from './resend-email-provider';
import type { DeliveryProvider } from './types';

export function createDeliveryProvider(mode: DeliveryWorkerMode): DeliveryProvider {
  switch (mode) {
    case 'dry_run':
      return new DryRunEmailProvider();
    case 'resend':
      return new ResendEmailProvider();
    default: {
      const unsupportedMode: never = mode;
      throw new Error(`Unsupported delivery worker mode: ${unsupportedMode}`);
    }
  }
}
