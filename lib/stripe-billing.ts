import Stripe from 'stripe';
import { prisma } from '@/prisma.client';

type StripeSubscriptionWithDates = Stripe.Subscription & {
  current_period_end?: number | null;
  trial_end?: number | null;
};

export const STRIPE_STATUS_MAP: Record<string, 'FREE' | 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE' | 'INCOMPLETE_EXPIRED' | 'UNPAID'> = {
  trialing: 'TRIALING',
  active: 'ACTIVE',
  past_due: 'PAST_DUE',
  canceled: 'CANCELED',
  incomplete: 'INCOMPLETE',
  incomplete_expired: 'INCOMPLETE_EXPIRED',
  unpaid: 'UNPAID',
};

export type AppSubscriptionInterval = 'NONE' | 'MONTHLY' | 'YEARLY';

export function toDate(timestamp?: number | null) {
  if (!timestamp) return null;
  return new Date(timestamp * 1000);
}

export function mapInterval(subscription: Stripe.Subscription): AppSubscriptionInterval {
  const interval = subscription.items.data[0]?.price?.recurring?.interval;
  if (interval === 'month') return 'MONTHLY';
  if (interval === 'year') return 'YEARLY';
  return 'NONE';
}

export async function updateUserFromSubscription(subscription: Stripe.Subscription) {
  const subscriptionWithDates = subscription as StripeSubscriptionWithDates;
  const stripeCustomerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;

  const clerkIdFromMetadata = subscription.metadata?.clerkId || null;

  const where = clerkIdFromMetadata
    ? { clerkId: clerkIdFromMetadata }
    : { stripeCustomerId };

  const user = await prisma.user.findFirst({
    where,
    select: { clerkId: true },
  });

  if (!user) return null;

  const status = STRIPE_STATUS_MAP[subscription.status] || 'FREE';

  return prisma.user.update({
    where: { clerkId: user.clerkId },
    data: {
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: status,
      subscriptionInterval: mapInterval(subscription),
      subscriptionCurrentPeriodEnd: toDate(subscriptionWithDates.current_period_end),
      trialEndsAt: toDate(subscriptionWithDates.trial_end),
      subscriptionCancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    },
  });
}

export async function setUserFreeBySubscriptionId(subscriptionId: string) {
  return prisma.user.updateMany({
    where: { stripeSubscriptionId: subscriptionId },
    data: {
      subscriptionStatus: 'FREE',
      subscriptionInterval: 'NONE',
      subscriptionCurrentPeriodEnd: null,
      trialEndsAt: null,
      subscriptionCancelAtPeriodEnd: false,
      stripeSubscriptionId: null,
    },
  });
}

export function isManagedSubscriptionStatus(
  status: 'FREE' | 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE' | 'INCOMPLETE_EXPIRED' | 'UNPAID'
) {
  return ['TRIALING', 'ACTIVE', 'PAST_DUE', 'INCOMPLETE', 'UNPAID'].includes(status);
}
