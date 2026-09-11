'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

import type { Locale } from '@/lib/i18n/config';
import type { MessagesShape } from '@/lib/i18n/messages/es';

import type { VoucherHistoryRow } from './actions';

// --- Constants ---

const LOCALE_TO_BCP47: Record<Locale, string> = {
  es: 'es-ES',
  en: 'en-GB',
};

const VOUCHER_STATUSES = [
  'issued',
  'delivered',
  'partially_redeemed',
  'redeemed',
  'exchanged',
  'expired',
  'voided',
] as const;

const STATUS_COLOR: Record<string, string> = {
  issued: 'bg-blue-100 text-blue-800',
  delivered: 'bg-cyan-100 text-cyan-800',
  partially_redeemed: 'bg-yellow-100 text-yellow-800',
  redeemed: 'bg-green-100 text-green-800',
  exchanged: 'bg-purple-100 text-purple-800',
  expired: 'bg-red-100 text-red-800',
  voided: 'bg-gray-100 text-gray-800',
};

const DELIVERY_STATUS_COLOR: Record<string, string> = {
  queued: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-800',
  delivered: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  downloaded: 'bg-cyan-100 text-cyan-800',
};

// --- Helpers ---

function formatEur(cents: number, locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_TO_BCP47[locale], {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_TO_BCP47[locale], {
    dateStyle: 'medium',
  }).format(new Date(iso));
}

// --- Props ---

export type VoucherHistoryManagerProps = {
  vouchers: VoucherHistoryRow[];
  messages: MessagesShape;
  locale: Locale;
  loadError: string | null;
};

// --- Component ---

export function VoucherHistoryManager({
  vouchers,
  messages,
  locale,
  loadError,
}: VoucherHistoryManagerProps) {
  const t = messages.voucherHistory;
  const vs = messages.voucher;

  const statusLabel: Record<string, string> = {
    issued: vs.statusIssued,
    delivered: vs.statusDelivered,
    partially_redeemed: vs.statusPartiallyRedeemed,
    redeemed: vs.statusRedeemed,
    exchanged: vs.statusExchanged,
    expired: vs.statusExpired,
    voided: vs.statusVoided,
  };

  const deliveryChannelLabel: Record<string, string> = {
    email: t.deliveryEmail,
    whatsapp: t.deliveryWhatsapp,
    sms: t.deliverySms,
    pdf_download: t.deliveryPdfDownload,
  };

  const deliveryStatusLabel: Record<string, string> = {
    queued: t.deliveryQueued,
    sent: t.deliverySent,
    delivered: t.deliveryDelivered,
    failed: t.deliveryFailed,
    downloaded: t.deliveryDownloaded,
  };

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vouchers.filter((v) => {
      const matchesSearch =
        q === '' ||
        v.code.toLowerCase().includes(q) ||
        v.reference_code.toLowerCase().includes(q);
      const matchesStatus = statusFilter === '' || v.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [vouchers, search, statusFilter]);

  return (
    <section className="w-full rounded-lg border border-stone-200 bg-white p-5 sm:p-7">
      <h2 className="text-xl font-semibold tracking-tight text-slate-950">{t.title}</h2>

      {loadError !== null ? (
        <p className="mt-8 text-center text-sm text-slate-500">{t.errorLoad}</p>
      ) : (
        <>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          aria-label={t.searchPlaceholder}
          className="min-h-11 flex-1 rounded-lg border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.searchPlaceholder}
          type="search"
          value={search}
        />
        <select
          aria-label={t.filterLabel}
          className="min-h-11 rounded-lg border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm text-stone-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 sm:w-52"
          onChange={(e) => setStatusFilter(e.target.value)}
          value={statusFilter}
        >
          <option value="">{t.allStatuses}</option>
          {VOUCHER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel[s] ?? s}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-500">{t.empty}</p>
      ) : (
        <div className="mt-5 space-y-3 md:hidden">
          {filtered.map((voucher) => (
            <article key={voucher.id} className="rounded-lg border border-stone-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    className="inline-flex max-w-full items-center gap-1 font-mono text-sm font-bold text-teal-800 underline decoration-teal-300 underline-offset-4"
                    href={`/${locale}/v/${voucher.code}`}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <span className="truncate">{voucher.code}</span>
                    <span aria-hidden="true">↗</span>
                  </Link>
                  <p className="mt-1 truncate text-sm text-stone-600">{voucher.recipient_name}</p>
                </div>
                <span
                  className={`inline-block shrink-0 rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLOR[voucher.status] ?? 'bg-gray-100 text-gray-800'}`}
                >
                  {statusLabel[voucher.status] ?? voucher.status}
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-stone-100 pt-4 text-xs">
                <div>
                  <dt className="text-stone-500">{t.balance}</dt>
                  <dd className="mt-1 text-base font-bold tabular-nums text-stone-950">
                    {formatEur(voucher.balance_cents, locale)}
                  </dd>
                </div>
                <div>
                  <dt className="text-stone-500">{t.originalAmount}</dt>
                  <dd className="mt-1 font-semibold tabular-nums text-stone-800">
                    {formatEur(voucher.original_amount_cents, locale)}
                  </dd>
                </div>
                <div>
                  <dt className="text-stone-500">{t.purchaseRef}</dt>
                  <dd className="mt-1 truncate font-mono font-medium text-stone-800">{voucher.reference_code}</dd>
                </div>
                <div>
                  <dt className="text-stone-500">{t.expiresAt}</dt>
                  <dd className="mt-1 font-medium text-stone-800">{formatDate(voucher.expires_at, locale)}</dd>
                </div>
              </dl>

              {voucher.delivery_channel && voucher.delivery_status ? (
                <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 text-xs">
                  <span className="text-stone-500">{deliveryChannelLabel[voucher.delivery_channel] ?? voucher.delivery_channel}</span>
                  <span className={`rounded-full px-2 py-1 font-medium ${DELIVERY_STATUS_COLOR[voucher.delivery_status] ?? 'bg-gray-100 text-gray-800'}`}>
                    {deliveryStatusLabel[voucher.delivery_status] ?? voucher.delivery_status}
                  </span>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      {filtered.length > 0 ? (
        <div className="mt-6 hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-3 pr-4 font-medium text-slate-500">{t.code}</th>
                <th className="py-3 pr-4 font-medium text-slate-500">{t.status}</th>
                <th className="py-3 pr-4 font-medium text-slate-500">{t.delivery}</th>
                <th className="py-3 pr-4 font-medium text-slate-500">{t.originalAmount}</th>
                <th className="py-3 pr-4 font-medium text-slate-500">{t.balance}</th>
                <th className="py-3 pr-4 font-medium text-slate-500">{t.recipient}</th>
                <th className="py-3 pr-4 font-medium text-slate-500">{t.purchaseRef}</th>
                <th className="py-3 pr-4 font-medium text-slate-500">{t.expiresAt}</th>
                <th className="py-3 font-medium text-slate-500">{t.redeemedAt}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50/50">
                  <td className="py-3 pr-4 font-mono">
                    <Link
                      className="text-cyan-700 underline underline-offset-2 hover:text-cyan-900"
                      href={`/${locale}/v/${v.code}`}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {v.code}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[v.status] ?? 'bg-gray-100 text-gray-800'}`}
                    >
                      {statusLabel[v.status] ?? v.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    {v.delivery_channel && v.delivery_status ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-slate-700">
                          {deliveryChannelLabel[v.delivery_channel] ?? v.delivery_channel}
                        </span>
                        <span
                          className={`inline-block w-fit rounded-full px-2 py-0.5 text-xs font-medium ${DELIVERY_STATUS_COLOR[v.delivery_status] ?? 'bg-gray-100 text-gray-800'}`}
                        >
                          {deliveryStatusLabel[v.delivery_status] ?? v.delivery_status}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 tabular-nums">
                    {formatEur(v.original_amount_cents, locale)}
                  </td>
                  <td className="py-3 pr-4 tabular-nums">{formatEur(v.balance_cents, locale)}</td>
                  <td className="py-3 pr-4">{v.recipient_name}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-slate-600">
                    {v.reference_code}
                  </td>
                  <td className="py-3 pr-4 text-slate-600">{formatDate(v.expires_at, locale)}</td>
                  <td className="py-3 text-slate-600">
                    {v.last_redeemed_at ? formatDate(v.last_redeemed_at, locale) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
        </>
      )}
    </section>
  );
}
