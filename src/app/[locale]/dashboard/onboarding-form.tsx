'use client';

import {
  useActionState,
  useEffect,
  useState,
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
  | 'descriptionEn'
  | 'phone'
  | 'websiteUrl'
  | 'address'
  | 'city'
  | 'bizumPhone'
  | 'bankIban'
  | 'brandColor';
type FormState = CreateMerchantProfileResult | null;
type MerchantFormValues = Record<FieldName, string>;
type FieldSlotIds = {
  descriptionId?: string;
  errorId?: string;
};

const initialFormValues: MerchantFormValues = {
  name: '',
  slug: '',
  category: '',
  description: '',
  descriptionEn: '',
  phone: '',
  websiteUrl: '',
  address: '',
  city: 'Sevilla',
  bizumPhone: '',
  bankIban: '',
  brandColor: '#000000',
};

export type OnboardingFormCopy = {
  title: string;
  description: string;
  fields: {
    name: string;
    slug: string;
    category: string;
    description: string;
    descriptionEn: string;
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
  description?: ReactNode;
  error?: string;
  children: (ids: FieldSlotIds) => ReactNode;
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
  Omit<
    ComponentPropsWithoutRef<'input'>,
    'id' | 'name' | 'className' | 'required' | 'value' | 'defaultValue' | 'onChange'
  > & {
    description?: ReactNode;
    value: string;
    onValueChange: (value: string) => void;
    type?: 'text' | 'url' | 'tel' | 'color';
    autoComplete?: string;
    inputMode?: 'text' | 'tel' | 'url';
    maxLength?: number;
    spellCheck?: boolean;
  };

type TextAreaFieldProps = FormFieldProps &
  Omit<
    ComponentPropsWithoutRef<'textarea'>,
    'id' | 'name' | 'className' | 'required' | 'value' | 'defaultValue' | 'onChange'
  > & {
    description?: ReactNode;
    value: string;
    onValueChange: (value: string) => void;
    rows?: number;
    maxLength?: number;
    spellCheck?: boolean;
  };

type SelectFieldProps = FormFieldProps & {
  description?: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
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
const helperClassName = 'mt-2 text-sm leading-6 text-slate-500';
const bannerBaseClassName = 'rounded-2xl border px-4 py-3 text-sm';
const primaryButtonClassName =
  'inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-60';

function hasSlugWarning(slug: string): boolean {
  const normalizedSlug = slug.toLowerCase();

  return (
    normalizedSlug.includes('http') ||
    normalizedSlug.includes('/') ||
    normalizedSlug.includes('.') ||
    normalizedSlug.includes('www')
  );
}

function getSlugHelpText(locale: Locale): string {
  return locale === 'es'
    ? 'Escribe solo un slug corto, no una URL completa.'
    : 'Enter only a short slug, not a full URL.';
}

function getSlugPreviewLabel(locale: Locale): string {
  return locale === 'es' ? 'Vista publica' : 'Public URL preview';
}

function getSlugWarningText(locale: Locale): string {
  return locale === 'es'
    ? 'El slug no debe contener http, /, . ni www.'
    : 'The slug should not contain http, /, . or www.';
}

function getPublicMerchantPath(locale: Locale, slug: string): string {
  const previewSlug = slug.trim() || 'slug';

  return `/${locale}/m/${previewSlug}`;
}

function normalizeFieldErrorName(fieldName: string): FieldName | null {
  switch (fieldName) {
    case 'name':
    case 'slug':
    case 'category':
    case 'description':
    case 'descriptionEn':
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
  description,
  error,
  children,
}: FieldContainerProps): ReactNode {
  const errorId = error ? `${id}-error` : undefined;
  const descriptionId = description ? `${id}-description` : undefined;

  return (
    <div className={className}>
      <label className={labelClassName} htmlFor={id}>
        {label}
      </label>
      {children({ descriptionId, errorId })}
      {description ? (
        <div className={helperClassName} id={descriptionId}>
          {description}
        </div>
      ) : null}
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
  description,
  error,
  required,
  value,
  onValueChange,
  type = 'text',
  autoComplete,
  inputMode,
  maxLength,
  spellCheck,
  ...inputProps
}: TextFieldProps): ReactNode {
  return (
    <FieldContainer
      className={className}
      description={description}
      error={error}
      id={id}
      label={label}
    >
      {({ descriptionId, errorId }) => {
        const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

        return (
          <input
            {...inputProps}
            aria-describedby={describedBy}
            aria-invalid={Boolean(error)}
            autoComplete={autoComplete}
            className={inputClassName}
            id={id}
            inputMode={inputMode}
            maxLength={maxLength}
            name={name}
            onChange={(event) => onValueChange(event.currentTarget.value)}
            required={required}
            spellCheck={spellCheck}
            type={type}
            value={value}
          />
        );
      }}
    </FieldContainer>
  );
}

function TextAreaField({
  id,
  name,
  label,
  className,
  description,
  error,
  required,
  value,
  onValueChange,
  rows = 4,
  maxLength,
  spellCheck,
  ...textareaProps
}: TextAreaFieldProps): ReactNode {
  return (
    <FieldContainer
      className={className}
      description={description}
      error={error}
      id={id}
      label={label}
    >
      {({ descriptionId, errorId }) => {
        const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

        return (
          <textarea
            {...textareaProps}
            aria-describedby={describedBy}
            aria-invalid={Boolean(error)}
            className={textAreaClassName}
            id={id}
            maxLength={maxLength}
            name={name}
            onChange={(event) => onValueChange(event.currentTarget.value)}
            required={required}
            rows={rows}
            spellCheck={spellCheck}
            value={value}
          />
        );
      }}
    </FieldContainer>
  );
}

function SelectField({
  id,
  name,
  label,
  className,
  description,
  error,
  required,
  value,
  onValueChange,
  categoryLabels,
}: SelectFieldProps): ReactNode {
  return (
    <FieldContainer
      className={className}
      description={description}
      error={error}
      id={id}
      label={label}
    >
      {({ descriptionId, errorId }) => {
        const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

        return (
          <select
            aria-describedby={describedBy}
            aria-invalid={Boolean(error)}
            className={selectClassName}
            id={id}
            name={name}
            onChange={(event) => onValueChange(event.currentTarget.value)}
            required={required}
            value={value}
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
        );
      }}
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
  const [formValues, setFormValues] = useState<MerchantFormValues>(() => ({
    ...initialFormValues,
  }));

  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
    }
  }, [router, state]);

  const fieldErrors = buildFieldErrorMap(state && !state.ok ? state.fieldErrors : undefined);
  const slugDescription = (
    <div className="space-y-1">
      <p>{getSlugHelpText(locale)}</p>
      <p className="text-slate-700">
        {getSlugPreviewLabel(locale)}:{' '}
        <code className="break-all font-mono text-slate-900">
          {getPublicMerchantPath(locale, formValues.slug)}
        </code>
      </p>
      {hasSlugWarning(formValues.slug) ? (
        <p className="text-amber-700">{getSlugWarningText(locale)}</p>
      ) : null}
    </div>
  );

  function updateField(fieldName: FieldName, value: string): void {
    setFormValues((currentValues) => ({
      ...currentValues,
      [fieldName]: value,
    }));
  }

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
            onValueChange={(value) => updateField('name', value)}
            required
            value={formValues.name}
          />

          <TextField
            autoComplete="off"
            description={slugDescription}
            error={fieldErrors.slug?.[0]}
            id="merchant-slug"
            label={copy.fields.slug}
            maxLength={50}
            name="slug"
            onValueChange={(value) => updateField('slug', value)}
            required
            spellCheck={false}
            value={formValues.slug}
          />

          <SelectField
            categoryLabels={copy.categoryLabels}
            error={fieldErrors.category?.[0]}
            id="merchant-category"
            label={copy.fields.category}
            name="category"
            onValueChange={(value) => updateField('category', value)}
            required
            value={formValues.category}
          />

          <TextField
            autoComplete="address-level2"
            error={fieldErrors.city?.[0]}
            id="merchant-city"
            label={copy.fields.city}
            name="city"
            onValueChange={(value) => updateField('city', value)}
            value={formValues.city}
          />

          <TextAreaField
            className="md:col-span-2"
            error={fieldErrors.description?.[0]}
            id="merchant-description"
            label={copy.fields.description}
            maxLength={1000}
            name="description"
            onValueChange={(value) => updateField('description', value)}
            rows={4}
            value={formValues.description}
          />

          <TextAreaField
            className="md:col-span-2"
            error={fieldErrors.descriptionEn?.[0]}
            id="merchant-description-en"
            label={copy.fields.descriptionEn}
            maxLength={1000}
            name="descriptionEn"
            onValueChange={(value) => updateField('descriptionEn', value)}
            rows={4}
            value={formValues.descriptionEn}
          />

          <TextField
            autoComplete="tel"
            error={fieldErrors.phone?.[0]}
            id="merchant-phone"
            inputMode="tel"
            label={copy.fields.phone}
            maxLength={32}
            name="phone"
            onValueChange={(value) => updateField('phone', value)}
            type="tel"
            value={formValues.phone}
          />

          <TextField
            autoComplete="url"
            error={fieldErrors.websiteUrl?.[0]}
            id="merchant-website-url"
            inputMode="url"
            label={copy.fields.websiteUrl}
            maxLength={2048}
            name="websiteUrl"
            onValueChange={(value) => updateField('websiteUrl', value)}
            type="url"
            value={formValues.websiteUrl}
          />

          <TextField
            autoComplete="street-address"
            error={fieldErrors.address?.[0]}
            id="merchant-address"
            label={copy.fields.address}
            maxLength={255}
            name="address"
            onValueChange={(value) => updateField('address', value)}
            value={formValues.address}
          />

          <TextField
            autoComplete="tel"
            error={fieldErrors.bizumPhone?.[0]}
            id="merchant-bizum-phone"
            inputMode="tel"
            label={copy.fields.bizumPhone}
            maxLength={32}
            name="bizumPhone"
            onValueChange={(value) => updateField('bizumPhone', value)}
            type="tel"
            value={formValues.bizumPhone}
          />

          <TextField
            autoComplete="off"
            error={fieldErrors.bankIban?.[0]}
            id="merchant-bank-iban"
            label={copy.fields.bankIban}
            maxLength={34}
            name="bankIban"
            onValueChange={(value) => updateField('bankIban', value)}
            spellCheck={false}
            value={formValues.bankIban}
          />

          <TextField
            autoComplete="off"
            error={fieldErrors.brandColor?.[0]}
            id="merchant-brand-color"
            label={copy.fields.brandColor}
            name="brandColor"
            onValueChange={(value) => updateField('brandColor', value)}
            type="color"
            spellCheck={false}
            value={formValues.brandColor}
          />
        </div>

        <button className={primaryButtonClassName} disabled={isPending} type="submit">
          {isPending ? copy.submitting : copy.submit}
        </button>
      </form>
    </section>
  );
}