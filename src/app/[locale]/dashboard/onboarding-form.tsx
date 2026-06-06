'use client';

import {
  useActionState,
  useEffect,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';

import type { Locale } from '@/lib/i18n/config';
import { MERCHANT_CATEGORIES, type MerchantCategory } from '@/lib/merchants/schema';

import { createMerchantProfile, type CreateMerchantProfileResult } from './actions';

type FieldName =
  | 'name'
  | 'slug'
  | 'category'
  | 'description'
  | 'phone'
  | 'websiteUrl'
  | 'address'
  | 'city'
  | 'bizumPhone'
  | 'bankIban'
  | 'brandColor';
type FormState = CreateMerchantProfileResult | null;

export type OnboardingFormCopy = {
  title: string;
  description: string;
  fields: {
    name: string;
    slug: string;
    category: string;
    description: string;
    phone: string;
    websiteUrl: string;
    address: string;
    city: string;
    bizumPhone: string;
    bankIban: string;
    brandColor: string;
  };
  categoryLabels: Partial<Record<MerchantCategory, string>>;
  submit: string;
  submitting: string;
  success: string;
};

export type OnboardingFormProps = {
  locale: Locale;
  copy: OnboardingFormCopy;
};

type FieldContainerProps = {
  id: string;
  label: string;
  className?: string;
  error?: string;
  children: (errorId: string | undefined) => ReactNode;
};

type FormFieldProps = {
  id: string;
  name: FieldName;
  label: string;
  className?: string;
  error?: string;
  required?: boolean;
};

type TextFieldProps = FormFieldProps &
  Omit<ComponentPropsWithoutRef<'input'>, 'id' | 'name' | 'className' | 'required'> & {
    defaultValue?: string;
    type?: 'text' | 'url' | 'tel';
    autoComplete?: string;
    inputMode?: 'text' | 'tel' | 'url';
    maxLength?: number;
    spellCheck?: boolean;
  };

type TextAreaFieldProps = FormFieldProps &
  Omit<ComponentPropsWithoutRef<'textarea'>, 'id' | 'name' | 'className' | 'required'> & {
    defaultValue?: string;
    rows?: number;
    maxLength?: number;
    spellCheck?: boolean;
  };

type SelectFieldProps = FormFieldProps & {
  categoryLabels: Partial<Record<MerchantCategory, string>>;
};

type FeedbackBannerProps = {
  state: FormState;
  successMessage: string;
};

const inputClassName =
  'mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10';
const selectClassName = `${inputClassName} pr-10`;
const textAreaClassName = `${inputClassName} min-h-32 resize-y`;
const labelClassName = 'block text-sm font-medium text-slate-700';
const errorClassName = 'mt-2 text-sm text-rose-600';
const bannerBaseClassName = 'rounded-2xl border px-4 py-3 text-sm';
const primaryButtonClassName =
  'inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-60';

function normalizeFieldErrorName(fieldName: string): FieldName | null {
  switch (fieldName) {
    case 'name':
    case 'slug':
    case 'category':
    case 'description':
    case 'phone':
    case 'websiteUrl':
    case 'address':
    case 'city':
    case 'bizumPhone':
    case 'bankIban':
    case 'brandColor':
      return fieldName;
    case 'website_url':
      return 'websiteUrl';
    case 'bizum_phone':
      return 'bizumPhone';
    case 'bank_iban':
      return 'bankIban';
    case 'brand_color':
      return 'brandColor';
    default:
      return null;
  }
}

function buildFieldErrorMap(
  fieldErrors?: Record<string, string[]>,
): Partial<Record<FieldName, string[]>> {
  const normalizedErrors: Partial<Record<FieldName, string[]>> = {};

  if (!fieldErrors) {
    return normalizedErrors;
  }

  for (const [fieldName, errors] of Object.entries(fieldErrors)) {
    const normalizedName = normalizeFieldErrorName(fieldName);

    if (!normalizedName || errors.length === 0) {
      continue;
    }

    normalizedErrors[normalizedName] = errors;
  }

  return normalizedErrors;
}

function getCategoryLabel(
  categoryLabels: Partial<Record<MerchantCategory, string>>,
  category: MerchantCategory,
): string {
  return categoryLabels[category] ?? category;
}

function FieldContainer({
  id,
  label,
  className,
  error,
  children,
}: FieldContainerProps): ReactNode {
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className={className}>
      <label className={labelClassName} htmlFor={id}>
        {label}
      </label>
      {children(errorId)}
      {error ? (
        <p className={errorClassName} id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function TextField({
  id,
  name,
  label,
  className,
  error,
  required,
  defaultValue,
  type = 'text',
  autoComplete,
  inputMode,
  maxLength,
  spellCheck,
  ...inputProps
}: TextFieldProps): ReactNode {
  return (
    <FieldContainer className={className} error={error} id={id} label={label}>
      {(errorId) => (
        <input
          {...inputProps}
          aria-describedby={errorId}
          aria-invalid={Boolean(error)}
          autoComplete={autoComplete}
          className={inputClassName}
          defaultValue={defaultValue}
          id={id}
          inputMode={inputMode}
          maxLength={maxLength}
          name={name}
          required={required}
          spellCheck={spellCheck}
          type={type}
        />
      )}
    </FieldContainer>
  );
}

function TextAreaField({
  id,
  name,
  label,
  className,
  error,
  required,
  defaultValue,
  rows = 4,
  maxLength,
  spellCheck,
  ...textareaProps
}: TextAreaFieldProps): ReactNode {
  return (
    <FieldContainer className={className} error={error} id={id} label={label}>
      {(errorId) => (
        <textarea
          {...textareaProps}
          aria-describedby={errorId}
          aria-invalid={Boolean(error)}
          className={textAreaClassName}
          defaultValue={defaultValue}
          id={id}
          maxLength={maxLength}
          name={name}
          required={required}
          rows={rows}
          spellCheck={spellCheck}
        />
      )}
    </FieldContainer>
  );
}

function SelectField({
  id,
  name,
  label,
  className,
  error,
  required,
  categoryLabels,
}: SelectFieldProps): ReactNode {
  return (
    <FieldContainer className={className} error={error} id={id} label={label}>
      {(errorId) => (
        <select
          aria-describedby={errorId}
          aria-invalid={Boolean(error)}
          className={selectClassName}
          defaultValue=""
          id={id}
          name={name}
          required={required}
        >
          <option disabled value="">
            {label}
          </option>
          {MERCHANT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {getCategoryLabel(categoryLabels, category)}
            </option>
          ))}
        </select>
      )}
    </FieldContainer>
  );
}

function FeedbackBanner({ state, successMessage }: FeedbackBannerProps): ReactNode {
  if (!state) {
    return null;
  }

  if (state.ok) {
    return (
      <div
        aria-live="polite"
        className={`${bannerBaseClassName} border-emerald-200 bg-emerald-50 text-emerald-700`}
        role="status"
      >
        {successMessage}
      </div>
    );
  }

  return (
    <div
      aria-live="polite"
      className={`${bannerBaseClassName} border-rose-200 bg-rose-50 text-rose-700`}
      role="alert"
    >
      {state.message}
    </div>
  );
}

export function OnboardingForm({ locale, copy }: OnboardingFormProps): ReactNode {
  const [state, formAction, isPending] = useActionState(
    async (_previousState: FormState, formData: FormData): Promise<CreateMerchantProfileResult> =>
      createMerchantProfile(locale, formData),
    null,
  );

  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
    }
  }, [router, state]);

  const fieldErrors = buildFieldErrorMap(state && !state.ok ? state.fieldErrors : undefined);

  return (
    <section className="w-full rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="space-y-3">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-950">{copy.title}</h2>
        <p className="max-w-2xl text-sm leading-6 text-slate-600">{copy.description}</p>
      </div>

      <div className="mt-6">
        <FeedbackBanner state={state} successMessage={copy.success} />
      </div>

      <form action={formAction} className="mt-8 space-y-6" noValidate>
        <div className="grid gap-5 md:grid-cols-2">
          <TextField
            autoComplete="organization"
            error={fieldErrors.name?.[0]}
            id="merchant-name"
            label={copy.fields.name}
            maxLength={120}
            name="name"
            required
          />

          <TextField
            autoComplete="off"
            error={fieldErrors.slug?.[0]}
            id="merchant-slug"
            label={copy.fields.slug}
            maxLength={50}
            name="slug"
            required
            spellCheck={false}
          />

          <SelectField
            categoryLabels={copy.categoryLabels}
            error={fieldErrors.category?.[0]}
            id="merchant-category"
            label={copy.fields.category}
            name="category"
            required
          />

          <TextField
            autoComplete="address-level2"
            error={fieldErrors.city?.[0]}
            id="merchant-city"
            label={copy.fields.city}
            name="city"
          />

          <TextAreaField
            className="md:col-span-2"
            error={fieldErrors.description?.[0]}
            id="merchant-description"
            label={copy.fields.description}
            maxLength={1000}
            name="description"
            rows={4}
          />

          <TextField
            autoComplete="tel"
            error={fieldErrors.phone?.[0]}
            id="merchant-phone"
            inputMode="tel"
            label={copy.fields.phone}
            maxLength={32}
            name="phone"
            type="tel"
          />

          <TextField
            autoComplete="url"
            error={fieldErrors.websiteUrl?.[0]}
            id="merchant-website-url"
            inputMode="url"
            label={copy.fields.websiteUrl}
            maxLength={2048}
            name="websiteUrl"
            type="url"
          />

          <TextField
            autoComplete="street-address"
            error={fieldErrors.address?.[0]}
            id="merchant-address"
            label={copy.fields.address}
            maxLength={255}
            name="address"
          />

          <TextField
            autoComplete="tel"
            error={fieldErrors.bizumPhone?.[0]}
            id="merchant-bizum-phone"
            inputMode="tel"
            label={copy.fields.bizumPhone}
            maxLength={32}
            name="bizumPhone"
            type="tel"
          />

          <TextField
            autoComplete="off"
            error={fieldErrors.bankIban?.[0]}
            id="merchant-bank-iban"
            label={copy.fields.bankIban}
            maxLength={34}
            name="bankIban"
            spellCheck={false}
          />

          <TextField
            autoComplete="off"
            error={fieldErrors.brandColor?.[0]}
            id="merchant-brand-color"
            label={copy.fields.brandColor}
            maxLength={7}
            name="brandColor"
            spellCheck={false}
          />
        </div>

        <button className={primaryButtonClassName} disabled={isPending} type="submit">
          {isPending ? copy.submitting : copy.submit}
        </button>
      </form>
    </section>
  );
}