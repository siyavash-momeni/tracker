// Documentation FR: Route API serveur de Tracker (validation, accès auth et logique métier).

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
