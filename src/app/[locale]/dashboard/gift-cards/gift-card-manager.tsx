'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Gift, Layers3 } from 'lucide-react';

import { centsToEuros } from '@/lib/gift-cards/money';
import type { GiftCardType } from '@/lib/gift-cards/schema';
import type { Locale } from '@/lib/i18n/config';

import {
  toggleGiftCardActive,
  type ToggleGiftCardActiveResult,
} from './actions';
import {
  GiftCardForm,
  type GiftCardFormCopy,
  type GiftCardFormValues,
} from './gift-card-form';

export type GiftCardSectionCopy = {
  sectionTitle: string;
  catalogueTitle: string;
  catalogueDescription: string;
  totalLabel: string;
  activeCountLabel: string;
  emptyState: string;
  validityLabel: string;
  activeLabel: string;
  inactiveLabel: string;
  editLabel: string;
  activateLabel: string;
  deactivateLabel: string;
  toggleFailed: string;
  toggleSuccessActive: string;
  toggleSuccessInactive: string;
  form: GiftCardFormCopy;
};

type GiftCardListItem = {
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

type ToggleFeedbackState =
  | { ok: true; message: string }
  | { ok: false; message: string };

type Props = {
  locale: Locale;
  copy: GiftCardSectionCopy;
  giftCards: GiftCardListItem[];
};

function formatGiftCardAmount(card: GiftCardListItem): string {
  if (card.card_type === 'custom_value') {
    const min = card.min_amount_cents !== null ? `€${centsToEuros(card.min_amount_cents)}` : '—';
    const max = card.max_amount_cents !== null ? `€${centsToEuros(card.max_amount_cents)}` : '—';
    return `${min} – ${max}`;
  }

  return card.amount_cents !== null ? `€${centsToEuros(card.amount_cents)}` : '—';
}

function mapGiftCardToFormValues(card: GiftCardListItem): GiftCardFormValues {
  return {
    cardType: card.card_type,
    title: card.title,
    titleEn: card.title_en ?? '',
    description: card.description ?? '',
    descriptionEn: card.description_en ?? '',
    voucherCodePrefix: card.voucher_code_prefix ?? '',
    amount: card.amount_cents !== null ? centsToEuros(card.amount_cents) : '',
    minAmount: card.min_amount_cents !== null ? centsToEuros(card.min_amount_cents) : '',
    maxAmount: card.max_amount_cents !== null ? centsToEuros(card.max_amount_cents) : '',
    validDays: String(card.valid_days),
    active: card.active,
  };
}

function GiftCardRow({
  locale,
  card,
  copy,
  isEditingThisCard,
  onEdit,
}: {
  locale: Locale;
  card: GiftCardListItem;
  copy: GiftCardSectionCopy;
  isEditingThisCard: boolean;
  onEdit: (card: GiftCardListItem) => void;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<ToggleFeedbackState | null, FormData>(
    async () => {
      try {
        const result: ToggleGiftCardActiveResult = await toggleGiftCardActive(
          locale,
          card.id,
          !card.active,
        );

        if (!result.ok) {
          return result;
        }

        return {
          ok: true,
          message: card.active ? copy.toggleSuccessInactive : copy.toggleSuccessActive,
        };
      } catch {
        return {
          ok: false,
          message: copy.toggleFailed,
        };
      }
    },
    null,
  );

  useEffect(() => {
    if (state?.ok !== true) {
      return;
    }

    router.refresh();
  }, [router, state]);

  const toggleLabel = card.active ? copy.deactivateLabel : copy.activateLabel;
  const toggleButtonDisabled = isPending || isEditingThisCard;

  return (
    <li className="flex flex-col gap-4 rounded-lg border border-stone-200 bg-white p-4 transition hover:border-stone-300 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-900">{card.title}</p>
        <p className="text-xs text-slate-500">
          {copy.form.typeLabels[card.card_type]}
          {' · '}
          {formatGiftCardAmount(card)}
          {' · '}
          {card.valid_days} {copy.validityLabel}
        </p>
        {state !== null ? (
          <p
            aria-live="polite"
            className={
              state.ok
                ? 'text-xs font-medium text-emerald-700'
                : 'text-xs font-medium text-rose-700'
            }
            role={state.ok ? 'status' : 'alert'}
          >
            {state.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col items-start gap-3 sm:items-end">
        <span
          className={
            card.active
              ? 'inline-flex shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800'
              : 'inline-flex shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500'
          }
        >
          {card.active ? copy.activeLabel : copy.inactiveLabel}
        </span>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onEdit(card)}
            disabled={isPending}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700 transition hover:border-teal-400 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copy.editLabel}
          </button>

          <form action={formAction}>
            <button
              type="submit"
              disabled={toggleButtonDisabled}
              className={
                card.active
                  ? 'inline-flex min-h-11 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
                  : 'inline-flex min-h-11 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
              }
            >
              {isPending ? '…' : toggleLabel}
            </button>
          </form>
        </div>
      </div>
    </li>
  );
}

export function GiftCardManager({ locale, copy, giftCards }: Props) {
  const [editingGiftCard, setEditingGiftCard] = useState<GiftCardListItem | null>(null);

  function handleEdit(card: GiftCardListItem): void {
    setEditingGiftCard(card);
  }

  function handleCancelEdit(): void {
    setEditingGiftCard(null);
  }

  const isEditing = editingGiftCard !== null;
  const activeCount = giftCards.filter((card) => card.active).length;

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:max-w-lg">
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-stone-500">
            <Layers3 aria-hidden="true" className="size-4" />
            {copy.totalLabel}
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-stone-950">{giftCards.length}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
            <CheckCircle2 aria-hidden="true" className="size-4" />
            {copy.activeCountLabel}
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-950">{activeCount}</p>
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.12fr)_minmax(340px,0.88fr)]">
        <div className="rounded-lg border border-stone-200 bg-white p-5 sm:p-7">
          <GiftCardForm
            key={editingGiftCard?.id ?? 'create'}
            locale={locale}
            copy={copy.form}
            mode={isEditing ? 'edit' : 'create'}
            giftCardId={editingGiftCard?.id}
            initialValues={editingGiftCard === null ? undefined : mapGiftCardToFormValues(editingGiftCard)}
            onCancelEdit={handleCancelEdit}
          />
        </div>

        <aside className="rounded-lg border border-stone-200 bg-stone-50/70 p-4 sm:p-5 xl:sticky xl:top-24">
          <div className="flex items-start gap-3 border-b border-stone-200 pb-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal-100 text-teal-800">
              <Gift aria-hidden="true" className="size-[18px]" />
            </span>
            <div className="min-w-0">
              <h2 className="font-bold tracking-tight text-stone-950">{copy.catalogueTitle}</h2>
              <p className="mt-1 text-xs leading-5 text-stone-500">{copy.catalogueDescription}</p>
            </div>
          </div>

          <ul className="mt-4 space-y-3">
            {giftCards.length === 0 ? (
              <li className="rounded-lg border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-sm text-stone-500">
                {copy.emptyState}
              </li>
            ) : (
              giftCards.map((card) => (
                <GiftCardRow
                  key={card.id}
                  locale={locale}
                  card={card}
                  copy={copy}
                  isEditingThisCard={editingGiftCard?.id === card.id}
                  onEdit={handleEdit}
                />
              ))
            )}
          </ul>
        </aside>
      </div>
    </section>
  );
}
