// Documentation FR: Route API serveur de Tracker (validation, accès auth et logique métier).

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/prisma.client';
import { getAppBaseUrl, getStripeClient } from '@/lib/stripe';
import { isManagedSubscriptionStatus } from '@/lib/stripe-billing';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        stripeCustomerId: true,
        subscriptionStatus: true,
      },
    });

    if (!user?.stripeCustomerId || !isManagedSubscriptionStatus(user.subscriptionStatus)) {
      return NextResponse.json({ error: 'Aucun abonnement actif à gérer.' }, { status: 400 });
    }

    const stripe = getStripeClient();
    const baseUrl = getAppBaseUrl(request);

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${baseUrl}/settings?billing=portal_return`,
    });

    return NextResponse.json({ success: true, url: session.url });
  } catch (error) {
    console.error('Erreur portail Stripe:', error);
    return NextResponse.json({ error: 'Erreur serveur portail Stripe' }, { status: 500 });
  }
}
