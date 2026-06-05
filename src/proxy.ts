import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  DEFAULT_LOCALE,
  getLocaleFromPathname,
  getSafeInternalNextPath,
  normalizeLocalizedPath,
} from '@/lib/i18n/config';
import type { Locale } from '@/lib/i18n/config';

function requireEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}. Set it before creating the proxy Supabase client.`);
  }

  return value;
}

function isDashboardRoute(locale: Locale, pathname: string): boolean {
  const dashboardPath = `/${locale}/dashboard`;
  return pathname === dashboardPath || pathname.startsWith(`${dashboardPath}/`);
}

function isAuthRoute(locale: Locale, pathname: string): boolean {
  return pathname === `/${locale}/login` || pathname === `/${locale}/signup`;
}

function buildNextParam(request: NextRequest, pathname: string): string {
  const raw = `${pathname}${request.nextUrl.search}`;
  return getSafeInternalNextPath(raw, `/${DEFAULT_LOCALE}/dashboard`);
}

function applySupabaseResponse(
  target: NextResponse,
  source: NextResponse,
  headers: Headers,
): NextResponse {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }

  headers.forEach((value, key) => {
    target.headers.set(key, value);
  });

  return target;
}

export async function proxy(request: NextRequest) {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const responseHeaders = new Headers();
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        headers: Record<string, string>,
      ) {
        for (const { name, value } of cookiesToSet) {
          if (value) {
            request.cookies.set(name, value);
          } else {
            request.cookies.delete(name);
          }
        }

        response = NextResponse.next({ request: { headers: request.headers } });

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }

        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
          responseHeaders.set(key, value);
        }
      },
    },
  });

  const pathname = normalizeLocalizedPath(request.nextUrl.pathname);

  if (pathname === '/') {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${DEFAULT_LOCALE}`;
    return NextResponse.redirect(redirectUrl);
  }

  const locale = getLocaleFromPathname(pathname);

  if (!locale) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${DEFAULT_LOCALE}${pathname}`;
    return NextResponse.redirect(redirectUrl);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isDashboardRoute(locale, pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = `/${locale}/login`;
    loginUrl.search = '';
    loginUrl.searchParams.set('next', buildNextParam(request, pathname));
    return applySupabaseResponse(NextResponse.redirect(loginUrl), response, responseHeaders);
  }

  if (user && isAuthRoute(locale, pathname)) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = `/${locale}/dashboard`;
    dashboardUrl.search = '';
    return applySupabaseResponse(NextResponse.redirect(dashboardUrl), response, responseHeaders);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|auth/callback|favicon\\.ico|.*\\.[^/]+$).*)',
  ],
};
