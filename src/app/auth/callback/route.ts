import { NextRequest, NextResponse } from 'next/server';

import { DEFAULT_LOCALE, getSafeInternalNextPath } from '@/lib/i18n/config';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get('code');
  const nextPath = getSafeInternalNextPath(
    request.nextUrl.searchParams.get('next') ?? '',
    `/${DEFAULT_LOCALE}/dashboard`,
  );

  if (code) {
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.exchangeCodeForSession(code);
    } catch {
      // Fall through to the safe redirect below.
    }
  }

  return NextResponse.redirect(new URL(nextPath, request.url));
}