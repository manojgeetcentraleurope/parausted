import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SERVICE_NAME = 'parausted';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
} as const;

async function isDatabaseReachable(): Promise<boolean> {
  try {
    const supabase = await createSupabaseServerClient();

    // Minimal connectivity probe: HEAD/count query returns no row data.
    // An RLS-empty result still confirms the database responded.
    const { error } = await supabase
      .from('merchants')
      .select('id', { count: 'exact', head: true });

    return !error;
  } catch {
    return false;
  }
}

export async function GET(): Promise<NextResponse> {
  const databaseHealthy = await isDatabaseReachable();
  const timestamp = new Date().toISOString();

  if (!databaseHealthy) {
    return NextResponse.json(
      {
        status: 'degraded',
        service: SERVICE_NAME,
        timestamp,
        checks: { database: 'error' },
      },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  return NextResponse.json(
    {
      status: 'ok',
      service: SERVICE_NAME,
      timestamp,
      checks: { database: 'ok' },
    },
    { status: 200, headers: NO_STORE_HEADERS },
  );
}
