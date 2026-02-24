import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/prisma.client';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { habitId, date, completed } = body;

    if (!habitId || !date) {
      return NextResponse.json(
        { error: 'Les paramètres habitId et date sont requis' },
        { status: 400 }
      );
    }

    // Vérifier que l'habit appartient à l'utilisateur
    const habit = await prisma.habit.findFirst({
      where: {
        id: habitId,
        userId,
      },
    });

    if (!habit) {
      return NextResponse.json(
        { error: 'Habitude non trouvée' },
        { status: 404 }
      );
    }

    const completedDate = new Date(`${date}T00:00:00Z`);

    if (completed) {
      // Créer une completion
      const completion = await prisma.habitCompletion.upsert({
        where: {
          habitId_completedDate: {
            habitId,
            completedDate,
          },
        },
        update: {},
        create: {
          habitId,
          completedDate,
        },
      });

      return NextResponse.json({
        success: true,
        completion,
      });
    } else {
      // Supprimer la completion
      await prisma.habitCompletion.delete({
        where: {
          habitId_completedDate: {
            habitId,
            completedDate,
          },
        },
      }).catch(() => {
        // Ignorer l'erreur si la completion n'existe pas
      });

      return NextResponse.json({
        success: true,
        message: 'Completion supprimée',
      });
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la completion:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
