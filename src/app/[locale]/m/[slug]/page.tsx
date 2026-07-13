import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';

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
  description_en: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  brand_color: string;
  website_url: string | null;
  address: string | null;
  city: string;
};

type GiftCardRow = {
  id: string;
  card_type: GiftCardType;
  title: string;
  title_en: string | null;
  description: string | null;
  description_en: string | null;
  amount_cents: number | null;
  min_amount_cents: number | null;
  max_amount_cents: number | null;
  valid_days: number;
};

type GiftPresentation = {
  occasion: Record<Locale, string>;
  promise: Record<Locale, string>;
  imageUrl: string;
  surface: string;
  ink: string;
  accent: string;
  motif: string;
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
  eyebrow: string;
  heroTitle: string;
  heroDescription: string;
  collectionLabel: string;
  collectionTitle: string;
  collectionDescription: string;
  deliveryLabel: string;
  deliveryTitle: string;
  deliveryDescription: string;
  trustItems: readonly string[];
  metaTitle: (merchantName: string, city: string) => string;
  metaDescription: (merchantName: string, city: string) => string;
};

const PAGE_COPY: Record<Locale, PageCopy> = {
  es: {
    validity: (days) => `${days} días de validez`,
    ctaLabel: 'Personalizar regalo',
    emptyState: 'Este negocio aún no tiene tarjetas regalo activas.',
    eyebrow: 'Experiencias para regalar',
    heroTitle: 'Regala un recuerdo, no una cosa.',
    heroDescription: 'Elige una experiencia, escribe tu dedicatoria y nosotros preparamos el momento.',
    collectionLabel: 'Elige la experiencia',
    collectionTitle: 'Un regalo hecho a su medida',
    collectionDescription: 'Cada tarjeta se puede personalizar y se activa solo después de confirmar el pago.',
    deliveryLabel: 'Entrega digital',
    deliveryTitle: 'Lista para emocionar desde el primer mensaje',
    deliveryDescription: 'Una presentación cuidada, un mensaje personal y acceso seguro a la tarjeta desde el móvil.',
    trustItems: ['Pago seguro', 'Entrega tras confirmar el pago', '12 meses de validez'],
    metaTitle: (merchantName, city) =>
      `${merchantName} — Tarjetas regalo en ${city} | ParaUsted`,
    metaDescription: (merchantName, city) =>
      `Regala experiencias de ${merchantName}. Compra una tarjeta regalo personalizada en ${city}.`,
  },
  en: {
    validity: (days) => `${days} days validity`,
    ctaLabel: 'Personalize gift',
    emptyState: 'This business does not have active gift cards yet.',
    eyebrow: 'Experiences worth giving',
    heroTitle: 'Give a memory, not a thing.',
    heroDescription: 'Choose an experience, write your message, and we will prepare the moment.',
    collectionLabel: 'Choose the experience',
    collectionTitle: 'A gift made for them',
    collectionDescription: 'Every card can be personalized and is activated only after payment confirmation.',
    deliveryLabel: 'Digital delivery',
    deliveryTitle: 'Made to delight from the first message',
    deliveryDescription: 'A considered presentation, a personal note, and secure mobile access to the gift card.',
    trustItems: ['Secure payment', 'Delivery after payment', '12 months validity'],
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

const CATEGORY_LABEL: Record<string, Record<Locale, string>> = {
  barber: { es: 'Barbería', en: 'Barber' },
  restaurant: { es: 'Restaurante', en: 'Restaurant' },
  tour: { es: 'Tours y experiencias', en: 'Tours & Experiences' },
  gym: { es: 'Gimnasio', en: 'Gym' },
  school: { es: 'Academia', en: 'School' },
  other: { es: 'Otro', en: 'Other' },
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
    .select('id, name, slug, category, description, description_en, logo_url, cover_image_url, brand_color, website_url, address, city')
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
      'id, card_type, title, title_en, description, description_en, amount_cents, min_amount_cents, max_amount_cents, valid_days',
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

const CATEGORY_COVER: Record<string, string> = {
  barber: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=1800&q=85',
  restaurant: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1800&q=85',
  tour: 'https://images.unsplash.com/photo-1559564477-6e8582270002?auto=format&fit=crop&w=1800&q=85',
  gym: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1800&q=85',
  school: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1800&q=85',
  other: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1800&q=85',
};

function resolveBrandColor(value: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : '#b45309';
}

const GIFT_PRESENTATIONS: Record<string, readonly GiftPresentation[]> = {
  tour: [
    {
      occasion: { es: 'Para amantes de la historia', en: 'For history lovers' },
      promise: { es: 'Una llave privada al corazón de Sevilla', en: 'A private key to the heart of Seville' },
      imageUrl: 'https://images.unsplash.com/photo-1569949381669-ecf31ae8e613?auto=format&fit=crop&w=1200&q=88',
      surface: '#173b36', ink: '#fffaf0', accent: '#dfb56b', motif: 'ARCHIVE 01',
    },
    {
      occasion: { es: 'Para celebrar a su manera', en: 'For celebrating their way' },
      promise: { es: 'La libertad de elegir su propia aventura', en: 'The freedom to choose their own adventure' },
      imageUrl: 'https://images.unsplash.com/photo-1559564477-6e8582270002?auto=format&fit=crop&w=1200&q=88',
      surface: '#d8cab0', ink: '#24322d', accent: '#9a4a2c', motif: 'OPEN EDITION',
    },
    {
      occasion: { es: 'Para una ocasión extraordinaria', en: 'For an extraordinary occasion' },
      promise: { es: 'Sevilla en privado, diseñada solo para ellos', en: 'Seville in private, designed only for them' },
      imageUrl: 'https://images.unsplash.com/photo-1543783207-ec64e4d95325?auto=format&fit=crop&w=1200&q=88',
      surface: '#251d1a', ink: '#f4ead8', accent: '#c89b55', motif: 'PRIVATE 03',
    },
  ],
  barber: [
    {
      occasion: { es: 'Para estrenar una nueva etapa', en: 'For a fresh new chapter' },
      promise: { es: 'El corte que devuelve seguridad', en: 'The cut that brings confidence back' },
      imageUrl: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=1200&q=88',
      surface: '#26352f', ink: '#f7f1e7', accent: '#c9a66b', motif: 'SIGNATURE CUT',
    },
    {
      occasion: { es: 'Para quien cuida cada detalle', en: 'For someone who notices every detail' },
      promise: { es: 'Corte, barba y una hora solo para él', en: 'Cut, beard and an hour entirely his' },
      imageUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=88',
      surface: '#171b1a', ink: '#f7f1e7', accent: '#b98a4b', motif: 'FULL RITUAL',
    },
    {
      occasion: { es: 'Para recuperar el ritual clásico', en: 'For rediscovering the classic ritual' },
      promise: { es: 'Navaja, toalla caliente y tiempo sin prisa', en: 'Razor, hot towel and unhurried time' },
      imageUrl: 'https://images.unsplash.com/photo-1605497788044-5a32c7078486?auto=format&fit=crop&w=1200&q=88',
      surface: '#6c2f2a', ink: '#fff7ec', accent: '#e0b56c', motif: 'ROYAL SHAVE',
    },
    {
      occasion: { es: 'Para acertar sin preguntar', en: 'For getting it right without asking' },
      promise: { es: 'Su servicio favorito, elegido por él', en: 'His favourite service, chosen by him' },
      imageUrl: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1200&q=88',
      surface: '#d9d0c0', ink: '#252927', accent: '#8a5d2e', motif: 'HOUSE CREDIT',
    },
    {
      occasion: { es: 'Para regalar libertad absoluta', en: 'For giving complete freedom' },
      promise: { es: 'Elige el importe. Él elige el momento.', en: 'Choose the value. He chooses the moment.' },
      imageUrl: 'https://images.unsplash.com/photo-1512690459411-b9245aed614b?auto=format&fit=crop&w=1200&q=88',
      surface: '#213a43', ink: '#f7f1e7', accent: '#d39a64', motif: 'OPEN VALUE',
    },
  ],
};

function resolveGiftPresentation(category: string, index: number): GiftPresentation {
  const presentations = GIFT_PRESENTATIONS[category] ?? GIFT_PRESENTATIONS.tour;
  return presentations[index % presentations.length];
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

  const displayMerchantDescription =
    locale === 'en' && merchant.description_en
      ? merchant.description_en
      : merchant.description;
  const coverImage = merchant.cover_image_url ?? CATEGORY_COVER[merchant.category] ?? CATEGORY_COVER.other;
  const brandColor = resolveBrandColor(merchant.brand_color);

  return (
    <main className="min-h-screen bg-[#f3f0e9] text-[#1d211d]" style={{ '--merchant-accent': brandColor } as React.CSSProperties}>
      <header className="absolute inset-x-0 top-0 z-20 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 text-white sm:px-8">
        <Link href={`/${locale}`} className="text-xs font-semibold uppercase tracking-[0.24em] text-white/80">
          ParaUsted
        </Link>
        <span className="rounded-full border border-white/25 bg-black/15 px-3 py-1.5 text-xs backdrop-blur-md">
          {merchant.city}
        </span>
      </header>

      <section className="relative flex min-h-[76svh] items-end overflow-hidden bg-[#1d211d] px-5 pb-14 pt-28 text-white sm:px-8 sm:pb-20">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${coverImage})` }}
          role="img"
          aria-label={`${merchant.name}, ${merchant.city}`}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(15,18,15,0.94)_0%,rgba(15,18,15,0.66)_48%,rgba(15,18,15,0.18)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#1d211d]/70 to-transparent" />

        <div className="relative mx-auto w-full max-w-7xl">
          <div className="max-w-3xl">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.28em] text-white/70">
              {copy.eyebrow} · {CATEGORY_LABEL[merchant.category]?.[locale] ?? merchant.category}
            </p>
            <h1 className="font-serif text-5xl leading-[0.98] sm:text-7xl lg:text-8xl">{merchant.name}</h1>
            <p className="mt-5 max-w-2xl font-serif text-2xl leading-tight text-white/90 sm:text-3xl">
              {copy.heroTitle}
            </p>
            <p className="mt-5 max-w-xl text-sm leading-6 text-white/70 sm:text-base">
              {displayMerchantDescription ?? copy.heroDescription}
            </p>
            <a
              href="#gift-collection"
              className="mt-8 inline-flex min-h-12 items-center bg-[var(--merchant-accent)] px-6 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {copy.collectionLabel}
              <span aria-hidden="true" className="ml-4">↓</span>
            </a>
          </div>
        </div>
      </section>

      <section id="gift-collection" className="px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 border-b border-black/10 pb-10 md:grid-cols-[1fr_1fr] md:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--merchant-accent)]">{copy.collectionLabel}</p>
              <h2 className="mt-3 max-w-xl font-serif text-4xl leading-tight sm:text-5xl">{copy.collectionTitle}</h2>
            </div>
            <p className="max-w-lg text-sm leading-6 text-black/60 md:justify-self-end">{copy.collectionDescription}</p>
          </div>

          {giftCards.length === 0 ? (
            <p className="py-16 text-black/55">{copy.emptyState}</p>
          ) : (
            <ul className="grid gap-5 pt-8 md:grid-cols-2 lg:grid-cols-3">
              {giftCards.map((card, index) => {
                const displayTitle =
                  locale === 'en' && card.title_en ? card.title_en : card.title;
                const displayDescription =
                  locale === 'en' && card.description_en
                    ? card.description_en
                    : card.description;
                const presentation = resolveGiftPresentation(merchant.category, index);

                return (
                  <li
                    key={card.id}
                    className="group flex min-h-[590px] flex-col overflow-hidden border border-black/10 shadow-[0_18px_50px_rgba(29,33,29,0.08)] transition duration-500 hover:-translate-y-1 hover:shadow-[0_26px_70px_rgba(29,33,29,0.16)]"
                    style={{ backgroundColor: presentation.surface, color: presentation.ink }}
                  >
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <div
                        className="absolute inset-0 bg-cover bg-center transition duration-700 group-hover:scale-[1.04]"
                        style={{ backgroundImage: `url(${presentation.imageUrl})` }}
                        role="img"
                        aria-label={presentation.occasion[locale]}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-black/15" />
                      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
                        <span>{presentation.motif}</span>
                        <span>0{index + 1}</span>
                      </div>
                      <p className="absolute inset-x-5 bottom-5 max-w-[85%] font-serif text-2xl leading-tight text-white">
                        {presentation.promise[locale]}
                      </p>
                    </div>

                    <div className="flex flex-1 flex-col p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-60">
                            {presentation.occasion[locale]}
                          </p>
                          <h3 className="mt-3 font-serif text-3xl leading-tight">{displayTitle}</h3>
                        </div>
                        <span
                          className="mt-1 h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: presentation.accent }}
                          aria-hidden="true"
                        />
                      </div>
                      {displayDescription !== null && (
                        <p className="mt-4 line-clamp-3 text-sm leading-6 opacity-65">{displayDescription}</p>
                      )}
                      <div className="mt-auto flex items-end justify-between gap-4 border-t border-current/15 pt-6">
                        <div>
                          <p className="font-serif text-3xl" style={{ color: presentation.accent }}>{formatAmount(card)}</p>
                          <p className="mt-1 text-xs opacity-50">{copy.validity(card.valid_days)}</p>
                        </div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-45">
                          {CARD_TYPE_LABEL[card.card_type][locale]}
                        </p>
                      </div>
                      <Link
                        href={`/${locale}/m/${merchant.slug}/gift-cards/${card.id}`}
                        className="mt-6 flex min-h-12 w-full items-center justify-between border border-current/25 px-4 text-sm font-semibold transition hover:bg-white hover:text-[#1d211d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                      >
                        {copy.ctaLabel}
                        <span aria-hidden="true">→</span>
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="bg-[#1d211d] px-5 py-16 text-white sm:px-8 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--merchant-accent)]">{copy.deliveryLabel}</p>
            <h2 className="mt-4 max-w-xl font-serif text-4xl leading-tight sm:text-5xl">{copy.deliveryTitle}</h2>
            <p className="mt-5 max-w-lg text-sm leading-6 text-white/60">{copy.deliveryDescription}</p>
            <ul className="mt-8 grid gap-3 text-sm text-white/75 sm:grid-cols-3">
              {copy.trustItems.map((item) => (
                <li key={item} className="border-l-2 border-[var(--merchant-accent)] pl-3">{item}</li>
              ))}
            </ul>
          </div>
          <div className="relative mx-auto w-full max-w-md border border-white/10 bg-white/[0.04] p-4 shadow-2xl sm:p-6">
            <div className="border border-white/10 bg-[#efe9dc] p-5 text-[#1d211d] shadow-xl sm:p-7">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-black/45">{merchant.name}</p>
              <p className="mt-8 font-serif text-3xl leading-tight">{copy.heroTitle}</p>
              <div className="mt-12 flex items-end justify-between border-t border-black/10 pt-5">
                <span className="text-xs text-black/50">{merchant.city}</span>
                <span className="font-serif text-2xl text-[var(--merchant-accent)]">Para ti</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="flex flex-col gap-3 bg-[#151815] px-5 py-8 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>{merchant.name} · {merchant.address ?? merchant.city}</span>
        {merchant.website_url !== null && (
          <a href={merchant.website_url} target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white">
            {merchant.website_url.replace(/^https?:\/\//, '')}
          </a>
        )}
      </footer>
    </main>
  );
}
