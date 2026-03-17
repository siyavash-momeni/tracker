import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/prisma.client';
import { getAppBaseUrl, getPlanConfig, getStripeClient, type SubscriptionPlan } from '@/lib/stripe';
import { Prisma } from '@prisma/client';
import { isManagedSubscriptionStatus } from '@/lib/stripe-billing';

function parsePlan(value: unknown): SubscriptionPlan | null {
  if (value === 'monthly' || value === 'yearly') return value;
  return null;
}

function buildEmailAlias(baseEmail: string, clerkId: string) {
  const [localPartRaw, domainRaw] = baseEmail.split('@');
  const localPart = localPartRaw || 'user';
  const domain = domainRaw || 'local.invalid';
  return `${localPart}+clerk-${clerkId.slice(0, 8)}@${domain}`;
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const plan = parsePlan(body?.plan);

    if (!plan) {
      return NextResponse.json({ error: 'Plan invalide. Utilisez monthly ou yearly.' }, { status: 400 });
    }

    const stripe = getStripeClient();
    const planConfig = getPlanConfig(plan);

    const clerkUser = await currentUser();
    const clerkPrimaryEmail =
      clerkUser?.primaryEmailAddress?.emailAddress ||
      clerkUser?.emailAddresses?.[0]?.emailAddress ||
      null;

    const existingUser = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        clerkId: true,
        email: true,
        stripeCustomerId: true,
      },
    });

    const normalizedEmail = (clerkPrimaryEmail || existingUser?.email || '').trim().toLowerCase();

    if (!normalizedEmail) {
      return NextResponse.json({ error: 'Email utilisateur introuvable.' }, { status: 409 });
    }

    const userSelect = {
      clerkId: true,
      email: true,
      stripeCustomerId: true,
    } as const;

    const existingByClerk = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: userSelect,
    });

    let user = existingByClerk;

    if (existingByClerk) {
      if (existingByClerk.email !== normalizedEmail) {
        const emailOwner = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: { clerkId: true },
        });

        if (!emailOwner || emailOwner.clerkId === userId) {
          user = await prisma.user.update({
            where: { clerkId: userId },
            data: { email: normalizedEmail },
            select: userSelect,
          });
        }
      }
    } else {
      try {
        user = await prisma.user.create({
          data: {
            clerkId: userId,
            email: normalizedEmail,
            dailyPushEnabled: false,
          },
          select: userSelect,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          user = await prisma.user.create({
            data: {
              clerkId: userId,
              email: buildEmailAlias(normalizedEmail, userId),
              dailyPushEnabled: false,
            },
            select: userSelect,
          });
        } else {
          throw error;
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Impossible de charger le compte utilisateur.' }, { status: 500 });
    }

    const managedSubscription = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        subscriptionStatus: true,
        stripeSubscriptionId: true,
      },
    });

    if (
      managedSubscription?.stripeSubscriptionId &&
      isManagedSubscriptionStatus(managedSubscription.subscriptionStatus)
    ) {
      return NextResponse.json(
        {
          error: 'Vous avez déjà un abonnement actif ou en cours. Utilisez la gestion d’abonnement pour le modifier.',
          code: 'SUBSCRIPTION_ALREADY_EXISTS',
        },
        { status: 409 }
      );
    }

    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          clerkId: user.clerkId,
        },
      });
      customerId = customer.id;

      await prisma.user.update({
        where: { clerkId: userId },
        data: { stripeCustomerId: customer.id },
      });
    }

    const baseUrl = getAppBaseUrl(request);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{
        price: planConfig.priceId,
        quantity: 1,
      }],
      success_url: `${baseUrl}/settings?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/settings?billing=canceled`,
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: planConfig.trialPeriodDays,
        metadata: {
          clerkId: userId,
          plan,
        },
      },
      metadata: {
        clerkId: userId,
        plan,
      },
    });

    return NextResponse.json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error('Erreur checkout Stripe:', error);
    return NextResponse.json({ error: 'Erreur serveur Stripe checkout' }, { status: 500 });
  }
}
