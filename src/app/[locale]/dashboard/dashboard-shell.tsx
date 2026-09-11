'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  BadgeEuro,
  CheckCircle2,
  CreditCard,
  Gift,
  History,
  LayoutDashboard,
  MapPin,
  Menu,
  Settings,
  Store,
  TicketCheck,
  X,
} from 'lucide-react';

import type { Locale } from '@/lib/i18n/config';

import { LogoutButton } from './logout-button';

type WorkspaceId = 'overview' | 'redeem' | 'payments' | 'vouchers' | 'gift-cards' | 'settings';

export type DashboardShellCopy = {
  workspaceLabel: string;
  navigationLabel: string;
  openMenu: string;
  closeMenu: string;
  viewStore: string;
  switchLanguage: string;
  logout: string;
  signingOut: string;
  welcome: string;
  overviewTitle: string;
  overviewDescription: string;
  quickAction: string;
  redeemNow: string;
  redeemHint: string;
  giftCardsMetric: string;
  activeGiftCardsMetric: string;
  vouchersMetric: string;
  onlinePaymentsMetric: string;
  connected: string;
  actionRequired: string;
  businessDetails: string;
  publicAddress: string;
  category: string;
  city: string;
  accountStatus: string;
  navigation: Record<WorkspaceId, { label: string; description: string }>;
};

type DashboardShellProps = {
  locale: Locale;
  copy: DashboardShellCopy;
  merchantName: string;
  publicPagePath: string;
  alternateDashboardPath: string;
  categoryLabel: string;
  city: string;
  statusLabel: string;
  giftCardCount: number;
  activeGiftCardCount: number;
  voucherCount: number;
  stripeConnected: boolean;
  overviewNotice: string;
  panels: Record<Exclude<WorkspaceId, 'overview'>, React.ReactNode>;
};

const NAV_ITEMS: Array<{
  id: WorkspaceId;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'overview', icon: LayoutDashboard },
  { id: 'redeem', icon: TicketCheck },
  { id: 'payments', icon: BadgeEuro },
  { id: 'vouchers', icon: History },
  { id: 'gift-cards', icon: Gift },
  { id: 'settings', icon: Settings },
];

function StatusDot({ positive }: { positive: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`size-2 rounded-full ${positive ? 'bg-emerald-500' : 'bg-amber-500'}`}
    />
  );
}

export function DashboardShell({
  locale,
  copy,
  merchantName,
  publicPagePath,
  alternateDashboardPath,
  categoryLabel,
  city,
  statusLabel,
  giftCardCount,
  activeGiftCardCount,
  voucherCount,
  stripeConnected,
  overviewNotice,
  panels,
}: DashboardShellProps) {
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const accountIsActive = statusLabel.toLowerCase() === 'activo' || statusLabel.toLowerCase() === 'active';

  function selectWorkspace(workspace: WorkspaceId): void {
    setActiveWorkspace(workspace);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const activeCopy = copy.navigation[activeWorkspace];

  const navigation = (
    <nav aria-label={copy.navigationLabel} className="flex h-full flex-col">
      <div className="space-y-1">
        {NAV_ITEMS.map(({ id, icon: Icon }) => {
          const selected = activeWorkspace === id;
          return (
            <button
              key={id}
              aria-current={selected ? 'page' : undefined}
              className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                selected
                  ? 'bg-teal-50 text-teal-900'
                  : 'text-stone-600 hover:bg-stone-100 hover:text-stone-950'
              }`}
              onClick={() => selectWorkspace(id)}
              type="button"
            >
              <Icon aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.8} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{copy.navigation[id].label}</span>
                <span className="hidden truncate text-xs text-stone-500 xl:block">
                  {copy.navigation[id].description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-auto border-t border-stone-200 pt-4">
        <Link
          className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          href={publicPagePath}
          target="_blank"
        >
          {copy.viewStore}
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </Link>
        <div className="mt-2 px-3 sm:hidden">
          <LogoutButton label={copy.logout} locale={locale} signingOutLabel={copy.signingOut} />
        </div>
      </div>
    </nav>
  );

  return (
    <main className="min-h-screen bg-[#f7f8f5] text-stone-950">
      <header className="sticky top-0 z-30 border-b border-stone-200/90 bg-[#f7f8f5]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1480px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button
            aria-expanded={menuOpen}
            aria-label={menuOpen ? copy.closeMenu : copy.openMenu}
            className="grid size-10 place-items-center rounded-lg border border-stone-200 bg-white text-stone-700 lg:hidden"
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            {menuOpen ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
          </button>

          <Link className="flex items-center gap-2.5" href={`/${locale}`}>
            <span className="grid size-9 place-items-center rounded-lg bg-teal-800 text-white">
              <Gift aria-hidden="true" className="size-5" strokeWidth={1.8} />
            </span>
            <span className="hidden text-lg font-bold tracking-tight sm:block">ParaUsted</span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <Link
              aria-label={copy.switchLanguage}
              className="inline-flex h-9 items-center rounded-lg border border-stone-200 bg-white px-3 text-xs font-bold uppercase text-stone-700 transition hover:border-stone-300 hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              href={alternateDashboardPath}
              hrefLang={locale === 'es' ? 'en' : 'es'}
            >
              {locale === 'es' ? 'EN' : 'ES'}
            </Link>
            <div className="hidden sm:block">
              <LogoutButton label={copy.logout} locale={locale} signingOutLabel={copy.signingOut} />
            </div>
          </div>
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-x-0 top-16 z-20 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-stone-200 bg-white p-4 shadow-xl lg:hidden">
          <div className="mx-auto max-w-xl">{navigation}</div>
        </div>
      ) : null}

      <div className="mx-auto grid w-full max-w-[1480px] lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] border-r border-stone-200 px-5 py-7 lg:block">
          <p className="mb-5 px-3 text-xs font-bold uppercase text-stone-400">{copy.workspaceLabel}</p>
          {navigation}
        </aside>

        <div className="min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 xl:px-14">
          <div className="mx-auto max-w-6xl">
            <div className="mb-7 flex flex-col gap-2 border-b border-stone-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-medium text-teal-800">{merchantName}</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{activeCopy.label}</h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-500">{activeCopy.description}</p>
              </div>
              <div className={`mt-2 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold sm:mt-0 ${
                accountIsActive
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}>
                <StatusDot positive={accountIsActive} />
                {statusLabel}
              </div>
            </div>

            {activeWorkspace === 'overview' ? (
              <div className="space-y-6">
                <section className="overflow-hidden rounded-lg bg-teal-900 text-white shadow-sm">
                  <div className="grid lg:grid-cols-[1fr_310px]">
                    <div className="p-6 sm:p-8">
                      <p className="text-sm font-semibold text-teal-200">{copy.welcome}</p>
                      <h2 className="mt-2 max-w-xl text-2xl font-bold tracking-tight sm:text-3xl">
                        {copy.overviewTitle}
                      </h2>
                      <p className="mt-3 max-w-2xl text-sm leading-6 text-teal-100">{copy.overviewDescription}</p>
                    </div>
                    <div className="border-t border-white/15 bg-white/5 p-6 lg:border-l lg:border-t-0">
                      <p className="text-xs font-bold uppercase text-teal-200">{copy.quickAction}</p>
                      <button
                        className="mt-4 flex w-full items-center justify-between rounded-lg bg-white px-4 py-3 text-left text-sm font-bold text-teal-950 transition hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        onClick={() => selectWorkspace('redeem')}
                        type="button"
                      >
                        <span>
                          <span className="block">{copy.redeemNow}</span>
                          <span className="mt-0.5 block text-xs font-medium text-stone-500">{copy.redeemHint}</span>
                        </span>
                        <TicketCheck aria-hidden="true" className="size-5" />
                      </button>
                    </div>
                  </div>
                </section>

                <section aria-label={copy.overviewTitle} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[
                    { label: copy.giftCardsMetric, value: giftCardCount, icon: Gift, workspace: 'gift-cards' as const },
                    { label: copy.activeGiftCardsMetric, value: activeGiftCardCount, icon: CheckCircle2, workspace: 'gift-cards' as const },
                    { label: copy.vouchersMetric, value: voucherCount, icon: CreditCard, workspace: 'vouchers' as const },
                  ].map(({ label, value, icon: Icon, workspace }) => (
                    <button
                      key={label}
                      className="group rounded-lg border border-stone-200 bg-white p-4 text-left transition hover:border-teal-300 hover:bg-teal-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 sm:p-5"
                      onClick={() => selectWorkspace(workspace)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold leading-5 text-stone-500 sm:text-sm">{label}</p>
                        <Icon aria-hidden="true" className="hidden size-5 text-stone-400 transition-colors group-hover:text-teal-700 sm:block" strokeWidth={1.7} />
                      </div>
                      <p className="mt-3 text-2xl font-bold tabular-nums">{value}</p>
                    </button>
                  ))}
                  <button
                    className="rounded-lg border border-stone-200 bg-white p-4 text-left transition hover:border-teal-300 hover:bg-teal-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 sm:p-5"
                    onClick={() => selectWorkspace('settings')}
                    type="button"
                  >
                    <p className="text-xs font-semibold leading-5 text-stone-500 sm:text-sm">{copy.onlinePaymentsMetric}</p>
                    <p className="mt-3 flex items-center gap-2 text-sm font-bold">
                      <StatusDot positive={stripeConnected} />
                      {stripeConnected ? copy.connected : copy.actionRequired}
                    </p>
                  </button>
                </section>

                <section className="rounded-lg border border-stone-200 bg-white">
                  <div className="border-b border-stone-200 px-5 py-4 sm:px-6">
                    <h2 className="font-bold">{copy.businessDetails}</h2>
                  </div>
                  <dl className="grid sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      { label: copy.publicAddress, value: publicPagePath, icon: Store, href: publicPagePath },
                      { label: copy.category, value: categoryLabel, icon: Gift },
                      { label: copy.city, value: city, icon: MapPin },
                      { label: copy.accountStatus, value: statusLabel, icon: CheckCircle2 },
                    ].map(({ label, value, icon: Icon, href }, index) => (
                      <div key={label} className={`p-5 sm:p-6 ${index > 0 ? 'border-t border-stone-100 sm:border-t-0 sm:border-l' : ''}`}>
                        <dt className="flex items-center gap-2 text-xs font-semibold text-stone-500">
                          <Icon aria-hidden="true" className="size-4" />
                          {label}
                        </dt>
                        <dd className="mt-2 min-w-0 text-sm font-bold" title={value}>
                          {href ? (
                            <Link
                              className="group inline-flex max-w-full items-center gap-1.5 text-teal-800 underline decoration-teal-300 underline-offset-4 transition hover:text-teal-950 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                              href={href}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              <span className="truncate">{value}</span>
                              <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                            </Link>
                          ) : (
                            <span className="block truncate">{value}</span>
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>

                <p className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-900">
                  {overviewNotice}
                </p>
              </div>
            ) : (
              <div key={activeWorkspace}>{panels[activeWorkspace]}</div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}