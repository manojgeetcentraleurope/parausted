import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { isSupportedLocale } from '@/lib/i18n/config';
import { getMessages } from '@/lib/i18n/messages';
import { getCanonicalUrl, getAlternateLanguageUrls } from '@/lib/seo/metadata';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VoucherPageProps = {
  params: Promise<{ locale: string; code: string }>;
};

type VoucherRow = {
  code: string;
  original_amount_cents: number;
  balance_cents: number;
  status: string;
  expires_at: string;
  purchases: {
    recipient_name: string;
    sender_name: string;
    personal_message: string;
    merchants: {
      name: string;
    } | null;
  } | null;
};

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: VoucherPageProps): Promise<Metadata> {
  const { locale, code } = await params;

  if (!isSupportedLocale(locale)) {
    return {};
  }

  const messages = getMessages(locale);
  const canonicalPath = `/v/${code}`;

  return {
    title: messages.voucher.title,
    alternates: {
      canonical: getCanonicalUrl(canonicalPath, locale),
      languages: getAlternateLanguageUrls(canonicalPath),
    },
    robots: { index: false, follow: false },
  };
}

// ---------------------------------------------------------------------------
// Status label helper
// ---------------------------------------------------------------------------

function statusLabel(
  status: string,
  t: ReturnType<typeof getMessages>['voucher']
): string {
  const map: Record<string, string> = {
    issued: t.statusIssued,
    delivered: t.statusDelivered,
    partially_redeemed: t.statusPartiallyRedeemed,
    redeemed: t.statusRedeemed,
    expired: t.statusExpired,
    voided: t.statusVoided,
  };
  return map[status] ?? status;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function VoucherPage({ params }: VoucherPageProps) {
  const { locale, code } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const messages = getMessages(locale);
  const t = messages.voucher;

  // Sanitise code: alphanumeric + dashes only, max 20 chars
  const safeCode = /^[A-Z0-9-]{1,20}$/i.test(code) ? code.toUpperCase() : null;
  if (!safeCode) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('vouchers')
    .select(
      `
      code,
      original_amount_cents,
      balance_cents,
      status,
      expires_at,
      purchases (
        recipient_name,
        sender_name,
        personal_message,
        merchants ( name )
      )
    `
    )
    .eq('code', safeCode)
    .maybeSingle();

  if (error) {
    console.error('[VoucherPage] query error:', { code: safeCode, message: error.message });
    notFound();
  }

  if (!data) {
    notFound();
  }

  const voucher = data as unknown as VoucherRow;
  const purchase = voucher.purchases;

  const isExpired =
    voucher.status === 'expired' ||
    (voucher.expires_at != null && new Date(voucher.expires_at) < new Date());

  const isVoided = voucher.status === 'voided';
  const isRedeemed = voucher.status === 'redeemed';

  const expiryDate = new Date(voucher.expires_at).toLocaleDateString(
    locale === 'en' ? 'en-GB' : 'es-ES',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-md rounded-lg bg-white p-8 shadow-md">
        {/* Merchant */}
        {purchase?.merchants?.name && (
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">
            {purchase.merchants.name}
          </p>
        )}

        <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>

        {/* Recipient */}
        {purchase?.recipient_name && (
          <p className="mt-3 text-base text-gray-700">
            <span className="font-medium">{t.recipient}: </span>
            {purchase.recipient_name}
          </p>
        )}

        {/* Sender */}
        {purchase?.sender_name && (
          <p className="text-sm text-gray-600">
            <span className="font-medium">{t.sender}: </span>
            {purchase.sender_name}
          </p>
        )}

        {/* Message */}
        {purchase?.personal_message && (
          <blockquote className="mt-4 rounded border-l-4 border-gray-200 pl-4 text-sm italic text-gray-600">
            {purchase.personal_message}
          </blockquote>
        )}

        <hr className="my-6" />

        {/* Balance */}
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-gray-500">{t.balance}</span>
          <span className="text-2xl font-bold text-gray-900">
            €{(voucher.balance_cents / 100).toFixed(2)}
          </span>
        </div>

        {voucher.balance_cents !== voucher.original_amount_cents && (
          <p className="mt-1 text-right text-xs text-gray-400">
            {t.originalAmount}: €{(voucher.original_amount_cents / 100).toFixed(2)}
          </p>
        )}

        {/* Expiry */}
        <p className="mt-2 text-sm text-gray-500">
          <span className="font-medium">{t.expiresAt}: </span>
          {expiryDate}
        </p>

        {/* Status */}
        <p className="mt-1 text-sm">
          <span className="font-medium text-gray-500">{t.status}: </span>
          <span
            className={
              isRedeemed || isExpired || isVoided
                ? 'text-red-600'
                : 'text-green-700'
            }
          >
            {statusLabel(voucher.status, t)}
          </span>
        </p>

        {/* Code */}
        <div className="mt-6 rounded bg-gray-50 px-4 py-3 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{t.code}</p>
          <p className="mt-1 font-mono text-xl font-bold tracking-widest text-gray-900">
            {voucher.code}
          </p>
        </div>
      </div>
    </main>
  );
}
