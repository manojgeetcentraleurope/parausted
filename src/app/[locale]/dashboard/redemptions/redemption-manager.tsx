'use client';

import { useState, useTransition } from 'react';
import { redeemVoucherFull } from './actions';

import type { Locale } from '@/lib/i18n/config';
import type { MessagesShape } from '@/lib/i18n/messages/es';

// ─── Helpers ──────────────────────────────────────────────────────

const LOCALE_TO_BCP47: Record<Locale, string> = {
  es: 'es-ES',
  en: 'en-GB',
};

function formatEur(cents: number, locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_TO_BCP47[locale], {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

// ─── Component ────────────────────────────────────────────────────

export type RedemptionManagerProps = {
  messages: MessagesShape;
  locale: Locale;
};

type SuccessState = {
  voucherCode: string;
  amountCents: number;
  balanceAfter: number;
};

export function RedemptionManager({ messages, locale }: RedemptionManagerProps) {
  const t = messages.redemptions;

  const [code, setCode] = useState('');
  const [notes, setNotes] = useState('');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [isPending, startTransition] = useTransition();

  const errorMessages: Record<string, string> = {
    unauthorized: t.errorUnauthorized,
    invalid_code: t.errorInvalidCode,
    not_found: t.errorNotFound,
    already_redeemed: t.errorAlreadyRedeemed,
    expired: t.errorExpired,
    voided: t.errorVoided,
    exchanged: t.errorExchanged,
    not_redeemable: t.errorNotRedeemable,
    already_processed: t.errorAlreadyProcessed,
    unknown: t.errorUnknown,
  };

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorKey(null);
    setSuccess(null);

    const normalizedCode = normalizeCode(code);

    if (normalizedCode.length === 0) {
      setErrorKey('invalid_code');
      return;
    }

    startTransition(async () => {
      const result = await redeemVoucherFull(normalizedCode, notes.trim() || undefined);

      if (!result.success) {
        setErrorKey(result.error ?? 'unknown');
        return;
      }

      setSuccess({
        voucherCode: result.voucherCode ?? normalizedCode,
        amountCents: result.amountCents ?? 0,
        balanceAfter: result.balanceAfter ?? 0,
      });
      setCode('');
      setNotes('');
    });
  }

  return (
    <section className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
      <h2 className="text-xl font-semibold tracking-tight text-slate-950">{t.title}</h2>
      <p className="mt-2 text-sm text-slate-500">{t.description}</p>

      {success !== null && (
        <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5">
          <p className="text-sm font-semibold text-green-800">{t.successTitle}</p>
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="font-medium text-green-700">{t.voucherCodeLabel}</dt>
              <dd className="break-all font-mono font-semibold text-right text-green-900">{success.voucherCode}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="font-medium text-green-700">{t.amountRedeemed}</dt>
              <dd className="font-semibold text-green-900">{formatEur(success.amountCents, locale)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="font-medium text-green-700">{t.balanceAfter}</dt>
              <dd className="font-semibold text-green-900">{formatEur(success.balanceAfter, locale)}</dd>
            </div>
          </dl>
        </div>
      )}

      <form className="mt-6 flex flex-col gap-5" noValidate onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="voucher-code">
            {t.voucherCodeLabel}
          </label>
          <input
            autoComplete="off"
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-sm uppercase text-slate-900 outline-none transition placeholder:normal-case placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200 disabled:opacity-50"
            disabled={isPending}
            id="voucher-code"
            maxLength={32}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setErrorKey(null);
              setSuccess(null);
            }}
            placeholder={t.voucherCodePlaceholder}
            required
            spellCheck={false}
            type="text"
            value={code}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="redemption-notes">
            {t.notesLabel}
          </label>
          <textarea
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-200 disabled:opacity-50"
            disabled={isPending}
            id="redemption-notes"
            maxLength={500}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t.notesPlaceholder}
            rows={3}
            value={notes}
          />
        </div>

        {errorKey !== null && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
            {errorMessages[errorKey] ?? t.errorUnknown}
          </p>
        )}

        <button
          className="inline-flex items-center justify-center rounded-xl bg-cyan-700 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isPending}
          type="submit"
        >
          {isPending ? t.redeeming : t.redeemButton}
        </button>
      </form>
    </section>
  );
}
