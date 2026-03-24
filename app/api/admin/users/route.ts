// Documentation FR: Route API serveur de Tracker (validation, accès auth et logique métier).

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/prisma.client';
import { requireAdminAccess } from '@/lib/admin';

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Vérifie l'accès admin
    await requireAdminAccess();

    // Récupère tous les utilisateurs avec leurs infos d'abonnement
    const users = await prisma.user.findMany({
      select: {
        id: true,
        clerkId: true,
        email: true,
        createdAt: true,
        subscriptionStatus: true,
        subscriptionInterval: true,
        subscriptionCurrentPeriodEnd: true,
        premiumGranted: true,
        trialEndsAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ users });
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Accès admin requis' }, { status: 403 });
    }

    console.error('[ADMIN][USERS] Error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
