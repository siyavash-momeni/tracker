export function getWeekStartDateUtc(date: Date): Date {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const mondayOffset = (utcDate.getUTCDay() + 6) % 7;
  utcDate.setUTCDate(utcDate.getUTCDate() - mondayOffset);
  return utcDate;
}

export function getCronSecretFromRequest(request: Request): string | null {
  const headerSecret = request.headers.get('x-cron-secret');
  if (headerSecret) return headerSecret;

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  return authHeader.replace('Bearer ', '').trim();
}

function toUtcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayDiffFromKeys(previousDayKey: string, currentDayKey: string): number {
  const previous = new Date(`${previousDayKey}T00:00:00.000Z`).getTime();
  const current = new Date(`${currentDayKey}T00:00:00.000Z`).getTime();
  return Math.round((current - previous) / (24 * 60 * 60 * 1000));
}

export function computeBestStreakFromDates(dates: Date[]): number {
  if (dates.length === 0) return 0;

  const uniqueDayKeys = Array.from(new Set(dates.map(toUtcDayKey))).sort();
  let bestStreak = 1;
  let currentStreak = 1;

  for (let index = 1; index < uniqueDayKeys.length; index += 1) {
    const diff = dayDiffFromKeys(uniqueDayKeys[index - 1], uniqueDayKeys[index]);
    if (diff === 1) {
      currentStreak += 1;
      bestStreak = Math.max(bestStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  return bestStreak;
}
