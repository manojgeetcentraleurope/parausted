import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { isSupportedLocale } from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n/config';
import { getCanonicalUrl, getAlternateLanguageUrls } from '@/lib/seo/metadata';
import { centsToEuros } from '@/lib/gift-cards/money';
import type { GiftCardType } from '@/lib/gift-cards/schema';
import type { DirectPaymentMethod } from '@/lib/purchases/schema';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getStripeClient } from '@/lib/stripe/server';
import { PurchaseForm } from './purchase-form';
import type { GiftCardDisplayData, MerchantDisplayData, CheckoutReturnStatus } from './purchase-form';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PageProps = {
  params: Promise<{ locale: string; slug: string; giftCardId: string }>;
  searchParams?: Promise<{ checkout?: string; session_id?: string }>;
};

type MerchantRow = {
  id: string;
  name: string;
  slug: string;
  bizum_phone: string | null;
  bank_iban: string | null;
  stripe_onboarded: boolean;
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

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchActiveMerchantBySlug(slug: string): Promise<MerchantRow | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('merchants')
    .select('id, name, slug, bizum_phone, bank_iban, stripe_onboarded')
    .eq('slug', slug)
    .eq('status', 'active')
    .single();

  if (error !== null || data === null) {
    return null;
  }

  return data as MerchantRow;
}

async function fetchActiveGiftCard(
  giftCardId: string,
  merchantId: string,
): Promise<GiftCardRow | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('gift_cards')
    .select(
      'id, card_type, title, title_en, description, description_en, amount_cents, min_amount_cents, max_amount_cents, valid_days',
    )
    .eq('id', giftCardId)
    .eq('merchant_id', merchantId)
    .eq('active', true)
    .single();

  if (error !== null || data === null) {
    return null;
  }

  return data as GiftCardRow;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveAvailablePaymentMethods(
  merchant: MerchantRow,
): readonly DirectPaymentMethod[] {
  const methods: DirectPaymentMethod[] = [];

  if (merchant.bizum_phone !== null && merchant.bizum_phone.length > 0) {
    methods.push('bizum_direct');
  }

  if (merchant.bank_iban !== null && merchant.bank_iban.length > 0) {
    methods.push('bank_transfer');
  }

  methods.push('cash');

  return methods;
}

function buildBilingualText(
  locale: Locale,
  defaultText: string,
  englishText: string | null,
): string {
  return locale === 'en' && englishText ? englishText : defaultText;
}

function buildDisplayAmount(card: GiftCardRow): string {
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

function buildGiftCardDisplayData(card: GiftCardRow, locale: Locale): GiftCardDisplayData {
  return {
    id: card.id,
    cardType: card.card_type,
    title: buildBilingualText(locale, card.title, card.title_en),
    description: buildBilingualText(
      locale,
      card.description ?? '',
      card.description_en,
    ) || null,
    displayAmount: buildDisplayAmount(card),
    amountCents: card.amount_cents,
    minAmountCents: card.min_amount_cents,
    maxAmountCents: card.max_amount_cents,
    validDays: card.valid_days,
  };
}

// ---------------------------------------------------------------------------
// Checkout return status resolver (read-only, no DB mutations)
// ---------------------------------------------------------------------------

async function resolveCheckoutReturnStatus(input: {
  checkout: string | undefined;
  sessionId: string | undefined;
  giftCardId: string;
}): Promise<CheckoutReturnStatus> {
  const { checkout, sessionId, giftCardId } = input;

  if (checkout === 'cancelled') {
    return { kind: 'cancelled' };
  }

  if (checkout !== 'success') {
    return { kind: 'none' };
  }

  if (!sessionId) {
    return { kind: 'success_preparing' };
  }

  // Stripe Checkout Session IDs always start with 'cs_'
  if (!sessionId.startsWith('cs_')) {
    return { kind: 'success_preparing' };
  }

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Validate this session belongs to this gift card when metadata is present
    if (
      session.metadata?.gift_card_id &&
      session.metadata.gift_card_id !== giftCardId
    ) {
      return { kind: 'success_preparing' };
    }

    // Resolve purchase_id from metadata first, fall back to client_reference_id
    const purchaseId =
      session.metadata?.purchase_id ?? session.client_reference_id ?? null;

    if (!purchaseId) {
      return { kind: 'success_preparing' };
    }

    // Read-only voucher lookup — no mutations
    const supabase = await createSupabaseServerClient();
    const { data: voucherData } = await supabase
      .from('vouchers')
      .select('code')
      .eq('purchase_id', purchaseId)
      .maybeSingle();

    if (voucherData?.code) {
      return { kind: 'success_ready', voucherCode: voucherData.code };
    }

    return { kind: 'success_preparing' };
  } catch (err) {
    console.error('[resolveCheckoutReturnStatus] Error resolving checkout return status', {
      error: err instanceof Error ? err.message : 'unknown',
    });
    return { kind: 'success_preparing' };
  }
}

// ---------------------------------------------------------------------------
// generateMetadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug, giftCardId } = await params;

  if (!isSupportedLocale(locale)) {
    return {};
  }

  const merchant = await fetchActiveMerchantBySlug(slug);
  if (merchant === null) {
    return {};
  }

  const card = await fetchActiveGiftCard(giftCardId, merchant.id);
  if (card === null) {
    return {};
  }

  const cardTitle = buildBilingualText(locale, card.title, card.title_en);
  const title =
    locale === 'en'
      ? `${cardTitle} — ${merchant.name} | ParaUsted`
      : `${cardTitle} — ${merchant.name} | ParaUsted`;

  const description =
    locale === 'en'
      ? `Buy a personalized gift card from ${merchant.name}.`
      : `Compra una tarjeta regalo personalizada de ${merchant.name}.`;

  const path = `/m/${slug}/gift-cards/${giftCardId}`;
  const canonicalUrl = getCanonicalUrl(path, locale);
  const alternates = getAlternateLanguageUrls(path);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: alternates,
    },
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PurchasePage({ params, searchParams }: PageProps) {
  const { locale, slug, giftCardId } = await params;
  const rawSearchParams = searchParams ? await searchParams : undefined;
  const rawCheckout = rawSearchParams?.checkout;
  const rawSessionId = rawSearchParams?.session_id;

  if (!isSupportedLocale(locale)) {
    notFound();
  }

  const merchant = await fetchActiveMerchantBySlug(slug);
  if (merchant === null) {
    notFound();
  }

  const card = await fetchActiveGiftCard(giftCardId, merchant.id);
  if (card === null) {
    notFound();
  }

  const availablePaymentMethods = resolveAvailablePaymentMethods(merchant);
  const giftCardDisplay = buildGiftCardDisplayData(card, locale);

  const checkoutReturnStatus = await resolveCheckoutReturnStatus({
    checkout: rawCheckout,
    sessionId: rawSessionId,
    giftCardId,
  });

  const merchantDisplay: MerchantDisplayData = {
    name: merchant.name,
    slug: merchant.slug,
  };

  return (
    <main className="min-h-screen bg-white px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-xl">
        <PurchaseForm
          locale={locale}
          merchant={merchantDisplay}
          giftCard={giftCardDisplay}
          availablePaymentMethods={availablePaymentMethods}
          stripeCardAvailable={merchant.stripe_onboarded}
          checkoutReturnStatus={checkoutReturnStatus}
        />
      </div>
    </main>
  );
}
