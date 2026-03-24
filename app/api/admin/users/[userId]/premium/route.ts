// Documentation FR: Route API serveur de Tracker (validation, accès auth et logique métier).

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/prisma.client';
import { requireAdminAccess } from '@/lib/admin';
import { Prisma } from '@prisma/client';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Vérifie l'accès admin
    await requireAdminAccess();

    const { premiumGranted } = await request.json();

    if (typeof premiumGranted !== 'boolean') {
      return NextResponse.json(
        { error: 'premiumGranted doit être un booléen' },
        { status: 400 }
      );
    }

    const { userId: targetUserId } = await context.params;

    if (!targetUserId) {
      return NextResponse.json({ error: 'userId manquant' }, { status: 400 });
    }

    // Met à jour l'utilisateur
    const updatedUser = await prisma.user.update({
      where: { clerkId: targetUserId },
      data: { premiumGranted },
      select: {
        clerkId: true,
        email: true,
        premiumGranted: true,
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Accès admin requis' }, { status: 403 });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    console.error('[ADMIN][PREMIUM] Error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
