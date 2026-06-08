import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { isSupportedLocale } from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n/config';
import { getCanonicalUrl, getAlternateLanguageUrls } from '@/lib/seo/metadata';
import { centsToEuros } from '@/lib/gift-cards/money';
import type { GiftCardType } from '@/lib/gift-cards/schema';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MerchantRow = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  website_url: string | null;
  city: string;
};

type GiftCardRow = {
  id: string;
  card_type: GiftCardType;
  title: string;
  description: string | null;
  amount_cents: number | null;
  min_amount_cents: number | null;
  max_amount_cents: number | null;
  valid_days: number;
};

type MerchantPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

// ---------------------------------------------------------------------------
// Inline copy (no i18n message keys exist for this page yet)
// ---------------------------------------------------------------------------

type PageCopy = {
  validity: (days: number) => string;
  ctaLabel: string;
  emptyState: string;
  metaTitle: (merchantName: string, city: string) => string;
  metaDescription: (merchantName: string, city: string) => string;
};

const PAGE_COPY: Record<Locale, PageCopy> = {
  es: {
    validity: (days) => `${days} días de validez`,
    ctaLabel: 'Compra próximamente',
    emptyState: 'Este negocio aún no tiene tarjetas regalo activas.',
    metaTitle: (merchantName, city) =>
      `${merchantName} — Tarjetas regalo en ${city} | ParaUsted`,
    metaDescription: (merchantName, city) =>
      `Regala experiencias de ${merchantName}. Compra una tarjeta regalo personalizada en ${city}.`,
  },
  en: {
    validity: (days) => `${days} days validity`,
    ctaLabel: 'Purchase coming soon',
    emptyState: 'This business does not have active gift cards yet.',
    metaTitle: (merchantName, city) =>
      `${merchantName} — Gift cards in ${city} | ParaUsted`,
    metaDescription: (merchantName, city) =>
      `Give experiences from ${merchantName}. Buy a personalized gift card in ${city}.`,
  },
};

const CARD_TYPE_LABEL: Record<GiftCardType, Record<Locale, string>> = {
  fixed_value: { es: 'Valor fijo', en: 'Fixed value' },
  custom_value: { es: 'Valor personalizado', en: 'Custom value' },
  service: { es: 'Servicio', en: 'Service' },
};

const OG_LOCALE: Record<Locale, string> = {
  es: 'es_ES',
  en: 'en_US',
};

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getMerchant(slug: string): Promise<MerchantRow | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('merchants')
    .select('id, name, slug, category, description, website_url, city')
    .eq('slug', slug)
    .eq('status', 'active')
    .single();

  if (error !== null || data === null) {
    return null;
  }

  return data as MerchantRow;
}

async function getGiftCards(merchantId: string): Promise<GiftCardRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('gift_cards')
    .select(
      'id, card_type, title, description, amount_cents, min_amount_cents, max_amount_cents, valid_days',
    )
    .eq('merchant_id', merchantId)
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error !== null || data === null) {
    return [];
  }

  return data as GiftCardRow[];
}

// ---------------------------------------------------------------------------
// Amount display helper
// ---------------------------------------------------------------------------

function formatAmount(card: GiftCardRow): string {
  if (card.card_type === 'custom_value') {
    const min = card.min_amount_cents !== null ? centsToEuros(card.min_amount_cents) : '0.00';
    const max = card.max_amount_cents !== null ? centsToEuros(card.max_amount_cents) : '0.00';
    return `€${min} – €${max}`;
  }

  if (card.amount_cents !== null) {
    return `€${centsToEuros(card.amount_cents)}`;
  }

  return '—';
}

// ---------------------------------------------------------------------------
// generateMetadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: MerchantPageProps): Promise<Metadata> {
  const { locale, slug } = await params;

  if (!isSupportedLocale(locale)) {
    return {};
  }

  const merchant = await getMerchant(slug);

  if (merchant === null) {
    return {};
  }

  const copy = PAGE_COPY[locale];
  const title = copy.metaTitle(merchant.name, merchant.city);
  const description = copy.metaDescription(merchant.name, merchant.city);
  const canonicalUrl = getCanonicalUrl(`/m/${slug}`, locale);
  const alternates = getAlternateLanguageUrls(`/m/${slug}`);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: alternates,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: canonicalUrl,
      siteName: 'ParaUsted',
      locale: OG_LOCALE[locale],
    },
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function MerchantPublicPage({ params }: MerchantPageProps) {
  const { locale, slug } = await params;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const merchant = await getMerchant(slug);

  if (merchant === null) {
    notFound();
  }

  const giftCards = await getGiftCards(merchant.id);
  const copy = PAGE_COPY[locale];

  return (
    <main className="min-h-screen bg-white px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        {/* App name */}
        <p className="text-sm font-medium text-gray-500">ParaUsted</p>

        {/* Merchant header */}
        <h1 className="mt-1 text-3xl font-bold text-gray-900">{merchant.name}</h1>

        {merchant.description !== null && (
          <p className="mt-3 text-gray-600">{merchant.description}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <span>{merchant.category}</span>
          <span>{merchant.city}</span>
          {merchant.website_url !== null && (
            <a
              href={merchant.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {merchant.website_url}
            </a>
          )}
        </div>

        {/* Gift cards section */}
        <section className="mt-10">
          {giftCards.length === 0 ? (
            <p className="text-gray-500">{copy.emptyState}</p>
          ) : (
            <ul className="space-y-4">
              {giftCards.map((card) => (
                <li key={card.id} className="rounded-lg border border-gray-200 p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    {CARD_TYPE_LABEL[card.card_type][locale]}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-gray-900">{card.title}</h2>
                  {card.description !== null && (
                    <p className="mt-1 text-sm text-gray-600">{card.description}</p>
                  )}
                  <p className="mt-2 text-base font-bold text-gray-900">{formatAmount(card)}</p>
                  <p className="mt-1 text-xs text-gray-400">{copy.validity(card.valid_days)}</p>
                  <button
                    type="button"
                    disabled
                    className="mt-4 w-full cursor-not-allowed rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-400"
                  >
                    {copy.ctaLabel}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
