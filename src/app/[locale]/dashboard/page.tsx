import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, getLocalizedPath, isSupportedLocale } from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n/config';
import { getMessages } from '@/lib/i18n/messages';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getAlternateLanguageUrls, getCanonicalUrl } from '@/lib/seo/metadata';

type DashboardPageProps = {
  params: Promise<{ locale: string }>;
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

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-4xl items-center">
        <section className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-700">
            {messages.common.appName}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {messages.dashboard.title}
          </h1>

          <div className="mt-8 grid gap-5 sm:grid-cols-[1fr_0.95fr]">
            <div className="rounded-2xl bg-slate-50 p-5">
              <p className="text-sm font-medium text-slate-500">{messages.auth.emailLabel}</p>
              <p className="mt-2 break-all text-lg font-medium text-slate-900">{user.email ?? ''}</p>
            </div>

            <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-5">
              <p className="text-sm font-medium text-cyan-900">{messages.dashboard.nextStep}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}