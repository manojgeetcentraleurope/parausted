'use client';

import { useState } from 'react';

import type { Locale } from '@/lib/i18n/config';
import { createStripeConnectOnboardingLink } from './actions';

export type StripeSetupMessages = {
  title: string;
  description: string;
  statusLabel: string;
  statusNotConnected: string;
  statusIncomplete: string;
  statusConnected: string;
  connectButton: string;
  continueButton: string;
  connectedHint: string;
  loading: string;
  errorGeneric: string;
};

type StripeSetupCardProps = {
  locale: Locale;
  messages: StripeSetupMessages;
  stripeAccountId: string | null;
  stripeOnboarded: boolean;
};

export function StripeSetupCard({
  locale,
  messages,
  stripeAccountId,
  stripeOnboarded,
}: StripeSetupCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function getStatusLabel(): string {
    if (stripeOnboarded) return messages.statusConnected;
    if (stripeAccountId) return messages.statusIncomplete;
    return messages.statusNotConnected;
  }

  async function handleConnect() {
    setLoading(true);
    setError(null);

    try {
      const result = await createStripeConnectOnboardingLink(locale);

      if (result.success && result.url) {
        window.location.href = result.url;
        return;
      }

      setError(messages.errorGeneric);
    } catch {
      setError(messages.errorGeneric);
    } finally {
      setLoading(false);
    }
  }

  const statusLabel = getStatusLabel();

  return (
    <section className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
      <h2 className="text-xl font-semibold tracking-tight text-slate-950">{messages.title}</h2>
      <p className="mt-2 text-sm text-slate-600">{messages.description}</p>

      <div className="mt-6 flex items-center gap-3">
        <span className="text-sm font-medium text-slate-500">{messages.statusLabel}:</span>
        <span
          className={[
            'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
            stripeOnboarded
              ? 'bg-emerald-50 text-emerald-700'
              : stripeAccountId
                ? 'bg-amber-50 text-amber-700'
                : 'bg-slate-100 text-slate-600',
          ].join(' ')}
        >
          {statusLabel}
        </span>
      </div>

      {stripeOnboarded ? (
        <p className="mt-4 text-sm text-emerald-700">{messages.connectedHint}</p>
      ) : (
        <>
          {error && (
            <p className="mt-4 text-sm font-medium text-red-600" role="alert">
              {error}
            </p>
          )}
          <button
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-cyan-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
            onClick={handleConnect}
            type="button"
          >
            {loading ? messages.loading : stripeAccountId ? messages.continueButton : messages.connectButton}
          </button>
        </>
      )}
    </section>
  );
}
