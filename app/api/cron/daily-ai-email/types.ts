export type DailyEmailStats = {
  plannedHabits: number;
  completedHabits: number;
  totalCheckIns: number;
  goalsReached: number;
  completionRate: number;
  dispatchDateKey: string;
};

export type DailyEmailCopy = {
  subject: string;
  content: string;
  ctaLabel: string;
  ctaPath: '/today';
  source: 'ia' | 'fallback';
};
