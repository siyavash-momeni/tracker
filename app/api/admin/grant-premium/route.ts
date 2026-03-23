import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/prisma.client';
import { NextResponse } from 'next/server';

const ADMIN_IDS = (process.env.ADMIN_IDS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    // Vérifier que l'utilisateur est admin
    if (!userId || !ADMIN_IDS.includes(userId)) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { clerkId, grant } = body;

    if (!clerkId || typeof clerkId !== 'string') {
      return NextResponse.json(
        { error: 'clerkId invalide' },
        { status: 400 }
      );
    }

    if (typeof grant !== 'boolean') {
      return NextResponse.json(
        { error: 'grant doit être un booléen' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { clerkId: true, email: true, premiumGranted: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    const updated = await prisma.user.update({
      where: { clerkId },
      data: { premiumGranted: grant },
      select: { clerkId: true, email: true, premiumGranted: true },
    });

    return NextResponse.json({
      success: true,
      user: updated,
      action: grant ? 'granted' : 'revoked',
    });
  } catch (error) {
    console.error('Erreur admin grant-premium:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
