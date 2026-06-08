import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { DEFAULT_LOCALE, isSupportedLocale } from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n/config';
import { getMessages } from '@/lib/i18n/messages';
import {
  getAlternateLanguageUrls,
  getCanonicalUrl,
  getDefaultSeoDescription,
  getDefaultSeoTitle,
} from '@/lib/seo/metadata';

type LocaleHomePageProps = {
  params: Promise<{ locale: string }>;
};

function getResolvedLocale(locale: string): Locale {
  return isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
}

export async function generateMetadata({
  params,
}: LocaleHomePageProps): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = getResolvedLocale(rawLocale);

  return {
    title: getDefaultSeoTitle(locale),
    description: getDefaultSeoDescription(locale),
    alternates: {
      canonical: getCanonicalUrl('/', locale),
      languages: getAlternateLanguageUrls('/'),
    },
  };
}

export default async function LocaleHomePage({ params }: LocaleHomePageProps) {
  const { locale: rawLocale } = await params;

  if (!isSupportedLocale(rawLocale)) {
    redirect(`/${DEFAULT_LOCALE}`);
  }

  const locale = rawLocale;
  const messages = getMessages(locale);

  const copy = {
    es: {
      eyebrow: 'Tarjetas regalo digitales',
      title: 'Regalos locales, personales y fáciles de vender.',
      description:
        'ParaUsted ayuda a negocios locales en España a crear, vender y entregar tarjetas regalo digitales personalizadas.',
      primaryCta: 'Entrar al panel',
      secondaryCta: 'Crear cuenta',
    },
    en: {
      eyebrow: 'Digital gift cards',
      title: 'Local, personal gifts that are easy to sell.',
      description:
        'ParaUsted helps local businesses in Spain create, sell, and deliver personalized digital gift cards.',
      primaryCta: 'Go to dashboard',
      secondaryCta: 'Create account',
    },
  } as const;

  const homeCopy = copy[locale];

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center">
        <div className="max-w-3xl rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-700">
            {homeCopy.eyebrow}
          </p>

          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">
            {homeCopy.title}
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            {homeCopy.description}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-300"
              href={`/${locale}/dashboard`}
            >
              {homeCopy.primaryCta}
            </Link>

            <Link
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 focus:outline-none focus:ring-4 focus:ring-slate-200"
              href={`/${locale}/signup`}
            >
              {homeCopy.secondaryCta}
            </Link>
          </div>

          <p className="mt-8 text-sm text-slate-500">{messages.common.appName}</p>
        </div>
      </section>
    </main>
  );
}