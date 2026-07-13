export const DEFAULT_LOCAL_APP_URL = 'http://localhost:3001';

export function resolveAppUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    return window.location.origin.replace(/\/$/, '');
  }

  return DEFAULT_LOCAL_APP_URL;
}