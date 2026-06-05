import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const DASHBOARD_PATH = '/dashboard';
const LOGIN_PATH = '/login';
const AUTH_PATHS = new Set([LOGIN_PATH, '/signup']);

function requireEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}. Set it before creating the middleware Supabase client.`);
  }

  return value;
}

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

function isDashboardRoute(pathname: string): boolean {
  return pathname === DASHBOARD_PATH || pathname.startsWith(`${DASHBOARD_PATH}/`);
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_PATHS.has(pathname);
}

function getSafeNextPath(request: NextRequest): string {
  const pathname = normalizePathname(request.nextUrl.pathname);

  if (!pathname.startsWith('/') || pathname.startsWith('//')) {
    return DASHBOARD_PATH;
  }

  return `${pathname}${request.nextUrl.search}`;
}

function applySupabaseResponse(target: NextResponse, source: NextResponse, headers: Headers): NextResponse {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }

  headers.forEach((value, key) => {
    target.headers.set(key, value);
  });

  return target;
}

function redirectToLogin(request: NextRequest, response: NextResponse, headers: Headers): NextResponse {
  const loginUrl = request.nextUrl.clone();

  loginUrl.pathname = LOGIN_PATH;
  loginUrl.search = '';
  loginUrl.searchParams.set('next', getSafeNextPath(request));

  return applySupabaseResponse(NextResponse.redirect(loginUrl), response, headers);
}

function redirectToDashboard(request: NextRequest, response: NextResponse, headers: Headers): NextResponse {
  const dashboardUrl = request.nextUrl.clone();

  dashboardUrl.pathname = DASHBOARD_PATH;
  dashboardUrl.search = '';

  return applySupabaseResponse(NextResponse.redirect(dashboardUrl), response, headers);
}

export async function middleware(request: NextRequest) {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const responseHeaders = new Headers();
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll().map(({ name, value }) => ({
          name,
          value,
        }));
      },
      setAll(
        cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        headers: Record<string, string>,
      ) {
        for (const { name, value } of cookiesToSet) {
          if (value) {
            request.cookies.set(name, value);
            continue;
          }

          request.cookies.delete(name);
        }

        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });

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

  const pathname = normalizePathname(request.nextUrl.pathname);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isDashboardRoute(pathname)) {
    return redirectToLogin(request, response, responseHeaders);
  }

  if (user && isAuthRoute(pathname)) {
    return redirectToDashboard(request, response, responseHeaders);
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.[^/]+$).*)'],
};