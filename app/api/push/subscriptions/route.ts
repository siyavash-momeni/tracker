import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/prisma.client';
import { NextResponse } from 'next/server';

type SubscriptionPayload = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

function toExpirationDate(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    return null;
  }

  return new Date(value);
}

function isValidSubscriptionPayload(payload: SubscriptionPayload) {
  return Boolean(payload.endpoint && payload.keys?.p256dh && payload.keys?.auth);
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
      select: {
        endpoint: true,
        createdAt: true,
        updatedAt: true,
        expirationTime: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, subscriptions });
  } catch (error) {
    console.error('Erreur push subscriptions GET:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = (await request.json()) as SubscriptionPayload;
    if (!isValidSubscriptionPayload(body)) {
      return NextResponse.json({ error: 'Payload de subscription invalide' }, { status: 400 });
    }

    const userAgent = request.headers.get('user-agent')?.slice(0, 500) || null;

    const upsertedSubscription = await prisma.pushSubscription.upsert({
      where: { endpoint: body.endpoint! },
      create: {
        userId,
        endpoint: body.endpoint!,
        p256dh: body.keys!.p256dh!,
        auth: body.keys!.auth!,
        expirationTime: toExpirationDate(body.expirationTime),
        userAgent,
      },
      update: {
        userId,
        p256dh: body.keys!.p256dh!,
        auth: body.keys!.auth!,
        expirationTime: toExpirationDate(body.expirationTime),
        userAgent,
        failureReason: null,
      },
    });

    if (userAgent) {
      await prisma.pushSubscription.deleteMany({
        where: {
          userId,
          userAgent,
          endpoint: {
            not: body.endpoint!,
          },
        },
      });
    }

    await prisma.pushSubscription.deleteMany({
      where: {
        userId,
        id: {
          not: upsertedSubscription.id,
        },
        p256dh: body.keys!.p256dh!,
        auth: body.keys!.auth!,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur push subscriptions POST:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = (await request.json()) as { endpoint?: string };
    if (!body.endpoint) {
      return NextResponse.json({ error: 'Endpoint requis' }, { status: 400 });
    }

    await prisma.pushSubscription.deleteMany({
      where: {
        userId,
        endpoint: body.endpoint,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur push subscriptions DELETE:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
