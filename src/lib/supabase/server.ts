import 'server-only';

import { cookies } from 'next/headers';

import { createServerClient } from '@supabase/ssr';

type NextCookieStore = Awaited<ReturnType<typeof cookies>>;
type CookieSetOptions = Parameters<NextCookieStore['set']>[2];

type SupabaseCookieToSet = {
  name: string;
  value: string;
  options?: CookieSetOptions;
};

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Missing ${name}. Set it before creating the server Supabase client.`,
    );
  }

  return value;
}

/**
 * Creates a fresh Supabase client for the current server request.
 * Use this in Server Components, Route Handlers, and Server Actions when auth session cookies must stay in sync.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabasePublishableKey = requireEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map(({ name, value }) => ({
          name,
          value,
        }));
      },
      setAll(cookiesToSet: SupabaseCookieToSet[]) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            if (value) {
              cookieStore.set(name, value, options);
              continue;
            }

            cookieStore.delete(name);
          }
        } catch {
          // Cookie writes can fail in Server Components.
          // Middleware / Route Handlers / Server Actions should refresh sessions when needed.
        }
      },
    },
  });
}
