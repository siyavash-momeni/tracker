import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/prisma.client';
import { NextResponse } from 'next/server';

function readBooleanEnv(value: string | undefined, fallback = false) {
  if (!value) return fallback;
  return value.toLowerCase() === 'true';
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const user = await prisma.user.upsert({
      where: { clerkId: userId },
      update: {},
      create: {
        clerkId: userId,
        email: `user-${userId}@temp.com`,
        dailyPushEnabled: false,
      },
      select: {
        email: true,
        weeklyEmailEnabled: true,
        dailyEmailEnabled: true,
        dailyPushEnabled: true,
      },
    });

    return NextResponse.json({
      success: true,
      settings: {
        email: user.email,
        weeklyEmailEnabled: user.weeklyEmailEnabled,
        dailyEmailEnabled: user.dailyEmailEnabled,
        dailyPushEnabled: user.dailyPushEnabled,
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
