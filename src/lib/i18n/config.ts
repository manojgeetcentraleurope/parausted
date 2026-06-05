export const SUPPORTED_LOCALES = ['es', 'en'] as const;
export const DEFAULT_LOCALE = 'es' as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function getLocaleFromPathname(pathname: string): Locale | null {
  const segment = pathname.split('/')[1] ?? '';
  return isSupportedLocale(segment) ? segment : null;
}

export function stripLocaleFromPathname(pathname: string): string {
  const locale = getLocaleFromPathname(pathname);
  if (!locale) return pathname;
  const stripped = pathname.slice(`/${locale}`.length);
  return stripped === '' ? '/' : stripped;
}

export function withLocale(path: string, locale: Locale): string {
  const normalized = path === '/' ? '' : path;
  return `/${locale}${normalized}`;
}

export function getLocalizedPath(path: string, locale: Locale): string {
  return withLocale(path, locale);
}

export function normalizeLocalizedPath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function getSeoLocale(locale: Locale): string {
  const seoLocaleMap: Record<Locale, string> = {
    es: 'es_ES',
    en: 'en_US',
  };
  return seoLocaleMap[locale];
}

export function getSafeInternalNextPath(path: string, fallback: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) {
    return fallback;
  }
  return path;
}
