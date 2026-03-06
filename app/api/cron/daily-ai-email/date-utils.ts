export function getCronSecretFromRequest(request: Request): string | null {
  const headerSecret = request.headers.get('x-cron-secret');
  if (headerSecret) return headerSecret;

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  return authHeader.replace('Bearer ', '').trim();
}

export function getYesterdayUtcRange(now = new Date()) {
  const todayUtcStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(todayUtcStart);
  start.setUTCDate(start.getUTCDate() - 1);

  const end = new Date(todayUtcStart);

  return {
    start,
    end,
    dayKey: start.toISOString().slice(0, 10),
  };
}

export function getIsoDayFromUtcDate(date: Date) {
  const jsDay = date.getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}
