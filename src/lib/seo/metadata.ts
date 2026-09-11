import { DEFAULT_LOCALE, SUPPORTED_LOCALES, getLocalizedPath } from '../i18n/config';
import type { Locale } from '../i18n/config';
import { getMessages } from '../i18n/messages';
import { resolveAppUrl } from '../utils/app-url';

export function getBaseUrl(): URL {
  const raw = resolveAppUrl();
  return new URL(raw);
}

export function getCanonicalUrl(path: string, locale: Locale): string {
  const base = getBaseUrl();
  return new URL(getLocalizedPath(path, locale), base).toString();
}

export function getAlternateLanguageUrls(path: string): Record<string, string> {
  const base = getBaseUrl();
  const result: Record<string, string> = {};

  for (const locale of SUPPORTED_LOCALES) {
    result[locale] = new URL(getLocalizedPath(path, locale), base).toString();
  }

  result['x-default'] = new URL(getLocalizedPath(path, DEFAULT_LOCALE), base).toString();

  return result;
}

export function getDefaultSeoTitle(locale: Locale): string {
  return getMessages(locale).seo.defaultTitle;
}

export function getDefaultSeoDescription(locale: Locale): string {
  return getMessages(locale).seo.defaultDescription;
}
