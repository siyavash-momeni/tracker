import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/prisma.client';
import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'ID d\'habitude manquant' },
        { status: 400 }
      );
    }

    // Vérifier que l'habit appartient à l'utilisateur
    const habit = await prisma.habit.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!habit) {
      return NextResponse.json(
        { error: 'Habitude non trouvée' },
        { status: 404 }
      );
    }

    // Supprimer l'habitude (les completions seront supprimées en cascade)
    await prisma.habit.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Habitude supprimée',
    });
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'habitude:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}