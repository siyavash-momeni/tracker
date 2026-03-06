import { prisma } from '@/prisma.client';
import { getIsoDayFromUtcDate } from './date-utils';
import { DailyEmailStats } from './types';

export async function buildDailyStatsForUser(params: {
  userId: string;
  dayStartUtc: Date;
  dayEndUtc: Date;
  dayKey: string;
}): Promise<DailyEmailStats> {
  const { userId, dayStartUtc, dayEndUtc, dayKey } = params;
  const isoDay = getIsoDayFromUtcDate(dayStartUtc);

  const activeHabits = await prisma.habit.findMany({
    where: {
      userId,
      activeDays: {
        has: isoDay,
      },
    },
    select: {
      id: true,
      targetValue: true,
    },
  });

  const completions = activeHabits.length
    ? await prisma.habitCompletion.findMany({
        where: {
          habitId: {
            in: activeHabits.map((habit) => habit.id),
          },
          completedDate: {
            gte: dayStartUtc,
            lt: dayEndUtc,
          },
        },
        select: {
          habitId: true,
          value: true,
        },
      })
    : [];

  const dayValueByHabit = new Map<string, number>();
  let totalCheckIns = 0;

  for (const completion of completions) {
    totalCheckIns += completion.value;
    dayValueByHabit.set(completion.habitId, (dayValueByHabit.get(completion.habitId) || 0) + completion.value);
  }

  let goalsReached = 0;
  let habitsWithProgress = 0;
  let totalTargetValue = 0;
  let totalProgressValue = 0;

  for (const habit of activeHabits) {
    const dayValue = dayValueByHabit.get(habit.id) || 0;

    if (dayValue > 0) {
      habitsWithProgress += 1;
    }

    totalTargetValue += Math.max(0, habit.targetValue);
    totalProgressValue += Math.min(Math.max(0, dayValue), Math.max(0, habit.targetValue));

    if (dayValue >= habit.targetValue) {
      goalsReached += 1;
    }
  }

  const completionRate =
    totalTargetValue > 0 ? Math.min(100, Math.round((totalProgressValue / totalTargetValue) * 100)) : 0;

  return {
    plannedHabits: activeHabits.length,
    completedHabits: habitsWithProgress,
    totalCheckIns,
    goalsReached,
    completionRate,
    dispatchDateKey: dayKey,
  };
}
