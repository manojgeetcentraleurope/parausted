import 'server-only';

import Stripe from 'stripe';

export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY. Set it before using the Stripe client.');
  }

  return new Stripe(secretKey, {
    apiVersion: '2026-05-27.dahlia',
  });
}
