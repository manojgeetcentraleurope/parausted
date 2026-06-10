'use client';

import { useActionState, useEffect } from 'react';
import Link from 'next/link';

import type { Locale } from '@/lib/i18n/config';
import type { GiftCardType } from '@/lib/gift-cards/schema';
import {
  RELATIONSHIP_VALUES,
  DESIGN_TEMPLATE_VALUES,
  type DirectPaymentMethod,
  type PurchasePaymentMethod,
} from '@/lib/purchases/schema';
import { createPurchaseAction, type PurchaseActionState } from './actions';

// ---------------------------------------------------------------------------
// Prop types (exported so page.tsx can import them)
// ---------------------------------------------------------------------------

export type GiftCardDisplayData = {
  id: string;
  cardType: GiftCardType;
  title: string;
  description: string | null;
  displayAmount: string;
  amountCents: number | null;
  minAmountCents: number | null;
  maxAmountCents: number | null;
  validDays: number;
};

export type MerchantDisplayData = {
  name: string;
  slug: string;
};

type PurchaseFormProps = {
  locale: Locale;
  merchant: MerchantDisplayData;
  giftCard: GiftCardDisplayData;
  availablePaymentMethods: readonly DirectPaymentMethod[];
  stripeCardAvailable: boolean;
};

// ---------------------------------------------------------------------------
// Inline copy
// ---------------------------------------------------------------------------

type Copy = {
  backLabel: string;
  pageTitlePrefix: string;
  validity: (days: number) => string;
  sectionBuyer: string;
  sectionRecipient: string;
  sectionPersonalization: string;
  sectionPayment: string;
  fieldBuyerEmail: string;
  fieldBuyerName: string;
  fieldBuyerNameOptional: string;
  fieldRecipientName: string;
  fieldRecipientEmail: string;
  fieldRelationship: string;
  fieldDesignTemplate: string;
  fieldSenderName: string;
  fieldPersonalMessage: string;
  fieldCustomAmount: string;
  fieldPaymentMethod: string;
  fieldConsent: string;
  submitLabel: string;
  submittingLabel: string;
  paymentMethodLabels: Record<PurchasePaymentMethod, string>;
  relationshipLabels: Record<(typeof RELATIONSHIP_VALUES)[number], string>;
  designTemplateLabels: Record<(typeof DESIGN_TEMPLATE_VALUES)[number], string>;
  successTitle: string;
  successSubtitle: string;
  referenceCodeLabel: string;
  amountLabel: string;
  paymentInstructions: {
    bizum_direct: (phone: string, code: string) => string;
    bank_transfer: (iban: string, code: string) => string;
    cash: (code: string) => string;
  };
  nextStepsLabel: string;
  backToMerchantLabel: string;
  selectPlaceholder: string;
  selectRelationshipPlaceholder: string;
  selectDesignTemplatePlaceholder: string;
  selectPaymentMethodPlaceholder: string;
  charCount: (current: number, max: number) => string;
  redirectingToCheckout: string;
  checkoutError: string;
};

const COPY: Record<Locale, Copy> = {
  es: {
    backLabel: 'Volver',
    pageTitlePrefix: 'Comprar',
    validity: (days) => `${days} días de validez`,
    sectionBuyer: 'Tus datos',
    sectionRecipient: 'Datos del destinatario',
    sectionPersonalization: 'Personalización',
    sectionPayment: 'Método de pago',
    fieldBuyerEmail: 'Tu correo electrónico',
    fieldBuyerName: 'Tu nombre',
    fieldBuyerNameOptional: 'Tu nombre (opcional)',
    fieldRecipientName: 'Nombre del destinatario',
    fieldRecipientEmail: 'Correo electrónico del destinatario',
    fieldRelationship: 'Relación',
    fieldDesignTemplate: 'Diseño de la tarjeta',
    fieldSenderName: 'Tu nombre en la tarjeta',
    fieldPersonalMessage: 'Mensaje personal',
    fieldCustomAmount: 'Importe (€)',
    fieldPaymentMethod: 'Método de pago',
    fieldConsent:
      'Entiendo que esta tarjeta regalo digital será personalizada y acepto la entrega digital tras la confirmación del pago.',
    submitLabel: 'Enviar solicitud',
    submittingLabel: 'Enviando…',
    paymentMethodLabels: {
      bizum_direct: 'Bizum',
      bank_transfer: 'Transferencia bancaria',
      cash: 'Efectivo',
      card: 'Tarjeta de crédito/débito',
    },
    relationshipLabels: {
      mama: 'Mamá',
      papa: 'Papá',
      hija: 'Hija',
      hijo: 'Hijo',
      abuelo: 'Abuelo',
      abuela: 'Abuela',
      pareja: 'Pareja',
      familia: 'Familia',
      amigo: 'Amigo/a',
      custom: 'Personalizado',
    },
    designTemplateLabels: {
      classic: 'Clásico',
      warm: 'Cálido',
      celebration: 'Celebración',
      romantic: 'Romántico',
      family: 'Familiar',
    },
    successTitle: 'Solicitud creada',
    successSubtitle:
      'Tu tarjeta regalo se emitirá cuando el comercio confirme el pago.',
    referenceCodeLabel: 'Código de referencia',
    amountLabel: 'Importe',
    nextStepsLabel: 'Próximos pasos',
    paymentInstructions: {
      bizum_direct: (phone, code) =>
        `Envía ${COPY.es.amountLabel} por Bizum al número ${phone}. Incluye el código ${code} en el concepto.`,
      bank_transfer: (iban, code) =>
        `Realiza la transferencia al IBAN ${iban}. Incluye el código ${code} en el concepto.`,
      cash: (code) =>
        `Paga directamente al comercio. Indica el código ${code} al realizar el pago.`,
    },
    backToMerchantLabel: 'Volver al negocio',
    selectPlaceholder: 'Selecciona una opción',
    selectRelationshipPlaceholder: 'Selecciona la relación',
    selectDesignTemplatePlaceholder: 'Selecciona un diseño',
    selectPaymentMethodPlaceholder: 'Selecciona el método de pago',
    charCount: (current, max) => `${current} / ${max}`,
    redirectingToCheckout: 'Redirigiendo al pago con tarjeta…',
    checkoutError: 'No se pudo iniciar el pago. Inténtalo de nuevo.',
  },
  en: {
    backLabel: 'Back',
    pageTitlePrefix: 'Buy',
    validity: (days) => `${days} days validity`,
    sectionBuyer: 'Your details',
    sectionRecipient: "Recipient's details",
    sectionPersonalization: 'Personalization',
    sectionPayment: 'Payment method',
    fieldBuyerEmail: 'Your email',
    fieldBuyerName: 'Your name',
    fieldBuyerNameOptional: 'Your name (optional)',
    fieldRecipientName: "Recipient's name",
    fieldRecipientEmail: "Recipient's email",
    fieldRelationship: 'Relationship',
    fieldDesignTemplate: 'Card design',
    fieldSenderName: 'Your name on the card',
    fieldPersonalMessage: 'Personal message',
    fieldCustomAmount: 'Amount (€)',
    fieldPaymentMethod: 'Payment method',
    fieldConsent:
      'I understand this digital gift card will be personalized and agree to digital delivery after payment confirmation.',
    submitLabel: 'Submit request',
    submittingLabel: 'Submitting…',
    paymentMethodLabels: {
      bizum_direct: 'Bizum',
      bank_transfer: 'Bank transfer',
      cash: 'Cash',
      card: 'Credit/debit card',
    },
    relationshipLabels: {
      mama: 'Mom',
      papa: 'Dad',
      hija: 'Daughter',
      hijo: 'Son',
      abuelo: 'Grandfather',
      abuela: 'Grandmother',
      pareja: 'Partner',
      familia: 'Family',
      amigo: 'Friend',
      custom: 'Custom',
    },
    designTemplateLabels: {
      classic: 'Classic',
      warm: 'Warm',
      celebration: 'Celebration',
      romantic: 'Romantic',
      family: 'Family',
    },
    successTitle: 'Request created',
    successSubtitle:
      'Your gift card will be issued after the merchant confirms payment.',
    referenceCodeLabel: 'Reference code',
    amountLabel: 'Amount',
    nextStepsLabel: 'Next steps',
    paymentInstructions: {
      bizum_direct: (phone, code) =>
        `Send ${COPY.en.amountLabel} via Bizum to ${phone}. Include code ${code} in the payment concept.`,
      bank_transfer: (iban, code) =>
        `Transfer to IBAN ${iban}. Include code ${code} in the payment reference.`,
      cash: (code) =>
        `Pay the merchant directly. Mention code ${code} when making the payment.`,
    },
    backToMerchantLabel: 'Back to merchant',
    selectPlaceholder: 'Select an option',
    selectRelationshipPlaceholder: 'Select relationship',
    selectDesignTemplatePlaceholder: 'Select a design',
    selectPaymentMethodPlaceholder: 'Select payment method',
    charCount: (current, max) => `${current} / ${max}`,
    redirectingToCheckout: 'Redirecting to card payment…',
    checkoutError: 'Could not start payment. Please try again.',
  },
};

// ---------------------------------------------------------------------------
// Shared style constants
// ---------------------------------------------------------------------------

const inputClassName =
  'mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10';
const inputErrorClassName =
  'mt-2 w-full rounded-2xl border border-rose-400 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10';
const labelClassName = 'block text-sm font-medium text-slate-700';
const errorClassName = 'mt-1 text-sm text-rose-600';
const helperClassName = 'mt-1 text-xs text-slate-400';
const sectionTitleClassName = 'mb-4 text-base font-semibold text-slate-800';
const primaryButtonClassName =
  'inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-60';
const spinnerClassName =
  'h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent';

// ---------------------------------------------------------------------------
// Field error helper
// ---------------------------------------------------------------------------

function getFieldError(
  state: PurchaseActionState,
  field: string,
): string | undefined {
  if (state === null || state.ok) {
    return undefined;
  }
  return state.fieldErrors?.[field]?.[0];
}

// ---------------------------------------------------------------------------
// Success panel
// ---------------------------------------------------------------------------

type SuccessPanelProps = {
  copy: Copy;
  locale: Locale;
  merchantSlug: string;
  referenceCode: string;
  displayAmount: string;
  paymentMethod: DirectPaymentMethod;
  merchantBizumPhone?: string;
  merchantBankIban?: string;
};

function SuccessPanel({
  copy,
  locale,
  merchantSlug,
  referenceCode,
  displayAmount,
  paymentMethod,
  merchantBizumPhone,
  merchantBankIban,
}: SuccessPanelProps) {
  function buildPaymentInstruction(): string {
    if (paymentMethod === 'bizum_direct' && merchantBizumPhone) {
      return copy.paymentInstructions.bizum_direct(merchantBizumPhone, referenceCode);
    }
    if (paymentMethod === 'bank_transfer' && merchantBankIban) {
      return copy.paymentInstructions.bank_transfer(merchantBankIban, referenceCode);
    }
    return copy.paymentInstructions.cash(referenceCode);
  }

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
      <h2 className="text-lg font-semibold text-emerald-800">{copy.successTitle}</h2>
      <p className="mt-1 text-sm text-emerald-700">{copy.successSubtitle}</p>

      <dl className="mt-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <dt className="text-sm font-medium text-slate-600">{copy.referenceCodeLabel}</dt>
          <dd className="text-sm font-mono font-semibold text-slate-900">{referenceCode}</dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="text-sm font-medium text-slate-600">{copy.amountLabel}</dt>
          <dd className="text-sm font-semibold text-slate-900">{displayAmount}</dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="text-sm font-medium text-slate-600">{copy.fieldPaymentMethod}</dt>
          <dd className="text-sm text-slate-900">
            {copy.paymentMethodLabels[paymentMethod]}
          </dd>
        </div>
      </dl>

      <div className="mt-6 rounded-xl border border-emerald-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {copy.nextStepsLabel}
        </p>
        <p className="mt-2 text-sm text-slate-700">{buildPaymentInstruction()}</p>
      </div>

      <div className="mt-6">
        <Link
          href={`/${locale}/m/${merchantSlug}`}
          className="text-sm font-medium text-cyan-700 hover:underline"
        >
          ← {copy.backToMerchantLabel}
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main form component
// ---------------------------------------------------------------------------

export function PurchaseForm({
  locale,
  merchant,
  giftCard,
  availablePaymentMethods,
  stripeCardAvailable,
}: PurchaseFormProps) {
  const copy = COPY[locale];

  const boundAction = createPurchaseAction.bind(null, {
    locale,
    slug: merchant.slug,
    giftCardId: giftCard.id,
  });

  const initialState: PurchaseActionState = null;
  const [state, formAction, isPending] = useActionState(boundAction, initialState);

  // Redirect to Stripe Checkout when action returns a checkout URL.
  // useEffect must be called before any conditional returns (Rules of Hooks).
  useEffect(() => {
    if (
      state !== null &&
      state.ok &&
      state.data.kind === 'stripe_checkout' &&
      state.data.checkoutUrl
    ) {
      window.location.href = state.data.checkoutUrl;
    }
  }, [state]);

  const isCustomValue = giftCard.cardType === 'custom_value';

  if (state !== null && state.ok) {
    if (state.data.kind === 'stripe_checkout') {
      if (!state.data.checkoutUrl) {
        return (
          <div
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            {copy.checkoutError}
          </div>
        );
      }
      // useEffect above handles window.location.href redirect
      return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-sm text-slate-600">{copy.redirectingToCheckout}</p>
        </div>
      );
    }

    return (
      <SuccessPanel
        copy={copy}
        locale={locale}
        merchantSlug={merchant.slug}
        referenceCode={state.data.referenceCode}
        displayAmount={state.data.displayAmount}
        paymentMethod={state.data.paymentMethod}
        merchantBizumPhone={state.data.merchantBizumPhone}
        merchantBankIban={state.data.merchantBankIban}
      />
    );
  }

  const genericError =
    state !== null && !state.ok && !state.fieldErrors ? state.message : undefined;

  return (
    <div>
      {/* Back link */}
      <Link
        href={`/${locale}/m/${merchant.slug}`}
        className="text-sm font-medium text-cyan-700 hover:underline"
      >
        ← {copy.backLabel}
      </Link>

      {/* Gift card summary */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          {merchant.name}
        </p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">
          {copy.pageTitlePrefix}: {giftCard.title}
        </h1>
        {giftCard.description && (
          <p className="mt-1 text-sm text-slate-600">{giftCard.description}</p>
        )}
        <p className="mt-2 text-base font-bold text-slate-900">{giftCard.displayAmount}</p>
        <p className="mt-0.5 text-xs text-slate-400">{copy.validity(giftCard.validDays)}</p>
      </div>

      {/* Generic server error */}
      {genericError && (
        <div
          role="alert"
          className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          {genericError}
        </div>
      )}

      <form action={formAction} className="mt-6 space-y-8" noValidate>
        {/* ── Buyer section ── */}
        <section aria-labelledby="section-buyer">
          <h2 id="section-buyer" className={sectionTitleClassName}>
            {copy.sectionBuyer}
          </h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="buyerEmail" className={labelClassName}>
                {copy.fieldBuyerEmail}
                <span aria-hidden="true" className="ml-1 text-rose-500">*</span>
              </label>
              <input
                id="buyerEmail"
                name="buyerEmail"
                type="email"
                autoComplete="email"
                required
                aria-describedby={getFieldError(state, 'buyerEmail') ? 'buyerEmail-error' : undefined}
                className={getFieldError(state, 'buyerEmail') ? inputErrorClassName : inputClassName}
              />
              {getFieldError(state, 'buyerEmail') && (
                <p id="buyerEmail-error" role="alert" className={errorClassName}>
                  {getFieldError(state, 'buyerEmail')}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="buyerName" className={labelClassName}>
                {copy.fieldBuyerNameOptional}
              </label>
              <input
                id="buyerName"
                name="buyerName"
                type="text"
                autoComplete="name"
                maxLength={120}
                aria-describedby={getFieldError(state, 'buyerName') ? 'buyerName-error' : undefined}
                className={getFieldError(state, 'buyerName') ? inputErrorClassName : inputClassName}
              />
              {getFieldError(state, 'buyerName') && (
                <p id="buyerName-error" role="alert" className={errorClassName}>
                  {getFieldError(state, 'buyerName')}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── Recipient section ── */}
        <section aria-labelledby="section-recipient">
          <h2 id="section-recipient" className={sectionTitleClassName}>
            {copy.sectionRecipient}
          </h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="recipientName" className={labelClassName}>
                {copy.fieldRecipientName}
                <span aria-hidden="true" className="ml-1 text-rose-500">*</span>
              </label>
              <input
                id="recipientName"
                name="recipientName"
                type="text"
                autoComplete="off"
                required
                maxLength={120}
                aria-describedby={getFieldError(state, 'recipientName') ? 'recipientName-error' : undefined}
                className={getFieldError(state, 'recipientName') ? inputErrorClassName : inputClassName}
              />
              {getFieldError(state, 'recipientName') && (
                <p id="recipientName-error" role="alert" className={errorClassName}>
                  {getFieldError(state, 'recipientName')}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="recipientEmail" className={labelClassName}>
                {copy.fieldRecipientEmail}
                <span aria-hidden="true" className="ml-1 text-rose-500">*</span>
              </label>
              <input
                id="recipientEmail"
                name="recipientEmail"
                type="email"
                autoComplete="off"
                required
                aria-describedby={getFieldError(state, 'recipientEmail') ? 'recipientEmail-error' : undefined}
                className={getFieldError(state, 'recipientEmail') ? inputErrorClassName : inputClassName}
              />
              {getFieldError(state, 'recipientEmail') && (
                <p id="recipientEmail-error" role="alert" className={errorClassName}>
                  {getFieldError(state, 'recipientEmail')}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── Personalization section ── */}
        <section aria-labelledby="section-personalization">
          <h2 id="section-personalization" className={sectionTitleClassName}>
            {copy.sectionPersonalization}
          </h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="relationship" className={labelClassName}>
                {copy.fieldRelationship}
                <span aria-hidden="true" className="ml-1 text-rose-500">*</span>
              </label>
              <select
                id="relationship"
                name="relationship"
                required
                defaultValue=""
                aria-describedby={getFieldError(state, 'relationship') ? 'relationship-error' : undefined}
                className={`${getFieldError(state, 'relationship') ? inputErrorClassName : inputClassName} pr-10`}
              >
                <option value="" disabled>
                  {copy.selectRelationshipPlaceholder}
                </option>
                {RELATIONSHIP_VALUES.map((rel) => (
                  <option key={rel} value={rel}>
                    {copy.relationshipLabels[rel]}
                  </option>
                ))}
              </select>
              {getFieldError(state, 'relationship') && (
                <p id="relationship-error" role="alert" className={errorClassName}>
                  {getFieldError(state, 'relationship')}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="designTemplate" className={labelClassName}>
                {copy.fieldDesignTemplate}
                <span aria-hidden="true" className="ml-1 text-rose-500">*</span>
              </label>
              <select
                id="designTemplate"
                name="designTemplate"
                required
                defaultValue=""
                aria-describedby={getFieldError(state, 'designTemplate') ? 'designTemplate-error' : undefined}
                className={`${getFieldError(state, 'designTemplate') ? inputErrorClassName : inputClassName} pr-10`}
              >
                <option value="" disabled>
                  {copy.selectDesignTemplatePlaceholder}
                </option>
                {DESIGN_TEMPLATE_VALUES.map((tpl) => (
                  <option key={tpl} value={tpl}>
                    {copy.designTemplateLabels[tpl]}
                  </option>
                ))}
              </select>
              {getFieldError(state, 'designTemplate') && (
                <p id="designTemplate-error" role="alert" className={errorClassName}>
                  {getFieldError(state, 'designTemplate')}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="senderName" className={labelClassName}>
                {copy.fieldSenderName}
                <span aria-hidden="true" className="ml-1 text-rose-500">*</span>
              </label>
              <input
                id="senderName"
                name="senderName"
                type="text"
                autoComplete="name"
                required
                maxLength={120}
                aria-describedby={getFieldError(state, 'senderName') ? 'senderName-error' : undefined}
                className={getFieldError(state, 'senderName') ? inputErrorClassName : inputClassName}
              />
              {getFieldError(state, 'senderName') && (
                <p id="senderName-error" role="alert" className={errorClassName}>
                  {getFieldError(state, 'senderName')}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="personalMessage" className={labelClassName}>
                {copy.fieldPersonalMessage}
                <span aria-hidden="true" className="ml-1 text-rose-500">*</span>
              </label>
              <textarea
                id="personalMessage"
                name="personalMessage"
                required
                maxLength={500}
                rows={4}
                aria-describedby={[
                  getFieldError(state, 'personalMessage') ? 'personalMessage-error' : '',
                  'personalMessage-count',
                ]
                  .filter(Boolean)
                  .join(' ') || undefined}
                className={`${getFieldError(state, 'personalMessage') ? inputErrorClassName : inputClassName} min-h-28 resize-y`}
              />
              <p id="personalMessage-count" className={helperClassName} aria-live="polite">
                {copy.charCount(0, 500)}
              </p>
              {getFieldError(state, 'personalMessage') && (
                <p id="personalMessage-error" role="alert" className={errorClassName}>
                  {getFieldError(state, 'personalMessage')}
                </p>
              )}
            </div>

            {/* Custom amount — only for custom_value cards */}
            {isCustomValue && (
              <div>
                <label htmlFor="customAmountInput" className={labelClassName}>
                  {copy.fieldCustomAmount}
                  <span aria-hidden="true" className="ml-1 text-rose-500">*</span>
                </label>
                {giftCard.minAmountCents !== null && giftCard.maxAmountCents !== null && (
                  <p className={helperClassName}>
                    {giftCard.displayAmount}
                  </p>
                )}
                <input
                  id="customAmountInput"
                  name="customAmountInput"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  required
                  placeholder="0.00"
                  aria-describedby={getFieldError(state, 'customAmountInput') ? 'customAmountInput-error' : undefined}
                  className={getFieldError(state, 'customAmountInput') ? inputErrorClassName : inputClassName}
                />
                {getFieldError(state, 'customAmountInput') && (
                  <p id="customAmountInput-error" role="alert" className={errorClassName}>
                    {getFieldError(state, 'customAmountInput')}
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── Payment method section ── */}
        <section aria-labelledby="section-payment">
          <h2 id="section-payment" className={sectionTitleClassName}>
            {copy.sectionPayment}
          </h2>

          <div>
            <label htmlFor="paymentMethod" className={labelClassName}>
              {copy.fieldPaymentMethod}
              <span aria-hidden="true" className="ml-1 text-rose-500">*</span>
            </label>
            <select
              id="paymentMethod"
              name="paymentMethod"
              required
              defaultValue=""
              aria-describedby={getFieldError(state, 'paymentMethod') ? 'paymentMethod-error' : undefined}
              className={`${getFieldError(state, 'paymentMethod') ? inputErrorClassName : inputClassName} pr-10`}
            >
              <option value="" disabled>
                {copy.selectPaymentMethodPlaceholder}
              </option>
              {availablePaymentMethods.map((method) => (
                <option key={method} value={method}>
                  {copy.paymentMethodLabels[method]}
                </option>
              ))}
              {stripeCardAvailable && (
                <option value="card">
                  {copy.paymentMethodLabels['card']}
                </option>
              )}
            </select>
            {getFieldError(state, 'paymentMethod') && (
              <p id="paymentMethod-error" role="alert" className={errorClassName}>
                {getFieldError(state, 'paymentMethod')}
              </p>
            )}
          </div>
        </section>

        {/* ── Consent ── */}
        <div className="flex items-start gap-3">
          <input
            id="consentDelivery"
            name="consentDelivery"
            type="checkbox"
            defaultChecked={false}
            required
            aria-describedby={getFieldError(state, 'consentDelivery') ? 'consentDelivery-error' : undefined}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-cyan-600 focus:ring-4 focus:ring-cyan-500/10"
          />
          <div>
            <label htmlFor="consentDelivery" className="text-sm text-slate-700">
              {copy.fieldConsent}
            </label>
            {getFieldError(state, 'consentDelivery') && (
              <p id="consentDelivery-error" role="alert" className={errorClassName}>
                {getFieldError(state, 'consentDelivery')}
              </p>
            )}
          </div>
        </div>

        {/* ── Submit ── */}
        <button
          type="submit"
          disabled={isPending}
          aria-disabled={isPending}
          className={primaryButtonClassName}
        >
          {isPending ? (
            <span className="inline-flex items-center gap-2">
              <span className={spinnerClassName} aria-hidden="true" />
              {copy.submittingLabel}
            </span>
          ) : (
            copy.submitLabel
          )}
        </button>
      </form>
    </div>
  );
}
