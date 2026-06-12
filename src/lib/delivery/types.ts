export type DeliveryWorkerMode = 'dry_run';

export type ClaimedDeliveryEvent = {
  delivery_event_id: string;
  purchase_id: string;
  voucher_id: string | null;
  merchant_id: string;
  channel: string;
  recipient_contact: string;
  attempt_count: number;
  max_attempts: number;
  idempotency_key: string | null;
  locked_at: string;
  locked_by: string;
};

export type DeliveryContext = {
  deliveryEventId: string;
  purchaseId: string;
  voucherId: string;
  merchantId: string;
  channel: 'email';
  recipientContact: string;
  idempotencyKey: string;
  voucherCode: string;
  voucherUrl: string;
  recipientName: string;
  senderName: string;
  personalMessage: string;
  merchantName: string;
  amountCents: number;
  currency: string;
  locale: 'es' | 'en';
};

export type ProcessDeliveryResult = {
  deliveryEventId: string;
  ok: boolean;
  status: 'sent' | 'failed' | 'retry_scheduled';
  providerMessageId?: string;
  error?: string;
};

export type DeliveryWorkerSummary = {
  claimed: number;
  processed: number;
  sent: number;
  failed: number;
  retryScheduled: number;
  results: ProcessDeliveryResult[];
};
