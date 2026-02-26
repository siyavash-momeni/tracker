import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/prisma.client';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const dateParam = request.nextUrl.searchParams.get('date');
    if (!dateParam) {
      return NextResponse.json(
        { error: 'Le paramètre date est requis' },
        { status: 400 }
      );
    }

    const startOfDay = new Date(`${dateParam}T00:00:00Z`);
    const endOfDay = new Date(`${dateParam}T23:59:59Z`);

    const jsDay = startOfDay.getUTCDay();
    const isoDay = jsDay === 0 ? 7 : jsDay;

    const habits = await prisma.habit.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const activeHabits = habits.filter((habit) => habit.activeDays.includes(isoDay));

    const dayCompletions = await prisma.habitCompletion.findMany({
      where: {
        habitId: {
          in: activeHabits.map((habit) => habit.id),
        },
        completedDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: {
        habitId: true,
        value: true,
      },
    });

    const dayValueByHabitId = new Map(dayCompletions.map((item) => [item.habitId, item.value]));

    const startOfWeek = new Date(startOfDay);
    const dayOffset = isoDay - 1;
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - dayOffset);
    startOfWeek.setUTCHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setUTCDate(endOfWeek.getUTCDate() + 6);
    endOfWeek.setUTCHours(23, 59, 59, 999);

    const weeklyCompletions = await prisma.habitCompletion.findMany({
      where: {
        habitId: {
          in: activeHabits
            .filter((habit) => habit.frequency === 'WEEKLY')
            .map((habit) => habit.id),
        },
        completedDate: {
          gte: startOfWeek,
          lte: endOfWeek,
        },
      },
      select: {
        habitId: true,
        value: true,
      },
    });

    const weeklyProgressByHabitId = new Map<string, number>();
    for (const item of weeklyCompletions) {
      weeklyProgressByHabitId.set(item.habitId, (weeklyProgressByHabitId.get(item.habitId) || 0) + item.value);
    }

    const progressByHabit = activeHabits.map((habit) => {
      const dayValue = dayValueByHabitId.get(habit.id) || 0;
      const currentProgress =
        habit.frequency === 'DAILY'
          ? dayValue
          : (weeklyProgressByHabitId.get(habit.id) || 0);

      return {
        habitId: habit.id,
        valueForDate: dayValue,
        currentProgress,
        targetValue: habit.targetValue,
        frequency: habit.frequency,
        isCompleted: currentProgress >= habit.targetValue,
      };
    });

    const completedHabitIds = progressByHabit
      .filter((item) => item.isCompleted)
      .map((item) => item.habitId);

    return NextResponse.json({
      success: true,
      completedHabitIds,
      progressByHabit,
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des completions:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
