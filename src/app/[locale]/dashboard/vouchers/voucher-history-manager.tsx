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
    <section className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
      <h2 className="text-xl font-semibold tracking-tight text-slate-950">{t.title}</h2>

      {loadError !== null ? (
        <p className="mt-8 text-center text-sm text-slate-500">{t.errorLoad}</p>
      ) : (
        <>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          aria-label={t.searchPlaceholder}
          className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200"
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.searchPlaceholder}
          type="search"
          value={search}
        />
        <select
          aria-label={t.filterLabel}
          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200 sm:w-52"
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
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-3 pr-4 font-medium text-slate-500">{t.code}</th>
                <th className="py-3 pr-4 font-medium text-slate-500">{t.status}</th>
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
      )}
        </>
      )}
    </section>
  );
}
