import { centsToEuros } from '@/lib/gift-cards/money';
import type { Locale } from '@/lib/i18n/config';
import {
  ADDON_COPY,
  countAddonPieces,
  getAddonCategoryLabel,
  getDemoAddonCollections,
} from '@/lib/addons/demo-catalog';

import { ProductMockup } from './product-mockup';

type AddonShowcaseProps = {
  category: string;
  locale: Locale;
  merchantName: string;
};

/**
 * D1 fake door: presentation only. No persistence, no payment, no address capture.
 * Renders nothing unless ADDONS_DEMO_ENABLED=true and the merchant is a tour operator.
 */
export function AddonShowcase({ category, locale, merchantName }: AddonShowcaseProps) {
  const collections = getDemoAddonCollections(category);

  if (collections === null) {
    return null;
  }

  const copy = ADDON_COPY[locale];
  const categoryLabel = getAddonCategoryLabel(category, locale);
  const pieceCount = countAddonPieces(collections);

  return (
    <section className="border-t border-black/10 bg-[#ebe6dc] px-5 py-14 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-7xl">
        <p className="mb-8 inline-flex items-center gap-2 border border-black/15 bg-white/60 px-3 py-2 text-xs text-black/60">
          <span aria-hidden="true">●</span>
          {copy.previewNotice}
        </p>

        <div className="grid gap-4 border-b border-black/10 pb-8 md:grid-cols-[1fr_1fr] md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--merchant-accent)]">
              {categoryLabel} · {copy.sectionLabel}
            </p>
            <h2 className="mt-3 max-w-lg font-serif text-3xl leading-tight sm:text-4xl">{copy.title}</h2>
          </div>
          <div className="max-w-md text-sm leading-6 text-black/55 md:justify-self-end">
            <p>{copy.description}</p>
            <p className="mt-3 text-xs uppercase tracking-[0.18em] text-black/40">
              {copy.countLabel(collections.length, pieceCount)}
            </p>
          </div>
        </div>

        <nav aria-label={copy.browseLabel} className="-mx-5 overflow-x-auto px-5 pt-6 sm:mx-0 sm:px-0">
          <ul className="flex w-max gap-2">
            {collections.map((collection) => (
              <li key={collection.id}>
                <a
                  href={`#addon-collection-${collection.id}`}
                  className="inline-flex min-h-11 items-center border border-black/15 bg-white/70 px-4 text-sm font-semibold text-black/65 transition hover:border-[var(--merchant-accent)] hover:text-[var(--merchant-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--merchant-accent)]"
                >
                  {collection.name[locale]}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-10 pt-10 sm:space-y-12">
          {collections.map((collection) => (
            <section
              key={collection.id}
              id={`addon-collection-${collection.id}`}
              aria-labelledby={`addon-collection-heading-${collection.id}`}
              className="scroll-mt-5"
            >
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-black/10 pb-3">
                <h3
                  id={`addon-collection-heading-${collection.id}`}
                  className="font-serif text-2xl leading-tight"
                >
                  {collection.name[locale]}
                </h3>
                <span className="text-xs uppercase tracking-[0.18em] text-black/40">
                  {collection.items.length}
                </span>
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-black/55">
                {collection.tagline[locale]}
              </p>

              <ul className="-mx-5 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-3 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 sm:pb-0 lg:grid-cols-3">
                {collection.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex w-[82vw] max-w-[320px] shrink-0 snap-start flex-col overflow-hidden border border-black/10 bg-white/80 shadow-[0_8px_24px_rgba(29,33,29,0.06)] sm:w-auto sm:max-w-none"
                  >
                    <ProductMockup
                      item={item}
                      merchantName={merchantName}
                      tone={collection.tone}
                      ink={collection.ink}
                    />
                    <div className="flex min-w-0 flex-1 flex-col p-4">
                      <p className="mb-2 text-[9px] font-semibold uppercase leading-4 tracking-[0.14em] text-[var(--merchant-accent)]">
                        {copy.brandedEdition(merchantName)}
                      </p>
                      <h4 className="font-serif text-lg leading-tight">{item.name[locale]}</h4>
                      <p className="mt-2 line-clamp-3 text-xs leading-5 text-black/55">
                        {item.description[locale]}
                      </p>
                      <p className="mt-auto pt-3 font-serif text-xl text-[var(--merchant-accent)]">
                        €{centsToEuros(item.priceCents)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-10 border-l-2 border-black/15 pl-4 text-xs leading-5 text-black/45">
          {copy.curationNote}
        </p>

        <fieldset className="mt-10 border border-black/10 bg-white/50 p-5">
          <legend className="px-2 text-xs font-semibold uppercase tracking-[0.2em] text-black/50">
            {copy.fulfilmentLegend}
          </legend>

          <div className="grid gap-3 sm:grid-cols-2">
            <label
              htmlFor="addon-fulfilment-pickup"
              className="flex cursor-pointer items-start gap-3 border border-black/15 bg-white p-4"
            >
              <input
                type="radio"
                id="addon-fulfilment-pickup"
                name="addon-fulfilment"
                value="pickup"
                defaultChecked
                className="mt-1 accent-[var(--merchant-accent)]"
              />
              <span>
                <span className="block text-sm font-semibold">{copy.pickupLabel}</span>
                <span className="mt-1 block text-xs text-black/55">{copy.pickupHint}</span>
              </span>
            </label>

            <label
              htmlFor="addon-fulfilment-ship"
              className="flex items-start gap-3 border border-dashed border-black/15 bg-black/[0.03] p-4 opacity-60"
            >
              <input
                type="radio"
                id="addon-fulfilment-ship"
                name="addon-fulfilment"
                value="ship"
                disabled
                aria-describedby="addon-fulfilment-ship-status"
                className="mt-1"
              />
              <span>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{copy.shipLabel}</span>
                  <span
                    id="addon-fulfilment-ship-status"
                    className="border border-black/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                  >
                    {copy.comingSoon}
                  </span>
                </span>
                <span className="mt-1 block text-xs text-black/55">{copy.shipHint}</span>
              </span>
            </label>
          </div>
        </fieldset>
      </div>
    </section>
  );
}
