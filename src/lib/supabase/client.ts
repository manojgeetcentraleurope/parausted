import 'client-only';

import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL. Set it before importing the browser Supabase client.',
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY. Set it before importing the browser Supabase client.',
  );
}

// Use this in client components and browser-only utilities. The instance is shared for the life of the module.
export const supabaseBrowserClient = createBrowserClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    isSingleton: true,
  },
);