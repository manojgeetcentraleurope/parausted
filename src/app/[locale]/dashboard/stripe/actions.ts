'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getStripeClient } from '@/lib/stripe/server';
import {
  DEFAULT_LOCALE,
  getLocalizedPath,
  isSupportedLocale,
  type Locale,
} from '@/lib/i18n/config';

export type CreateStripeConnectOnboardingLinkResult =
  | { success: true; url: string }
  | { success: false; error: string };

export async function createStripeConnectOnboardingLink(
  locale: Locale,
): Promise<CreateStripeConnectOnboardingLinkResult> {
  const resolvedLocale = isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const dashboardPath = getLocalizedPath('/dashboard', resolvedLocale);
  const refreshUrl = `${baseUrl}${dashboardPath}`;
  const returnUrl = `${baseUrl}${dashboardPath}`;

  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'unauthorized' };
    }

    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id, stripe_account_id')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (merchantError || !merchant) {
      return { success: false, error: 'no_merchant' };
    }

    const stripe = getStripeClient();

    let stripeAccountId = merchant.stripe_account_id as string | null;

    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'ES',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          merchant_id: merchant.id,
        },
      });

      stripeAccountId = account.id;

      const { error: updateError } = await supabase
        .from('merchants')
        .update({ stripe_account_id: stripeAccountId })
        .eq('id', merchant.id)
        .eq('auth_user_id', user.id);

      if (updateError) {
        console.error('[stripe] Failed to save stripe_account_id', {
          message: updateError.message,
        });
        return { success: false, error: 'generic' };
      }
    }

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      type: 'account_onboarding',
      refresh_url: refreshUrl,
      return_url: returnUrl,
    });

    return { success: true, url: accountLink.url };
  } catch (err) {
    console.error('[stripe] createStripeConnectOnboardingLink error', {
      error: err instanceof Error ? err.message : 'unknown',
    });
    return { success: false, error: 'generic' };
  }
}

export type RefreshStripeConnectStatusResult =
  | {
      success: true;
      stripeOnboarded: boolean;
      chargesEnabled: boolean;
      detailsSubmitted: boolean;
    }
  | { success: false; error: string };

export async function refreshStripeConnectStatus(): Promise<RefreshStripeConnectStatusResult> {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'unauthorized' };
    }

    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id, stripe_account_id, stripe_onboarded')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (merchantError || !merchant) {
      return { success: false, error: 'no_merchant' };
    }

    const stripeAccountId = merchant.stripe_account_id as string | null;

    if (!stripeAccountId) {
      return { success: false, error: 'not_connected' };
    }

    const stripe = getStripeClient();

    const account = await stripe.accounts.retrieve(stripeAccountId);

    const chargesEnabled = account.charges_enabled === true;
    const detailsSubmitted = account.details_submitted === true;
    const stripeOnboarded = chargesEnabled && detailsSubmitted;

    const { error: updateError } = await supabase
      .from('merchants')
      .update({ stripe_onboarded: stripeOnboarded })
      .eq('id', merchant.id)
      .eq('auth_user_id', user.id);

    if (updateError) {
      console.error('[stripe] Failed to update stripe_onboarded', {
        message: updateError.message,
      });
      return { success: false, error: 'generic' };
    }

    return { success: true, stripeOnboarded, chargesEnabled, detailsSubmitted };
  } catch (err) {
    console.error('[stripe] refreshStripeConnectStatus error', {
      error: err instanceof Error ? err.message : 'unknown',
    });
    return { success: false, error: 'generic' };
  }
}
