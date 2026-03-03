export type WeeklyEmailStats = {
  totalCheckIns: number;
  completionRate: number;
  goalsReached: number;
  bestStreak: number;
  totalHabits: number;
};

export type HabitForWeeklyTarget = {
  targetValue: number;
  frequency: 'DAILY' | 'WEEKLY';
  activeDays: number[];
};
