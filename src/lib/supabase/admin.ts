/**
 * WARNING: Server-only Supabase admin client. This bypasses Row Level Security and must never be imported into client-side code or components.
 */
import 'server-only';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL. Set it before creating the admin Supabase client.',
  );
}

if (!supabaseServiceRoleKey) {
  throw new Error(
    'Missing SUPABASE_SERVICE_ROLE_KEY. Set it before creating the admin Supabase client.',
  );
}

// Use this only in trusted server-side code such as API routes, server actions, or Edge Functions.
export const supabaseAdminClient = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  },
);