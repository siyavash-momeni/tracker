// Documentation FR: Route API serveur de Tracker (validation, accès auth et logique métier).

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/prisma.client';
import { getStripeClient } from '@/lib/stripe';
import { setUserFreeBySubscriptionId, updateUserFromSubscription } from '@/lib/stripe-billing';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : null;

    const stripe = getStripeClient();
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        stripeCustomerId: true,
        stripeSubscriptionId: true,
      },
    });

    if (sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;

      if (user?.stripeCustomerId && customerId && user.stripeCustomerId !== customerId) {
        return NextResponse.json({ error: 'Session Stripe invalide pour cet utilisateur.' }, { status: 403 });
      }

      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await updateUserFromSubscription(subscription);
      }
    } else if (user?.stripeSubscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      if (subscription.status === 'canceled') {
        await setUserFreeBySubscriptionId(subscription.id);
      } else {
        await updateUserFromSubscription(subscription);
      }
    }

    const refreshed = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        subscriptionStatus: true,
        subscriptionInterval: true,
        subscriptionCurrentPeriodEnd: true,
        trialEndsAt: true,
        subscriptionCancelAtPeriodEnd: true,
      },
    });

    return NextResponse.json({ success: true, subscription: refreshed });
  } catch (error) {
    console.error('Erreur sync Stripe:', error);
    return NextResponse.json({ error: 'Erreur serveur sync Stripe' }, { status: 500 });
  }
}
