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
    const { habitId, date, value } = body;

    if (!habitId || !date) {
      return NextResponse.json(
        { error: 'Les paramètres habitId et date sont requis' },
        { status: 400 }
      );
    }

    const normalizedValue = Number(value ?? 0);
    if (!Number.isInteger(normalizedValue) || normalizedValue < 0 || normalizedValue > 1000) {
      return NextResponse.json(
        { error: 'La valeur doit être un entier entre 0 et 1000' },
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

    const jsDay = completedDate.getUTCDay();
    const isoDay = jsDay === 0 ? 7 : jsDay;
    const isActiveDay = habit.activeDays.includes(isoDay);

    if (!isActiveDay) {
      return NextResponse.json(
        { error: 'Cette habitude n\'est pas active ce jour-là' },
        { status: 400 }
      );
    }

    if (normalizedValue > 0) {
      await prisma.habitCompletion.upsert({
        where: {
          habitId_completedDate: {
            habitId,
            completedDate,
          },
        },
        update: {
          value: normalizedValue,
        },
        create: {
          habitId,
          completedDate,
          value: normalizedValue,
        },
      });
    } else {
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
    }

    if (habit.frequency === 'DAILY') {
      return NextResponse.json({
        success: true,
        progress: {
          current: normalizedValue,
          target: habit.targetValue,
          frequency: habit.frequency,
          isCompleted: normalizedValue >= habit.targetValue,
        },
      });
    }

    const startOfWeek = new Date(completedDate);
    const dayOffset = isoDay - 1;
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - dayOffset);
    startOfWeek.setUTCHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setUTCDate(endOfWeek.getUTCDate() + 6);
    endOfWeek.setUTCHours(23, 59, 59, 999);

    const weekCompletions = await prisma.habitCompletion.findMany({
      where: {
        habitId,
        completedDate: {
          gte: startOfWeek,
          lte: endOfWeek,
        },
      },
      select: {
        value: true,
      },
    });

    const weekProgress = weekCompletions.reduce((sum, item) => sum + item.value, 0);

    return NextResponse.json({
      success: true,
      progress: {
        current: weekProgress,
        target: habit.targetValue,
        frequency: habit.frequency,
        isCompleted: weekProgress >= habit.targetValue,
      },
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la completion:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
