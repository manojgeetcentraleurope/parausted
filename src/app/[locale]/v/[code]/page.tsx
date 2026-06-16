import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { isSupportedLocale } from '@/lib/i18n/config';
import { getMessages } from '@/lib/i18n/messages';
import { getCanonicalUrl, getAlternateLanguageUrls } from '@/lib/seo/metadata';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getClientIpFromHeaders } from '@/lib/security/client-ip';
import { buildRateLimitKey, checkRateLimit } from '@/lib/security/rate-limit';
import { fingerprintSensitiveToken } from '@/lib/security/hash';
import { recordSecurityEvent } from '@/lib/security/security-events';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VoucherPageProps = {
  params: Promise<{ locale: string; code: string }>;
};

type PublicVoucherPageRow = {
  code: string;
  original_amount_cents: number;
  balance_cents: number;
  status: string;
  expires_at: string;
  recipient_name: string | null;
  sender_name: string | null;
  personal_message: string | null;
  merchant_name: string | null;
  delivery_channel: string | null;
  delivery_status: string | null;
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
    exchanged: t.statusExchanged,
    expired: t.statusExpired,
    voided: t.statusVoided,
  };
  return map[status] ?? status;
}

function deliveryChannelLabel(
  channel: string,
  t: ReturnType<typeof getMessages>['voucher']
): string {
  const map: Record<string, string> = {
    email: t.deliveryEmail,
    whatsapp: t.deliveryWhatsapp,
    sms: t.deliverySms,
    pdf_download: t.deliveryPdfDownload,
  };
  return map[channel] ?? channel;
}

function deliveryStatusLabel(
  status: string,
  t: ReturnType<typeof getMessages>['voucher']
): string {
  const map: Record<string, string> = {
    queued: t.deliveryQueued,
    sent: t.deliverySent,
    delivered: t.deliveryDelivered,
    failed: t.deliveryFailed,
    downloaded: t.deliveryDownloaded,
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

  // Sanitise code: accept PU and custom branded prefixes with three hex suffix groups.
  // Rejects arbitrary strings before hitting the DB (defence in depth).
  const safeCode = /^[A-Z0-9]+(-[A-Z0-9]+)*-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/i.test(code)
    ? code.toUpperCase()
    : null;
  if (!safeCode) {
    notFound();
  }

  // Rate limit public voucher lookups per client IP (20/min). Throttle before
  // hitting the database; only a hashed fingerprint of the code is ever logged.
  const clientIp = getClientIpFromHeaders(await headers());
  const rateLimitDecision = await checkRateLimit(
    buildRateLimitKey('voucher_lookup', clientIp),
    20,
    60,
  );
  if (rateLimitDecision.enforced && !rateLimitDecision.allowed) {
    await recordSecurityEvent({
      eventType: 'rate_limit_voucher_lookup',
      endpoint: 'VoucherPage',
      severity: 'warning',
      ipAddress: clientIp,
      autoAction: 'blocked',
      details: {
        scope: 'voucher_lookup',
        code_fingerprint: fingerprintSensitiveToken(safeCode),
        count: rateLimitDecision.count,
        limit: rateLimitDecision.limit,
      },
    });
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
        <p className="max-w-md text-center text-base text-gray-600">{t.tooManyRequests}</p>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .rpc('get_public_voucher_page', { p_code: safeCode })
    .maybeSingle();

  if (error) {
    console.error('[VoucherPage] query error:', { message: error.message });
    notFound();
  }

  if (!data) {
    notFound();
  }

  const voucher = data as unknown as PublicVoucherPageRow;
  const purchase = {
    recipient_name: voucher.recipient_name,
    sender_name: voucher.sender_name,
    personal_message: voucher.personal_message,
    merchants: voucher.merchant_name ? { name: voucher.merchant_name } : null,
  };
  const deliveryEvent =
    voucher.delivery_channel && voucher.delivery_status
      ? { channel: voucher.delivery_channel, status: voucher.delivery_status }
      : null;

  const isExpired =
    voucher.status === 'expired' ||
    (voucher.expires_at != null && new Date(voucher.expires_at) < new Date());

  const isVoided = voucher.status === 'voided';
  const isRedeemed = voucher.status === 'redeemed';
  const isExchanged = voucher.status === 'exchanged';

  const expiryDate = new Date(voucher.expires_at).toLocaleDateString(
    locale === 'en' ? 'en-GB' : 'es-ES',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );

  const canonicalVoucherUrl = getCanonicalUrl(`/v/${safeCode}`, locale);
  const whatsAppMessage = [purchase.merchants?.name, canonicalVoucherUrl]
    .filter(Boolean)
    .join(' · ');
  const whatsAppUrl = `https://wa.me/?text=${encodeURIComponent(whatsAppMessage)}`;

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
              isRedeemed || isExpired || isVoided || isExchanged
                ? 'text-red-600'
                : 'text-green-700'
            }
          >
            {statusLabel(voucher.status, t)}
          </span>
        </p>

        {/* Delivery */}
        {deliveryEvent && (
          <p className="mt-1 text-sm">
            <span className="font-medium text-gray-500">{t.delivery}: </span>
            <span className="text-gray-700">
              {deliveryChannelLabel(deliveryEvent.channel, t)} ·{' '}
              {deliveryStatusLabel(deliveryEvent.status, t)}
            </span>
          </p>
        )}

        {/* Code */}
        <div className="mt-6 rounded bg-gray-50 px-4 py-3 text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{t.code}</p>
          <p className="mt-1 font-mono text-xl font-bold tracking-widest text-gray-900 break-all">
            {voucher.code}
          </p>
        </div>

        {/* WhatsApp share */}
        <div className="mt-4 text-center">
          <a
            href={whatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-green-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2"
          >
            {t.shareViaWhatsApp}
          </a>
        </div>
      </div>
    </main>
  );
}
