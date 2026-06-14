import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, getLocalizedPath, isSupportedLocale } from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n/config';
import { getMessages } from '@/lib/i18n/messages';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getAlternateLanguageUrls, getCanonicalUrl } from '@/lib/seo/metadata';
import type { GiftCardType } from '@/lib/gift-cards/schema';
import { OnboardingForm } from './onboarding-form';
import type { OnboardingFormCopy } from './onboarding-form';
import { GiftCardManager, type GiftCardSectionCopy } from './gift-cards/gift-card-manager';
import { LogoutButton } from './logout-button';
import { PurchaseManager } from './purchases/purchase-manager';
import { RedemptionManager } from './redemptions/redemption-manager';
import { listMerchantVouchers } from './vouchers/actions';
import { VoucherHistoryManager } from './vouchers/voucher-history-manager';
import { StripeSetupCard } from './stripe/stripe-setup-card';

type DashboardPageProps = {
  params: Promise<{ locale: string }>;
};

type MerchantRow = {
  id: string;
  name: string;
  slug: string;
  category: string;
  city: string;
  status: string;
  stripe_account_id: string | null;
  stripe_onboarded: boolean;
};

type GiftCardRow = {
  id: string;
  card_type: GiftCardType;
  title: string;
  title_en: string | null;
  description: string | null;
  description_en: string | null;
  voucher_code_prefix: string | null;
  amount_cents: number | null;
  min_amount_cents: number | null;
  max_amount_cents: number | null;
  valid_days: number;
  active: boolean;
};

// ---------------------------------------------------------------------------
// Local copy — onboarding labels (no i18n keys exist yet for this flow)
// ---------------------------------------------------------------------------

const ONBOARDING_COPY: Record<Locale, OnboardingFormCopy> = {
  es: {
    title: 'Configura tu negocio',
    description: 'Completa el perfil de tu negocio para empezar a vender tarjetas regalo.',
    fields: {
      name: 'Nombre del negocio',
      slug: 'URL pública (ej: mi-barberia)',
      category: 'Categoría',
      description: 'Descripción',
      descriptionEn: 'Descripción en inglés (opcional)',
      phone: 'Teléfono',
      websiteUrl: 'Sitio web',
      address: 'Dirección',
      city: 'Ciudad',
      bizumPhone: 'Teléfono Bizum (opcional)',
      bankIban: 'IBAN (opcional)',
      brandColor: 'Color de marca',
    },
    categoryLabels: {
      barber: 'Barbería / Peluquería',
      restaurant: 'Restaurante',
      tour: 'Tour / Experiencia',
      gym: 'Gimnasio',
      school: 'Academia / Escuela',
      other: 'Otro',
    },
    submit: 'Crear perfil',
    submitting: 'Creando perfil…',
    success: 'Perfil creado correctamente.',
  },
  en: {
    title: 'Set up your business',
    description: 'Complete your business profile to start selling gift cards.',
    fields: {
      name: 'Business name',
      slug: 'Public URL (e.g. my-barbershop)',
      category: 'Category',
      description: 'Description',
      descriptionEn: 'English description (optional)',
      phone: 'Phone',
      websiteUrl: 'Website',
      address: 'Address',
      city: 'City',
      bizumPhone: 'Bizum phone (optional)',
      bankIban: 'IBAN (optional)',
      brandColor: 'Brand color',
    },
    categoryLabels: {
      barber: 'Barber / Hairdresser',
      restaurant: 'Restaurant',
      tour: 'Tour / Experience',
      gym: 'Gym',
      school: 'Academy / School',
      other: 'Other',
    },
    submit: 'Create profile',
    submitting: 'Creating profile…',
    success: 'Profile created successfully.',
  },
};

// ---------------------------------------------------------------------------
// Local copy — dashboard summary labels
// ---------------------------------------------------------------------------

const SUMMARY_COPY = {
  es: {
    slugLabel: 'URL pública',
    categoryLabel: 'Categoría',
    cityLabel: 'Ciudad',
    statusLabel: 'Estado',
    nextStep: 'Tu perfil está activo. Pronto podrás crear y vender tarjetas regalo.',
    status: { active: 'Activo', suspended: 'Suspendido', closed: 'Cerrado' } as Record<string, string>,
    categories: {
      barber: 'Barbería',
      restaurant: 'Restaurante',
      tour: 'Tour',
      gym: 'Gimnasio',
      school: 'Academia',
      other: 'Otro',
    } as Record<string, string>,
  },
  en: {
    slugLabel: 'Public URL',
    categoryLabel: 'Category',
    cityLabel: 'City',
    statusLabel: 'Status',
    nextStep: 'Your profile is active. Gift cards are coming soon.',
    status: { active: 'Active', suspended: 'Suspended', closed: 'Closed' } as Record<string, string>,
    categories: {
      barber: 'Barber',
      restaurant: 'Restaurant',
      tour: 'Tour',
      gym: 'Gym',
      school: 'School',
      other: 'Other',
    } as Record<string, string>,
  },
} as const;

const ACTIONS_COPY: Record<
  Locale,
  {
    viewPublicPage: string;
    home: string;
    createFirstGiftCard: string;
    comingSoon: string;
    logout: string;
    signingOut: string;
  }
> = {
  es: {
    viewPublicPage: 'Ver página pública',
    home: 'Inicio',
    createFirstGiftCard: 'Crear primera tarjeta regalo',
    comingSoon: 'Próximamente',
    logout: 'Cerrar sesión',
    signingOut: 'Cerrando sesión…',
  },
  en: {
    viewPublicPage: 'View public page',
    home: 'Home',
    createFirstGiftCard: 'Create first gift card',
    comingSoon: 'Coming soon',
    logout: 'Log out',
    signingOut: 'Signing out…',
  },
};

// ---------------------------------------------------------------------------
// Local copy — gift card section labels
// ---------------------------------------------------------------------------

const GIFT_CARD_COPY: Record<Locale, GiftCardSectionCopy> = {
  es: {
    sectionTitle: 'Tarjetas regalo',
    emptyState: 'Aún no has creado tarjetas regalo.',
    validityLabel: 'días de validez',
    activeLabel: 'Activa',
    inactiveLabel: 'Inactiva',
    editLabel: 'Editar',
    activateLabel: 'Activar',
    deactivateLabel: 'Desactivar',
    toggleFailed: 'No se pudo cambiar el estado de la tarjeta regalo. Inténtalo de nuevo.',
    toggleSuccessActive: 'Tarjeta regalo activada correctamente.',
    toggleSuccessInactive: 'Tarjeta regalo desactivada correctamente.',
    form: {
      title: 'Crear tarjeta regalo',
      editTitle: 'Editar tarjeta regalo',
      description: 'Define una tarjeta regalo para vender en tu página pública.',
      fields: {
        cardType: 'Tipo',
        title: 'Título',
        description: 'Descripción',
        titleEn: 'Título en inglés (opcional)',
        descriptionEn: 'Descripción en inglés (opcional)',
        voucherCodePrefix: 'Prefijo del código',
        voucherCodePrefixHelp: 'Opcional. Ejemplo: ST-GC-LUX. Vacío usa el prefijo PU por defecto.',
        amount: 'Importe',
        minAmount: 'Importe mínimo',
        maxAmount: 'Importe máximo',
        validDays: 'Validez en días',
        active: 'Activa',
      },
      typeLabels: {
        fixed_value: 'Valor fijo',
        custom_value: 'Valor personalizado',
        service: 'Servicio',
      },
      submit: 'Crear tarjeta',
      submitting: 'Creando…',
      success: 'Tarjeta regalo creada correctamente.',
      editSubmit: 'Guardar cambios',
      editSubmitting: 'Guardando…',
      editSuccess: 'Tarjeta regalo actualizada correctamente.',
      cancelEdit: 'Cancelar',
    },
  },
  en: {
    sectionTitle: 'Gift cards',
    emptyState: 'You have not created any gift cards yet.',
    validityLabel: 'days validity',
    activeLabel: 'Active',
    inactiveLabel: 'Inactive',
    editLabel: 'Edit',
    activateLabel: 'Activate',
    deactivateLabel: 'Deactivate',
    toggleFailed: 'Could not change the gift card status. Please try again.',
    toggleSuccessActive: 'Gift card activated successfully.',
    toggleSuccessInactive: 'Gift card deactivated successfully.',
    form: {
      title: 'Create gift card',
      editTitle: 'Edit gift card',
      description: 'Define a gift card to sell on your public page.',
      fields: {
        cardType: 'Type',
        title: 'Title',
        description: 'Description',
        titleEn: 'English title (optional)',
        descriptionEn: 'English description (optional)',
        voucherCodePrefix: 'Code prefix',
        voucherCodePrefixHelp: 'Optional. Example: ST-GC-LUX. Empty uses the default PU prefix.',
        amount: 'Amount',
        minAmount: 'Min amount',
        maxAmount: 'Max amount',
        validDays: 'Validity days',
        active: 'Active',
      },
      typeLabels: {
        fixed_value: 'Fixed value',
        custom_value: 'Custom value',
        service: 'Service',
      },
      submit: 'Create card',
      submitting: 'Creating…',
      success: 'Gift card created successfully.',
      editSubmit: 'Save changes',
      editSubmitting: 'Saving…',
      editSuccess: 'Gift card updated successfully.',
      cancelEdit: 'Cancel',
    },
  },
};

function getResolvedLocale(locale: string): Locale {
  return isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
}

export function generateStaticParams(): Array<{ locale: string }> {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: DashboardPageProps): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = getResolvedLocale(requestedLocale);
  const messages = getMessages(locale);

  return {
    title: `${messages.dashboard.title} | ${messages.common.appName}`,
    description: messages.dashboard.nextStep,
    alternates: {
      canonical: getCanonicalUrl('/dashboard', locale),
      languages: getAlternateLanguageUrls('/dashboard'),
    },
  };
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { locale: requestedLocale } = await params;

  if (!isSupportedLocale(requestedLocale)) {
    redirect(`/${DEFAULT_LOCALE}/dashboard`);
  }

  const locale = requestedLocale;
  const messages = getMessages(locale);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginPath = getLocalizedPath('/login', locale);
    const dashboardPath = getLocalizedPath('/dashboard', locale);
    redirect(`${loginPath}?next=${encodeURIComponent(dashboardPath)}`);
  }

  const { data: merchantRaw } = await supabase
    .from('merchants')
    .select('id, name, slug, category, city, status, stripe_account_id, stripe_onboarded')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  const merchant = merchantRaw as MerchantRow | null;

  if (!merchant) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
        <div className="mx-auto w-full max-w-2xl py-10">
          <p className="mb-6 text-sm font-semibold uppercase tracking-[0.35em] text-cyan-700">
            {messages.common.appName}
          </p>
          <OnboardingForm locale={locale} copy={ONBOARDING_COPY[locale]} />
        </div>
      </main>
    );
  }

  const summaryCopy = SUMMARY_COPY[locale];
  const actionsCopy = ACTIONS_COPY[locale];
  const giftCardCopy = GIFT_CARD_COPY[locale];

  const { data: giftCardsRaw } = await supabase
    .from('gift_cards')
    .select('id, card_type, title, title_en, description, description_en, voucher_code_prefix, amount_cents, min_amount_cents, max_amount_cents, valid_days, active')
    .eq('merchant_id', merchant.id)
    .order('created_at', { ascending: false });

  const giftCards = (giftCardsRaw ?? []) as GiftCardRow[];

  const voucherResult = await listMerchantVouchers();
  const merchantVouchers = voucherResult.ok ? voucherResult.vouchers : [];
  const voucherLoadError = voucherResult.ok ? null : voucherResult.error;

  const publicPagePath = getLocalizedPath(`/m/${merchant.slug}`, locale);
  const homePath = getLocalizedPath('/', locale);
  const categoryLabel = summaryCopy.categories[merchant.category] ?? merchant.category;
  const statusLabel = summaryCopy.status[merchant.status] ?? merchant.status;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <section className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-700">
            {messages.common.appName}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {merchant.name}
          </h1>

          <dl className="mt-8 grid gap-5 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-5">
              <dt className="text-sm font-medium text-slate-500">{summaryCopy.slugLabel}</dt>
              <dd className="mt-2 break-all text-base font-medium text-cyan-800">
                <Link
                  className="inline-flex items-center rounded-lg outline-none transition hover:text-cyan-900 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
                  href={publicPagePath}
                >
                  {publicPagePath}
                </Link>
              </dd>
            </div>

            <div className="rounded-2xl bg-slate-50 p-5">
              <dt className="text-sm font-medium text-slate-500">{summaryCopy.categoryLabel}</dt>
              <dd className="mt-2 text-base font-medium text-slate-900">{categoryLabel}</dd>
            </div>

            <div className="rounded-2xl bg-slate-50 p-5">
              <dt className="text-sm font-medium text-slate-500">{summaryCopy.cityLabel}</dt>
              <dd className="mt-2 text-base font-medium text-slate-900">{merchant.city}</dd>
            </div>

            <div className="rounded-2xl bg-slate-50 p-5">
              <dt className="text-sm font-medium text-slate-500">{summaryCopy.statusLabel}</dt>
              <dd className="mt-2 text-base font-medium text-slate-900">{statusLabel}</dd>
            </div>
          </dl>

          <div className="mt-6 rounded-2xl border border-cyan-100 bg-cyan-50 p-5">
            <p className="text-sm font-medium text-cyan-900">{summaryCopy.nextStep}</p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Link
              className="flex min-h-28 flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:border-cyan-200 hover:bg-cyan-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
              href={publicPagePath}
            >
              <span className="text-sm font-medium text-slate-500">{actionsCopy.viewPublicPage}</span>
              <span className="mt-4 break-all text-sm font-semibold text-slate-900">{publicPagePath}</span>
            </Link>

            <Link
              className="flex min-h-28 flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-5 transition hover:border-cyan-200 hover:bg-cyan-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
              href={homePath}
            >
              <span className="text-sm font-medium text-slate-500">{actionsCopy.home}</span>
              <span className="mt-4 text-sm font-semibold text-slate-900">{homePath}</span>
            </Link>

            <div className="flex min-h-28 flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div>
                <span className="text-sm font-medium text-slate-500">{actionsCopy.createFirstGiftCard}</span>
                <span className="mt-2 block text-sm text-slate-500">{actionsCopy.comingSoon}</span>
              </div>
              <button
                className="mt-4 inline-flex cursor-not-allowed items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-400"
                disabled
                type="button"
              >
                {actionsCopy.comingSoon}
              </button>
            </div>

            <div className="flex min-h-28 flex-col justify-between rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <span className="text-sm font-medium text-slate-500">{actionsCopy.logout}</span>
              <LogoutButton
                label={actionsCopy.logout}
                locale={locale}
                signingOutLabel={actionsCopy.signingOut}
              />
            </div>
          </div>
        </section>

        <StripeSetupCard
          locale={locale}
          messages={messages.stripeSetup}
          stripeAccountId={merchant.stripe_account_id}
          stripeOnboarded={merchant.stripe_onboarded}
        />

        <GiftCardManager locale={locale} copy={giftCardCopy} giftCards={giftCards} />

        <PurchaseManager messages={messages} locale={locale} />
        <RedemptionManager messages={messages} locale={locale} />
        <VoucherHistoryManager vouchers={merchantVouchers} messages={messages} locale={locale} loadError={voucherLoadError} />
      </div>
    </main>
  );
}