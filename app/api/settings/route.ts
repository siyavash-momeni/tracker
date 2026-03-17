import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/prisma.client';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

function readBooleanEnv(value: string | undefined, fallback = false) {
  if (!value) return fallback;
  return value.toLowerCase() === 'true';
}

function buildEmailAlias(baseEmail: string, clerkId: string) {
  const [localPartRaw, domainRaw] = baseEmail.split('@');
  const localPart = localPartRaw || 'user';
  const domain = domainRaw || 'local.invalid';
  return `${localPart}+clerk-${clerkId.slice(0, 8)}@${domain}`;
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const clerkUser = await currentUser();
    const clerkPrimaryEmail =
      clerkUser?.primaryEmailAddress?.emailAddress ||
      clerkUser?.emailAddresses?.[0]?.emailAddress ||
      null;

    if (!clerkPrimaryEmail) {
      return NextResponse.json({ error: 'Email Clerk indisponible' }, { status: 409 });
    }

    const normalizedEmail = clerkPrimaryEmail.trim().toLowerCase();
    const userSelect = {
      email: true,
      weeklyEmailEnabled: true,
      dailyEmailEnabled: true,
      dailyPushEnabled: true,
      subscriptionStatus: true,
      subscriptionInterval: true,
      subscriptionCurrentPeriodEnd: true,
      trialEndsAt: true,
      subscriptionCancelAtPeriodEnd: true,
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
      return NextResponse.json({ error: 'Impossible de charger les paramètres utilisateur' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      settings: {
        email: user.email,
        weeklyEmailEnabled: user.weeklyEmailEnabled,
        dailyEmailEnabled: user.dailyEmailEnabled,
        dailyPushEnabled: user.dailyPushEnabled,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionInterval: user.subscriptionInterval,
        subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd,
        trialEndsAt: user.trialEndsAt,
        subscriptionCancelAtPeriodEnd: user.subscriptionCancelAtPeriodEnd,
        showEmailTestActions: readBooleanEnv(process.env.SHOW_EMAIL_TEST_ACTIONS, false),
      },
    });
  } catch (error) {
    console.error('Erreur settings GET:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await request.json();
    const payload: { weeklyEmailEnabled?: boolean; dailyEmailEnabled?: boolean; dailyPushEnabled?: boolean } = {};

    if (typeof body.weeklyEmailEnabled === 'boolean') {
      payload.weeklyEmailEnabled = body.weeklyEmailEnabled;
    }

    if (typeof body.dailyEmailEnabled === 'boolean') {
      payload.dailyEmailEnabled = body.dailyEmailEnabled;
    }

    if (typeof body.dailyPushEnabled === 'boolean') {
      payload.dailyPushEnabled = body.dailyPushEnabled;
    }

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({ error: 'Aucun changement valide' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { clerkId: userId },
      data: payload,
      select: {
        weeklyEmailEnabled: true,
        dailyEmailEnabled: true,
        dailyPushEnabled: true,
      },
    });

    return NextResponse.json({ success: true, settings: updated });
  } catch (error) {
    console.error('Erreur settings PATCH:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
