import { HabitForWeeklyTarget, WeeklyEmailStats } from './types';

export function getWeeklyTargetForHabit(habit: HabitForWeeklyTarget): number {
  if (habit.frequency === 'WEEKLY') {
    return Math.max(habit.targetValue, 0);
  }

  const activeDaysCount = habit.activeDays.length > 0 ? habit.activeDays.length : 7;
  return Math.max(habit.targetValue, 0) * activeDaysCount;
}

export function buildWeeklyStats(params: {
  habits: Array<HabitForWeeklyTarget & { id: string }>;
  weeklyCompletions: Array<{ habitId: string; value: number }>;
  bestStreak: number;
}): WeeklyEmailStats {
  const { habits, weeklyCompletions, bestStreak } = params;

  const weeklyCompletionByHabit = new Map<string, number>();
  let totalCheckIns = 0;

  for (const completion of weeklyCompletions) {
    totalCheckIns += completion.value;
    const previous = weeklyCompletionByHabit.get(completion.habitId) || 0;
    weeklyCompletionByHabit.set(completion.habitId, previous + completion.value);
  }

  let totalWeeklyTarget = 0;
  let goalsReached = 0;

  for (const habit of habits) {
    const weeklyTarget = getWeeklyTargetForHabit(habit);
    totalWeeklyTarget += weeklyTarget;

    const habitWeeklyValue = weeklyCompletionByHabit.get(habit.id) || 0;
    if (weeklyTarget > 0 && habitWeeklyValue >= weeklyTarget) {
      goalsReached += 1;
    }
  }

  const completionRate =
    totalWeeklyTarget > 0 ? Math.min(100, Math.round((totalCheckIns / totalWeeklyTarget) * 100)) : 0;

  return {
    totalHabits: habits.length,
    totalCheckIns,
    completionRate,
    goalsReached,
    bestStreak,
  };
}
