import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, getLocalizedPath, isSupportedLocale } from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n/config';
import { getMessages } from '@/lib/i18n/messages';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getAlternateLanguageUrls, getCanonicalUrl } from '@/lib/seo/metadata';
import { OnboardingForm } from './onboarding-form';
import type { OnboardingFormCopy } from './onboarding-form';

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
    .select('id, name, slug, category, city, status')
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
  const categoryLabel = summaryCopy.categories[merchant.category] ?? merchant.category;
  const statusLabel = summaryCopy.status[merchant.status] ?? merchant.status;

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-4xl items-center">
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
              <dd className="mt-2 break-all text-base font-medium text-slate-900">/{merchant.slug}</dd>
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
        </section>
      </div>
    </main>
  );
}