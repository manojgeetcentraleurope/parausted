'use client';

import { useActionState, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { GIFT_CARD_TYPES, type GiftCardType } from '@/lib/gift-cards/schema';
import type { Locale } from '@/lib/i18n/config';

import {
  createGiftCard,
  updateGiftCard,
  type CreateGiftCardResult,
  type UpdateGiftCardResult,
} from './actions';

// ---------------------------------------------------------------------------
// Copy shape
// ---------------------------------------------------------------------------

export type GiftCardFormCopy = {
  title: string;
  editTitle: string;
  description: string;
  fields: {
    cardType: string;
    title: string;
    description: string;
    amount: string;
    minAmount: string;
    maxAmount: string;
    validDays: string;
    active: string;
  };
  typeLabels: Record<GiftCardType, string>;
  submit: string;
  submitting: string;
  success: string;
  editSubmit: string;
  editSubmitting: string;
  editSuccess: string;
  cancelEdit: string;
};

// ---------------------------------------------------------------------------
// Props and internal types
// ---------------------------------------------------------------------------

type Props = {
  locale: Locale;
  copy: GiftCardFormCopy;
  mode?: 'create' | 'edit';
  giftCardId?: string;
  initialValues?: Partial<GiftCardFormValues>;
  onCancelEdit?: () => void;
};

export type GiftCardFormValues = {
  cardType: GiftCardType;
  title: string;
  description: string;
  amount: string;
  minAmount: string;
  maxAmount: string;
  validDays: string;
  active: boolean;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_FORM_VALUES: GiftCardFormValues = {
  cardType: 'fixed_value',
  title: '',
  description: '',
  amount: '',
  minAmount: '',
  maxAmount: '',
  validDays: '365',
  active: true,
};

const INPUT_CLASSES =
  'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

const AMOUNT_INPUT_CLASSES =
  'block w-full rounded-md border border-gray-300 py-2 pl-8 pr-3 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

const LABEL_CLASSES = 'block text-sm font-medium text-gray-700';
const ERROR_CLASSES = 'mt-1 text-xs text-red-600';
const HINT_CLASSES = 'mt-1 text-xs text-gray-500';

function buildInitialFormValues(
  initialValues?: Partial<GiftCardFormValues>,
): GiftCardFormValues {
  return {
    ...DEFAULT_FORM_VALUES,
    ...initialValues,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GiftCardForm({
  locale,
  copy,
  mode = 'create',
  giftCardId,
  initialValues,
  onCancelEdit,
}: Props) {
  const router = useRouter();
  const resolvedGiftCardId = typeof giftCardId === 'string' ? giftCardId.trim() : '';
  const isEditMode = mode === 'edit' && resolvedGiftCardId.length > 0;
  const [formValues, setFormValues] = useState<GiftCardFormValues>(() =>
    buildInitialFormValues(initialValues),
  );

  const action = useCallback(
    (
      _prevState: CreateGiftCardResult | UpdateGiftCardResult | null,
      formData: FormData,
    ): Promise<CreateGiftCardResult | UpdateGiftCardResult> =>
      isEditMode
        ? updateGiftCard(locale, resolvedGiftCardId, formData)
        : createGiftCard(locale, formData),
    [isEditMode, locale, resolvedGiftCardId],
  );

  const [state, formAction, isPending] = useActionState<
    CreateGiftCardResult | UpdateGiftCardResult | null,
    FormData
  >(action, null);

  const isSuccess = state?.ok === true;

  useEffect(() => {
    if (!isSuccess) {
      return;
    }

    router.refresh();
  }, [isEditMode, isSuccess, router]);

  function handleChange<K extends keyof GiftCardFormValues>(
    field: K,
    value: GiftCardFormValues[K],
  ): void {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  }

  // Cast to allow undefined values — keys are only present when errors exist.
  const fieldErrors: Record<string, string[] | undefined> =
    state?.ok === false ? (state.fieldErrors ?? {}) : {};
  const generalError = state?.ok === false ? state.message : null;
  const heading = isEditMode ? copy.editTitle : copy.title;
  const submitLabel = isEditMode ? copy.editSubmit : copy.submit;
  const submittingLabel = isEditMode ? copy.editSubmitting : copy.submitting;
  const successLabel = isEditMode ? copy.editSuccess : copy.success;

  const showAmountField =
    formValues.cardType === 'fixed_value' || formValues.cardType === 'service';
  const showRangeFields = formValues.cardType === 'custom_value';

  return (
    <section className="w-full max-w-lg space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">{heading}</h2>
        {copy.description && (
          <p className="mt-1 text-sm text-gray-600">{copy.description}</p>
        )}
      </div>

      {isSuccess && (
        <div
          role="alert"
          className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800"
        >
          {successLabel}
        </div>
      )}

      <form action={formAction} noValidate className="space-y-5">
        {/* ---------------------------------------------------------------- */}
        {/* Card type                                                         */}
        {/* ---------------------------------------------------------------- */}
        <div>
          <label htmlFor="cardType" className={LABEL_CLASSES}>
            {copy.fields.cardType}
          </label>
          <select
            id="cardType"
            name="cardType"
            value={formValues.cardType}
            onChange={(e) =>
              handleChange('cardType', e.target.value as GiftCardType)
            }
            aria-describedby={
              fieldErrors['cardType'] !== undefined
                ? 'cardType-error'
                : undefined
            }
            className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {GIFT_CARD_TYPES.map((type) => (
              <option key={type} value={type}>
                {copy.typeLabels[type]}
              </option>
            ))}
          </select>
          {fieldErrors['cardType'] !== undefined && (
            <p id="cardType-error" role="alert" className={ERROR_CLASSES}>
              {fieldErrors['cardType'].join(' ')}
            </p>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Title                                                             */}
        {/* ---------------------------------------------------------------- */}
        <div>
          <label htmlFor="title" className={LABEL_CLASSES}>
            {copy.fields.title}
          </label>
          <input
            id="title"
            name="title"
            type="text"
            value={formValues.title}
            onChange={(e) => handleChange('title', e.target.value)}
            aria-describedby={
              fieldErrors['title'] !== undefined ? 'title-error' : undefined
            }
            className={INPUT_CLASSES}
          />
          {fieldErrors['title'] !== undefined && (
            <p id="title-error" role="alert" className={ERROR_CLASSES}>
              {fieldErrors['title'].join(' ')}
            </p>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Description                                                       */}
        {/* ---------------------------------------------------------------- */}
        <div>
          <label htmlFor="description" className={LABEL_CLASSES}>
            {copy.fields.description}
          </label>
          <textarea
            id="description"
            name="description"
            value={formValues.description}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={3}
            aria-describedby={
              fieldErrors['description'] !== undefined
                ? 'description-error'
                : undefined
            }
            className={INPUT_CLASSES}
          />
          {fieldErrors['description'] !== undefined && (
            <p id="description-error" role="alert" className={ERROR_CLASSES}>
              {fieldErrors['description'].join(' ')}
            </p>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Amount — fixed_value / service only                              */}
        {/* ---------------------------------------------------------------- */}
        {showAmountField && (
          <div>
            <label htmlFor="amount" className={LABEL_CLASSES}>
              {copy.fields.amount}
            </label>
            <div className="relative mt-1">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-400">
                €
              </span>
              <input
                id="amount"
                name="amount"
                type="text"
                inputMode="decimal"
                value={formValues.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                placeholder="25,50"
                aria-describedby={
                  fieldErrors['amount'] !== undefined
                    ? 'amount-hint amount-error'
                    : 'amount-hint'
                }
                className={AMOUNT_INPUT_CLASSES}
              />
            </div>
            <p id="amount-hint" className={HINT_CLASSES}>
              Ej. 25 o 25,50
            </p>
            {fieldErrors['amount'] !== undefined && (
              <p id="amount-error" role="alert" className={ERROR_CLASSES}>
                {fieldErrors['amount'].join(' ')}
              </p>
            )}
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Min / Max amount — custom_value only                             */}
        {/* ---------------------------------------------------------------- */}
        {showRangeFields && (
          <>
            <div>
              <label htmlFor="minAmount" className={LABEL_CLASSES}>
                {copy.fields.minAmount}
              </label>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-400">
                  €
                </span>
                <input
                  id="minAmount"
                  name="minAmount"
                  type="text"
                  inputMode="decimal"
                  value={formValues.minAmount}
                  onChange={(e) => handleChange('minAmount', e.target.value)}
                  placeholder="10"
                  aria-describedby={
                    fieldErrors['minAmount'] !== undefined
                      ? 'minAmount-hint minAmount-error'
                      : 'minAmount-hint'
                  }
                  className={AMOUNT_INPUT_CLASSES}
                />
              </div>
              <p id="minAmount-hint" className={HINT_CLASSES}>
                Ej. 10 o 10,50
              </p>
              {fieldErrors['minAmount'] !== undefined && (
                <p id="minAmount-error" role="alert" className={ERROR_CLASSES}>
                  {fieldErrors['minAmount'].join(' ')}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="maxAmount" className={LABEL_CLASSES}>
                {copy.fields.maxAmount}
              </label>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-400">
                  €
                </span>
                <input
                  id="maxAmount"
                  name="maxAmount"
                  type="text"
                  inputMode="decimal"
                  value={formValues.maxAmount}
                  onChange={(e) => handleChange('maxAmount', e.target.value)}
                  placeholder="100"
                  aria-describedby={
                    fieldErrors['maxAmount'] !== undefined
                      ? 'maxAmount-hint maxAmount-error'
                      : 'maxAmount-hint'
                  }
                  className={AMOUNT_INPUT_CLASSES}
                />
              </div>
              <p id="maxAmount-hint" className={HINT_CLASSES}>
                Ej. 100 o 150,00
              </p>
              {fieldErrors['maxAmount'] !== undefined && (
                <p id="maxAmount-error" role="alert" className={ERROR_CLASSES}>
                  {fieldErrors['maxAmount'].join(' ')}
                </p>
              )}
            </div>
          </>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Valid days                                                        */}
        {/* ---------------------------------------------------------------- */}
        <div>
          <label htmlFor="validDays" className={LABEL_CLASSES}>
            {copy.fields.validDays}
          </label>
          <input
            id="validDays"
            name="validDays"
            type="text"
            inputMode="numeric"
            value={formValues.validDays}
            onChange={(e) => handleChange('validDays', e.target.value)}
            aria-describedby={
              fieldErrors['validDays'] !== undefined
                ? 'validDays-error'
                : undefined
            }
            className={INPUT_CLASSES}
          />
          {fieldErrors['validDays'] !== undefined && (
            <p id="validDays-error" role="alert" className={ERROR_CLASSES}>
              {fieldErrors['validDays'].join(' ')}
            </p>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Active                                                            */}
        {/* Hidden input ensures the value is always submitted.              */}
        {/* The checkbox is purely a controlled UI element (no name attr).   */}
        {/* ---------------------------------------------------------------- */}
        <input
          type="hidden"
          name="active"
          value={formValues.active ? 'true' : 'false'}
        />
        <div>
          <div className="flex items-center gap-3">
            <input
              id="active"
              type="checkbox"
              checked={formValues.active}
              onChange={(e) => handleChange('active', e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="active" className="text-sm font-medium text-gray-700">
              {copy.fields.active}
            </label>
          </div>
          {fieldErrors['active'] !== undefined && (
            <p id="active-error" role="alert" className={ERROR_CLASSES}>
              {fieldErrors['active'].join(' ')}
            </p>
          )}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* General error                                                     */}
        {/* ---------------------------------------------------------------- */}
        {generalError !== null && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {generalError}
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Submit                                                            */}
        {/* ---------------------------------------------------------------- */}
        <div className={isEditMode ? 'flex flex-col gap-3 sm:flex-row' : undefined}>
          {isEditMode && onCancelEdit !== undefined ? (
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={isPending}
              className="w-full rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {copy.cancelEdit}
            </button>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className={
              isEditMode
                ? 'w-full flex-1 rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
                : 'w-full rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
            }
          >
            {isPending ? submittingLabel : submitLabel}
          </button>
        </div>
      </form>
    </section>
  );
}
