// ============================================================
// Mint a partner API key for machine-to-machine voucher redemption.
//
// Usage (loads .env.local for Supabase credentials):
//   npm run partner:key -- <merchant-slug> "<label>"
//
// Example:
//   npm run partner:key -- seville-tours-co "Seville Tours backend"
//
// The raw token is printed ONCE. It is stored only as a SHA-256 hash, so it
// cannot be recovered later. If lost, revoke the row and mint a new key.
// ============================================================

import { createHash, randomBytes } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Run via "npm run partner:key" so .env.local is loaded.',
  );
  process.exit(1);
}

const slug = process.argv[2];
const label = process.argv[3];

if (!slug || !label) {
  console.error('Usage: npm run partner:key -- <merchant-slug> "<label>"');
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: merchant, error: merchantError } = await admin
  .from('merchants')
  .select('id, name')
  .eq('slug', slug)
  .eq('status', 'active')
  .maybeSingle();

if (merchantError || !merchant) {
  console.error(`Merchant not found for slug: ${slug}`);
  process.exit(1);
}

// High-entropy token: prefix + 32 random bytes (256 bits) hex-encoded.
const rawToken = `pu_partner_${randomBytes(32).toString('hex')}`;
const tokenHash = createHash('sha256').update(rawToken).digest('hex');
const tokenPrefix = rawToken.slice(0, 18); // non-secret identifier for logs

const { error: insertError } = await admin.from('partner_api_keys').insert({
  merchant_id: merchant.id,
  label,
  token_hash: tokenHash,
  token_prefix: tokenPrefix,
  scopes: ['voucher:read', 'voucher:redeem'],
});

if (insertError) {
  console.error('Failed to create partner API key:', insertError.message);
  process.exit(1);
}

console.log('');
console.log(`Partner API key created for: ${merchant.name}`);
console.log(`Label:  ${label}`);
console.log(`Prefix: ${tokenPrefix}`);
console.log('');
console.log('  TOKEN (shown once - store securely in the partner backend secret manager):');
console.log('');
console.log(`    ${rawToken}`);
console.log('');
console.log('This token is NOT recoverable. If lost, revoke the key and mint a new one.');
console.log('');
