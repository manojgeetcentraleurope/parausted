// Revoke a partner API key by its non-secret prefix.
//
// Usage:
//   npm run partner:revoke -- <token-prefix>
//
// Example:
//   npm run partner:revoke -- pu_partner_a891f8b

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Run via "npm run partner:revoke" so .env.local is loaded.',
  );
  process.exit(1);
}

const admin = createClient(
  supabaseUrl,
  serviceRoleKey,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const prefix = process.argv[2];

if (!prefix) {
  console.error('Usage: npm run partner:revoke -- <token-prefix>');
  process.exit(1);
}

const { data, error } = await admin
  .from('partner_api_keys')
  .update({ status: 'revoked', revoked_at: new Date().toISOString() })
  .eq('token_prefix', prefix)
  .eq('status', 'active')
  .select('id, merchant_id, label, token_prefix');

if (error) {
  console.error('Failed to revoke:', error.message);
  process.exit(1);
}

if (!data || data.length === 0) {
  console.log(`No active key found with prefix: ${prefix}`);
  process.exit(0);
}

console.log(`Revoked ${data.length} key(s):`);
for (const row of data) {
  console.log(`  - ${row.label} (${row.token_prefix})`);
}
