'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import {
  listPendingPurchases,
  confirmPurchase,
  rejectPurchase,
  type PendingPurchaseRow,
} from './actions';
import type { MessagesShape } from '@/lib/i18n/messages/es';

// ─── Sub-components ──────────────────────────────────────────────

function PaymentMethodBadge({
  method,
  t,
}: {
  method: string;
  t: MessagesShape['purchases'];
}) {
  const labels: Record<string, string> = {
    bizum_direct: t.bizumDirect,
    bank_transfer: t.bankTransfer,
    cash: t.cash,
  };
  const colors: Record<string, string> = {
    bizum_direct: 'bg-purple-100 text-purple-800',
    bank_transfer: 'bg-blue-100 text-blue-800',
    cash: 'bg-green-100 text-green-800',
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[method] ?? 'bg-gray-100 text-gray-800'}`}
    >
      {labels[method] ?? method}
    </span>
  );
}

function ExpiryBadge({
  expiresAt,
  isExpired,
  t,
}: {
  expiresAt: string;
  isExpired: boolean;
  t: MessagesShape['purchases'];
}) {
  if (isExpired) {
    return (
      <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
        {t.expired}
      </span>
    );
  }
  const expiry = new Date(expiresAt);
  const now = new Date();
  const hoursLeft = Math.max(0, Math.round((expiry.getTime() - now.getTime()) / 3_600_000));
  return <span className="text-xs text-gray-500">{hoursLeft}h</span>;
}

// ─── Confirm Dialog ──────────────────────────────────────────────

function ConfirmDialog({
  purchase,
  t,
  onConfirm,
  onCancel,
  isPending,
}: {
  purchase: PendingPurchaseRow;
  t: MessagesShape['purchases'];
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold">{t.confirmTitle}</h3>
        <p className="mt-2 text-sm text-gray-600">{t.confirmMessage}</p>
        <p className="mt-3 text-sm">
          <strong>{t.referenceCode}:</strong> {purchase.reference_code}
        </p>
        <p className="text-sm">
          <strong>{t.amount}:</strong> €{(purchase.amount_cents / 100).toFixed(2)}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isPending ? '...' : t.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reject Dialog ───────────────────────────────────────────────

function RejectDialog({
  purchase,
  t,
  onReject,
  onCancel,
  isPending,
}: {
  purchase: PendingPurchaseRow;
  t: MessagesShape['purchases'];
  onReject: (reason?: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-red-700">{t.rejectTitle}</h3>
        <p className="mt-2 text-sm text-gray-600">{t.rejectMessage}</p>
        <p className="mt-3 text-sm">
          <strong>{t.referenceCode}:</strong> {purchase.reference_code}
        </p>
        <label className="mt-4 block text-sm font-medium">
          {t.rejectReasonLabel}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder={t.rejectReasonPlaceholder}
            className="mt-1 block w-full rounded border p-2 text-sm"
          />
        </label>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded border px-4 py-2 text-sm hover:bg-gray-50"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={() => onReject(reason || undefined)}
            disabled={isPending}
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? '...' : t.reject}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────

interface PurchaseManagerProps {
  messages: MessagesShape;
}

export function PurchaseManager({ messages }: PurchaseManagerProps) {
  const t = messages.purchases;
  const [purchases, setPurchases] = useState<PendingPurchaseRow[]>([]);
  const [search, setSearch] = useState('');
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Dialog state
  const [confirmTarget, setConfirmTarget] = useState<PendingPurchaseRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingPurchaseRow | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────
  const refresh = useCallback(() => {
    startTransition(async () => {
      const result = await listPendingPurchases(search || undefined);
      setPurchases(result.purchases);
    });
  }, [search]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── Handlers ───────────────────────────────────────────────────

  function handleSearch(value: string) {
    setSearch(value);
    // useEffect re-runs on next render via search dependency in refresh
  }

  function handleConfirm() {
    if (!confirmTarget) return;
    const id = confirmTarget.id;
    setConfirmTarget(null);
    startTransition(async () => {
      const result = await confirmPurchase(id);
      if (result.success) {
        setFeedback({ type: 'success', text: t.successConfirmed });
      } else {
        const errKey = result.error;
        const msg =
          errKey === 'already_processed'
            ? t.errorAlreadyProcessed
            : errKey === 'expired'
              ? t.errorExpired
              : errKey === 'not_found'
                ? t.errorNotFound
                : errKey === 'unauthorized'
                  ? t.errorUnauthorized
                  : t.errorUnknown;
        setFeedback({ type: 'error', text: msg });
      }
      refresh();
    });
  }

  function handleReject(reason?: string) {
    if (!rejectTarget) return;
    const id = rejectTarget.id;
    setRejectTarget(null);
    startTransition(async () => {
      const result = await rejectPurchase(id, reason);
      if (result.success) {
        setFeedback({ type: 'success', text: t.successRejected });
      } else {
        const errKey = result.error;
        const msg =
          errKey === 'already_processed'
            ? t.errorAlreadyProcessed
            : errKey === 'not_found'
              ? t.errorNotFound
              : errKey === 'unauthorized'
                ? t.errorUnauthorized
                : t.errorUnknown;
        setFeedback({ type: 'error', text: msg });
      }
      refresh();
    });
  }

  // ── Auto-clear feedback ────────────────────────────────────────
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 5000);
    return () => clearTimeout(timer);
  }, [feedback]);

  // ── Render ─────────────────────────────────────────────────────
  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold">{t.title}</h2>

      {/* Feedback toast */}
      {feedback && (
        <div
          className={`mt-3 rounded p-3 text-sm ${
            feedback.type === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Search */}
      <div className="mt-4">
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="w-full max-w-sm rounded border p-2 text-sm"
        />
      </div>

      {/* List */}
      {purchases.length === 0 && !isPending ? (
        <p className="mt-4 text-sm text-gray-500">{t.noPending}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">{t.referenceCode}</th>
                <th className="px-3 py-2">{t.giftCard}</th>
                <th className="px-3 py-2">{t.amount}</th>
                <th className="px-3 py-2">{t.paymentMethod}</th>
                <th className="px-3 py-2">{t.buyerEmail}</th>
                <th className="px-3 py-2">{t.recipientName}</th>
                <th className="px-3 py-2">{t.createdAt}</th>
                <th className="px-3 py-2">{t.expiresAt}</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {purchases.map((p) => (
                <tr key={p.id} className={p.is_expired ? 'bg-red-50/40' : ''}>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
                    {p.reference_code}
                  </td>
                  <td className="px-3 py-2">{p.gift_card_title}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    €{(p.amount_cents / 100).toFixed(2)}
                  </td>
                  <td className="px-3 py-2">
                    <PaymentMethodBadge method={p.payment_method} t={t} />
                  </td>
                  <td className="px-3 py-2 text-xs">{p.buyer_email_masked}</td>
                  <td className="px-3 py-2">{p.recipient_name}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">
                    {new Date(p.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <ExpiryBadge expiresAt={p.expires_at} isExpired={p.is_expired} t={t} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {!p.is_expired && (
                      <button
                        type="button"
                        onClick={() => setConfirmTarget(p)}
                        className="mr-2 rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
                      >
                        {t.confirmPayment}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setRejectTarget(p)}
                      className="rounded border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                    >
                      {t.rejectPayment}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Loading indicator */}
      {isPending && <p className="mt-2 text-xs text-gray-400">Loading...</p>}

      {/* Dialogs */}
      {confirmTarget && (
        <ConfirmDialog
          purchase={confirmTarget}
          t={t}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmTarget(null)}
          isPending={isPending}
        />
      )}
      {rejectTarget && (
        <RejectDialog
          purchase={rejectTarget}
          t={t}
          onReject={handleReject}
          onCancel={() => setRejectTarget(null)}
          isPending={isPending}
        />
      )}
    </section>
  );
}
