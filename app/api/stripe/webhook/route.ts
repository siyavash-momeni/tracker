import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/prisma.client';
import { getStripeClient } from '@/lib/stripe';
import { setUserFreeBySubscriptionId, updateUserFromSubscription } from '@/lib/stripe-billing';

type StripeInvoiceWithSubscription = Stripe.Invoice & {
  subscription?: string | { id: string } | null;
};

export async function POST(request: Request) {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET manquant.' }, { status: 500 });
    }

    const signature = request.headers.get('stripe-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Signature Stripe manquante.' }, { status: 400 });
    }

    const rawBody = await request.text();
    const stripe = getStripeClient();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error) {
      console.error('Signature webhook Stripe invalide:', error);
      return NextResponse.json({ error: 'Signature invalide' }, { status: 400 });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        if (!subscriptionId) break;

        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await updateUserFromSubscription(subscription);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await updateUserFromSubscription(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await setUserFreeBySubscriptionId(subscription.id);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as StripeInvoiceWithSubscription;
        const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
        if (!subscriptionId) break;

        await prisma.user.updateMany({
          where: { stripeSubscriptionId: subscriptionId },
          data: { subscriptionStatus: 'PAST_DUE' },
        });
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Erreur webhook Stripe:', error);
    return NextResponse.json({ error: 'Erreur serveur webhook Stripe' }, { status: 500 });
  }
}
