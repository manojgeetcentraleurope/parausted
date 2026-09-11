import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { isSupportedLocale } from '@/lib/i18n/config';
import { getMessages } from '@/lib/i18n/messages';
import { getCanonicalUrl, getAlternateLanguageUrls } from '@/lib/seo/metadata';
import { supabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getClientIpFromHeaders } from '@/lib/security/client-ip';
import { buildRateLimitKey, checkRateLimit } from '@/lib/security/rate-limit';
import { fingerprintSensitiveToken } from '@/lib/security/hash';
import { recordSecurityEvent } from '@/lib/security/security-events';
import { VoucherShareActions } from './voucher-share-actions';

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

const VOUCHER_DESIGNS: Record<string, { surface: string; ink: string; accent: string; mark: string }> = {
  classic: { surface: '#e7dfd1', ink: '#1d211d', accent: '#a14f17', mark: 'EDITION 01' },
  warm: { surface: '#a64f32', ink: '#ffffff', accent: '#f1bd62', mark: 'GOLDEN HOUR' },
  celebration: { surface: '#12565a', ink: '#ffffff', accent: '#e0b55f', mark: 'CELEBRATE' },
  romantic: { surface: '#783642', ink: '#ffffff', accent: '#eac4b0', mark: 'WITH LOVE' },
  family: { surface: '#3d5943', ink: '#ffffff', accent: '#e6c680', mark: 'TOGETHER' },
};

const VOUCHER_FONT_STYLES: Record<string, { display: string; message: string }> = {
  elegant: {
    display: 'gift-font-elegant',
    message: 'gift-font-elegant',
  },
  modern: {
    display: 'gift-font-modern',
    message: 'gift-font-modern',
  },
  handwritten: {
    display: 'gift-font-handwritten',
    message: 'gift-font-handwritten',
  },
};

const OCCASION_LABELS = {
  es: {
    birthday: 'Cumpleaños', anniversary: 'Aniversario', wedding: 'Boda', thank_you: 'Gracias',
    congratulations: 'Enhorabuena', christmas: 'Navidad', just_because: 'Porque sí',
  },
  en: {
    birthday: 'Birthday', anniversary: 'Anniversary', wedding: 'Wedding', thank_you: 'Thank you',
    congratulations: 'Congratulations', christmas: 'Christmas', just_because: 'Just because',
  },
} as const;

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
  const { data: designData, error: designError } = await supabaseAdminClient
    .from('vouchers')
    .select('purchases!inner(design_template, occasion, font_style)')
    .eq('code', safeCode)
    .maybeSingle();

  if (designError) {
    console.error('[VoucherPage] design query error:', { message: designError.message });
  }

  const personalization = (
    designData as unknown as {
      purchases: { design_template: string; occasion: string; font_style: string } | null;
    } | null
  )?.purchases ?? null;
  const purchase = {
    recipient_name: voucher.recipient_name,
    sender_name: voucher.sender_name,
    personal_message: voucher.personal_message,
    design_template: personalization?.design_template ?? null,
    occasion: personalization?.occasion ?? 'just_because',
    font_style: personalization?.font_style ?? 'elegant',
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
  const design = VOUCHER_DESIGNS[purchase.design_template ?? 'classic'] ?? VOUCHER_DESIGNS.classic;
  const fontStyle = VOUCHER_FONT_STYLES[purchase.font_style] ?? VOUCHER_FONT_STYLES.elegant;
  const occasionLabel = OCCASION_LABELS[locale][purchase.occasion as keyof typeof OCCASION_LABELS[typeof locale]]
    ?? OCCASION_LABELS[locale].just_because;
  const recipientLabel = locale === 'en' ? 'A gift chosen for' : 'Un regalo elegido para';
  const experienceLabel = locale === 'en' ? 'Your experience awaits' : 'Tu experiencia te espera';
  const detailsLabel = locale === 'en' ? 'Gift details' : 'Detalles del regalo';

  return (
    <main className="voucher-print-page min-h-screen bg-[#151a17] px-4 py-8 text-[#f6f1e7] sm:px-6 sm:py-14">
      <div className="voucher-print-container mx-auto max-w-5xl">
        <header className="mb-7 flex items-center justify-between gap-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/55">ParaUsted</p>
          <span className={`border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${isRedeemed || isExpired || isVoided || isExchanged ? 'border-red-300/30 text-red-200' : 'border-emerald-300/30 text-emerald-200'}`}>
            {statusLabel(voucher.status, t)}
          </span>
        </header>

        <section className="voucher-print-template grid overflow-hidden shadow-[0_32px_90px_rgba(0,0,0,0.35)] lg:grid-cols-[1.25fr_0.75fr]">
          <div
            className="voucher-print-face relative flex min-h-[520px] flex-col overflow-hidden p-7 sm:min-h-[610px] sm:p-12"
            style={{ backgroundColor: design.surface, color: design.ink }}
          >
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full border-[44px] opacity-15" style={{ borderColor: design.accent }} />
            <div className="absolute bottom-12 right-10 grid grid-cols-4 gap-3 opacity-25" aria-hidden="true">
              {Array.from({ length: 16 }, (_, index) => <span key={index} className="h-1.5 w-1.5 rounded-full bg-current" />)}
            </div>

            <div className="relative flex items-center gap-3 text-[9px] font-semibold uppercase tracking-[0.22em] opacity-60">
              <span>{purchase.merchants?.name ?? 'ParaUsted'}</span>
              <span className="h-px w-8 bg-current opacity-40" />
              <span>{design.mark} · {occasionLabel}</span>
            </div>

            <div className="relative my-auto py-14">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-55">{recipientLabel}</p>
              <h1 className={`mt-4 max-w-xl text-5xl leading-[0.95] sm:text-7xl ${fontStyle.display}`}>
                {purchase.recipient_name ?? t.title}
              </h1>
              {purchase.personal_message && (
                <blockquote className={`mt-8 max-w-lg text-xl leading-7 opacity-80 sm:text-2xl sm:leading-8 ${fontStyle.message}`}>
                  “{purchase.personal_message}”
                </blockquote>
              )}
            </div>

            <div className="relative flex items-end justify-between gap-6 border-t border-current/20 pt-5">
              <div>
                <p className="text-[9px] uppercase tracking-[0.18em] opacity-50">{t.sender}</p>
                <p className={`mt-1 text-xl ${fontStyle.message}`}>{purchase.sender_name ?? 'ParaUsted'}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] uppercase tracking-[0.18em] opacity-50">{experienceLabel}</p>
                <p className={`mt-1 text-3xl ${fontStyle.display}`} style={{ color: design.accent }}>€{(voucher.balance_cents / 100).toFixed(2)}</p>
              </div>
            </div>
          </div>

          <aside className="flex flex-col bg-[#f4efe5] p-7 text-[#1d211d] sm:p-10">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9a4b18]">{detailsLabel}</p>
            <h2 className="mt-4 font-serif text-3xl leading-tight">
              {purchase.merchants?.name ? `${t.titleFrom} ${purchase.merchants.name}` : t.title}
            </h2>

            <dl className="mt-8 divide-y divide-black/10 border-y border-black/10">
              <div className="flex items-start justify-between gap-5 py-4">
                <dt className="text-xs text-black/45">{t.balance}</dt>
                <dd className="font-serif text-xl">€{(voucher.balance_cents / 100).toFixed(2)}</dd>
              </div>
              {voucher.balance_cents !== voucher.original_amount_cents && (
                <div className="flex items-start justify-between gap-5 py-4">
                  <dt className="text-xs text-black/45">{t.originalAmount}</dt>
                  <dd className="text-sm">€{(voucher.original_amount_cents / 100).toFixed(2)}</dd>
                </div>
              )}
              <div className="flex items-start justify-between gap-5 py-4">
                <dt className="text-xs text-black/45">{t.expiresAt}</dt>
                <dd className="text-right text-sm font-medium">{expiryDate}</dd>
              </div>
              {deliveryEvent && (
                <div className="flex items-start justify-between gap-5 py-4">
                  <dt className="text-xs text-black/45">{t.delivery}</dt>
                  <dd className="text-right text-sm font-medium">
                    {deliveryChannelLabel(deliveryEvent.channel, t)} · {deliveryStatusLabel(deliveryEvent.status, t)}
                  </dd>
                </div>
              )}
            </dl>

            <div className="mt-7 border border-black/10 bg-white/60 px-4 py-4">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-black/40">{t.code}</p>
              <p className="mt-2 break-all font-mono text-base font-semibold tracking-[0.12em] text-[#1d211d]">{voucher.code}</p>
            </div>

            <div className="mt-auto pt-6">
              <VoucherShareActions
                whatsAppUrl={whatsAppUrl}
                voucherUrl={canonicalVoucherUrl}
                labels={{
                  shareViaWhatsApp: t.shareViaWhatsApp,
                  copyLink: t.copyLink,
                  linkCopied: t.linkCopied,
                  printPdf: t.printPdf,
                }}
              />
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
