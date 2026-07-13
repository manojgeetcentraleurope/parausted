'use client';

import { useRef, useState, useTransition } from 'react';

import type { Locale } from '@/lib/i18n/config';
import type { MessagesShape } from '@/lib/i18n/messages/es';

// ─── Helpers ──────────────────────────────────────────────────────

const LOCALE_TO_BCP47: Record<Locale, string> = {
  es: 'es-ES',
  en: 'en-GB',
};

type RedeemApiResponse = {
  success: boolean;
  error?: string;
  voucherCode?: string;
  amountCents?: number;
  balanceAfter?: number;
  status?: string;
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

/**
 * Parses a EUR amount string into integer cents at the UI boundary.
 *
 * Accepts an optional value with up to two decimals, using either a dot or a
 * comma as the decimal separator (Spanish locale). Returns `null` for any
 * malformed or non-positive input so the caller can surface a validation
 * error without calling the API. The authoritative amount remains the integer
 * cents enforced by the redemption RPC.
 */
function parseEurToCents(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }
  const cents = Math.round(Number(trimmed) * 100);
  return cents > 0 ? cents : null;
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
  partial: boolean;
};

export function RedemptionManager({ messages, locale }: RedemptionManagerProps) {
  const t = messages.redemptions;

  const [code, setCode] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [isPending, startTransition] = useTransition();

  // Stable idempotency key for a single partial-redemption intent. Generated
  // on first submit, reused across retries of the same intent so a duplicate
  // POST replays the prior result instead of redeeming twice, and cleared when
  // the code or amount changes (a new intent) or after a successful redemption.
  const idempotencyKeyRef = useRef<string | null>(null);

  const errorMessages: Record<string, string> = {
    unauthorized: t.errorUnauthorized,
    invalid_code: t.errorInvalidCode,
    invalid_request: t.errorInvalidCode,
    invalid_amount: t.errorInvalidAmount,
    amount_exceeds_balance: t.errorAmountExceedsBalance,
    not_found: t.errorNotFound,
    already_redeemed: t.errorAlreadyRedeemed,
    expired: t.errorExpired,
    voided: t.errorVoided,
    exchanged: t.errorExchanged,
    not_redeemable: t.errorNotRedeemable,
    already_processed: t.errorAlreadyProcessed,
    rate_limited: t.errorTooManyRequests,
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

    const trimmedAmount = amount.trim();
    let amountCents: number | undefined;
    if (trimmedAmount.length > 0) {
      const parsed = parseEurToCents(trimmedAmount);
      if (parsed === null) {
        setErrorKey('invalid_amount');
        return;
      }
      amountCents = parsed;
    }

    // Partial redemptions carry a stable idempotency key so an accidental
    // duplicate submit cannot redeem twice. Full redemptions do not need one:
    // a repeat attempt fails safely with already_redeemed.
    let idempotencyKey: string | undefined;
    if (amountCents !== undefined) {
      if (idempotencyKeyRef.current === null) {
        idempotencyKeyRef.current = crypto.randomUUID();
      }
      idempotencyKey = idempotencyKeyRef.current;
    }

    startTransition(async () => {
      let result: RedeemApiResponse;
      try {
        const response = await fetch(`/api/vouchers/${encodeURIComponent(normalizedCode)}/redeem`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notes: notes.trim() || undefined,
            amountCents,
            idempotencyKey,
          }),
        });
        result = (await response.json()) as RedeemApiResponse;
      } catch {
        setErrorKey('unknown');
        return;
      }

      if (!result.success) {
        setErrorKey(result.error ?? 'unknown');
        return;
      }

      // Intent complete: rotate the key so the next redemption is distinct.
      idempotencyKeyRef.current = null;

      setSuccess({
        voucherCode: result.voucherCode ?? normalizedCode,
        amountCents: result.amountCents ?? 0,
        balanceAfter: result.balanceAfter ?? 0,
        partial: result.status === 'partially_redeemed',
      });
      setCode('');
      setAmount('');
      setNotes('');
    });
  }

  return (
    <section className="w-full rounded-lg border border-stone-200 bg-white p-5 sm:p-7">
      <h2 className="text-xl font-semibold tracking-tight text-slate-950">{t.title}</h2>
      <p className="mt-2 text-sm text-slate-500">{t.description}</p>

      {success !== null && (
        <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5">
          <p className="text-sm font-semibold text-green-800">
            {success.partial ? t.successTitlePartial : t.successTitle}
          </p>
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
            className="min-h-11 rounded-lg border border-stone-300 bg-stone-50 px-4 py-2.5 font-mono text-base uppercase text-stone-900 outline-none transition placeholder:normal-case placeholder:text-stone-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:opacity-50"
            disabled={isPending}
            id="voucher-code"
            maxLength={32}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setErrorKey(null);
              setSuccess(null);
              idempotencyKeyRef.current = null;
            }}
            placeholder={t.voucherCodePlaceholder}
            required
            spellCheck={false}
            type="text"
            value={code}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="redemption-amount">
            {t.amountLabel}
          </label>
          <input
            autoComplete="off"
            className="min-h-11 rounded-lg border border-stone-300 bg-stone-50 px-4 py-2.5 text-base text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:opacity-50"
            disabled={isPending}
            id="redemption-amount"
            inputMode="decimal"
            onChange={(e) => {
              setAmount(e.target.value);
              setErrorKey(null);
              setSuccess(null);
              idempotencyKeyRef.current = null;
            }}
            placeholder={t.amountPlaceholder}
            spellCheck={false}
            type="text"
            value={amount}
          />
          <p className="text-xs text-slate-500">{t.amountHelp}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="redemption-notes">
            {t.notesLabel}
          </label>
          <textarea
            className="rounded-lg border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:opacity-50"
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
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-teal-800 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          disabled={isPending}
          type="submit"
        >
          {isPending ? t.redeeming : t.redeemButton}
        </button>
      </form>
    </section>
  );
}
