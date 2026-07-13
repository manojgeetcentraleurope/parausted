'use client';

import { useState } from 'react';

import type { Locale } from '@/lib/i18n/config';
import { createStripeConnectOnboardingLink, refreshStripeConnectStatus } from './actions';

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
  refreshButton: string;
  refreshing: string;
  refreshStillIncomplete: string;
  errorNotConnected: string;
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
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [refreshIsError, setRefreshIsError] = useState(false);
  const [localOnboarded, setLocalOnboarded] = useState(stripeOnboarded);

  function getStatusLabel(): string {
    if (localOnboarded) return messages.statusConnected;
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

  async function handleRefreshStatus() {
    setRefreshLoading(true);
    setRefreshMessage(null);
    setError(null);

    try {
      const result = await refreshStripeConnectStatus();

      if (!result.success) {
        setRefreshIsError(true);
        if (result.error === 'not_connected') {
          setRefreshMessage(messages.errorNotConnected);
        } else {
          setRefreshMessage(messages.errorGeneric);
        }
        return;
      }

      if (result.stripeOnboarded) {
        setLocalOnboarded(true);
      } else {
        setRefreshIsError(false);
        setRefreshMessage(messages.refreshStillIncomplete);
      }
    } catch {
      setRefreshIsError(true);
      setRefreshMessage(messages.errorGeneric);
    } finally {
      setRefreshLoading(false);
    }
  }

  const statusLabel = getStatusLabel();

  return (
    <section className="w-full rounded-lg border border-stone-200 bg-white p-5 sm:p-7">
      <h2 className="text-xl font-semibold tracking-tight text-slate-950">{messages.title}</h2>
      <p className="mt-2 text-sm text-slate-600">{messages.description}</p>

      <div className="mt-6 flex items-center gap-3">
        <span className="text-sm font-medium text-slate-500">{messages.statusLabel}:</span>
        <span
          className={[
            'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
            localOnboarded
              ? 'bg-emerald-50 text-emerald-700'
              : stripeAccountId
                ? 'bg-amber-50 text-amber-700'
                : 'bg-slate-100 text-slate-600',
          ].join(' ')}
        >
          {statusLabel}
        </span>
      </div>

      {localOnboarded ? (
        <p className="mt-4 text-sm text-emerald-700">{messages.connectedHint}</p>
      ) : (
        <>
          {error && (
            <p className="mt-4 text-sm font-medium text-red-600" role="alert">
              {error}
            </p>
          )}
          {refreshMessage && (
            <p
              className={`mt-4 text-sm font-medium ${refreshIsError ? 'text-red-600' : 'text-amber-700'}`}
              role={refreshIsError ? 'alert' : 'status'}
            >
              {refreshMessage}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="inline-flex items-center justify-center rounded-xl bg-cyan-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading || refreshLoading}
              onClick={handleConnect}
              type="button"
            >
              {loading ? messages.loading : stripeAccountId ? messages.continueButton : messages.connectButton}
            </button>
            {stripeAccountId && (
              <button
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading || refreshLoading}
                onClick={handleRefreshStatus}
                type="button"
              >
                {refreshLoading ? messages.refreshing : messages.refreshButton}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
