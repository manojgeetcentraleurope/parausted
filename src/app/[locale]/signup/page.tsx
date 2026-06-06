import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  getLocalizedPath,
  getSafeInternalNextPath,
  isSupportedLocale,
} from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n/config';
import { getMessages } from '@/lib/i18n/messages';
import { getAlternateLanguageUrls, getCanonicalUrl, getDefaultSeoDescription } from '@/lib/seo/metadata';

import { SignupForm } from './signup-form';

type LocalePageParams = {
  locale: string;
};

type LocalePageProps = {
  params: Promise<LocalePageParams>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readFirstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getResolvedLocale(locale: string): Locale {
  return isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
}

export function generateStaticParams(): Array<{ locale: string }> {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LocalePageProps): Promise<Metadata> {
  const { locale: requestedLocale } = await params;
  const locale = getResolvedLocale(requestedLocale);
  const messages = getMessages(locale);

  return {
    title: `${messages.auth.signupTitle} | ${messages.common.appName}`,
    description: getDefaultSeoDescription(locale),
    alternates: {
      canonical: getCanonicalUrl('/signup', locale),
      languages: getAlternateLanguageUrls('/signup'),
    },
  };
}

export default async function SignupPage({ params, searchParams }: LocalePageProps) {
  const { locale: requestedLocale } = await params;

  if (!isSupportedLocale(requestedLocale)) {
    redirect(`/${DEFAULT_LOCALE}/signup`);
  }

  const locale = requestedLocale;
  const messages = getMessages(locale);
  const resolvedSearchParams = await searchParams;
  const nextValue = readFirstValue(resolvedSearchParams.next) ?? '';
  const nextPath = getSafeInternalNextPath(
    nextValue,
    getLocalizedPath('/dashboard', locale),
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.16),_transparent_28%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(2,6,23,1))]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-10 sm:px-8 lg:px-10">
        <section className="grid w-full gap-10 lg:grid-cols-[1fr_0.92fr] lg:items-center">
          <div className="space-y-5">
            <p className="text-sm font-semibold uppercase tracking-[0.45em] text-cyan-300">
              {messages.common.appName}
            </p>
            <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              {messages.auth.signupTitle}
            </h1>
            <p className="max-w-lg text-base leading-7 text-slate-300">{messages.seo.defaultDescription}</p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/95 p-6 text-slate-900 shadow-2xl shadow-black/25 backdrop-blur sm:p-8">
            <SignupForm loginPath={getLocalizedPath('/login', locale)} messages={messages} nextPath={nextPath} />
          </div>
        </section>
      </div>
    </main>
  );
}