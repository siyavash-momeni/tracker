import Stripe from 'stripe';

let stripeSingleton: Stripe | null = null;

export function getStripeClient() {
  if (stripeSingleton) return stripeSingleton;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY environment variable.');
  }

  stripeSingleton = new Stripe(secretKey, {
    apiVersion: '2026-02-25.clover',
    typescript: true,
  });

  return stripeSingleton;
}

export function getAppBaseUrl(request?: Request) {
  const configured = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured;

  if (request) {
    const url = new URL(request.url);
    return `${url.protocol}//${url.host}`;
  }

  return 'http://localhost:3000';
}

export type SubscriptionPlan = 'monthly' | 'yearly';

export function getPlanConfig(plan: SubscriptionPlan) {
  if (plan === 'monthly') {
    const priceId = process.env.STRIPE_PRICE_MONTHLY_ID;
    if (!priceId) throw new Error('Missing STRIPE_PRICE_MONTHLY_ID environment variable.');

    return {
      priceId,
      trialPeriodDays: 14,
      interval: 'MONTHLY' as const,
    };
  }

  const priceId = process.env.STRIPE_PRICE_YEARLY_ID;
  if (!priceId) throw new Error('Missing STRIPE_PRICE_YEARLY_ID environment variable.');

  return {
    priceId,
    trialPeriodDays: undefined,
    interval: 'YEARLY' as const,
  };
}
