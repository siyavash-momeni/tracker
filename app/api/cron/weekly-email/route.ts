import { prisma } from '@/prisma.client';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

const RESEND_MAX_RETRIES = 4;
const RESEND_RATE_LIMIT_DELAY_MS = 600;

type WeeklyEmailStats = {
  totalCheckIns: number;
  completionRate: number;
  goalsReached: number;
  bestStreak: number;
  totalHabits: number;
};

function getWeekStartDateUtc(date: Date): Date {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const mondayOffset = (utcDate.getUTCDay() + 6) % 7;
  utcDate.setUTCDate(utcDate.getUTCDate() - mondayOffset);
  return utcDate;
}

function getCronSecretFromRequest(request: Request): string | null {
  const headerSecret = request.headers.get('x-cron-secret');
  if (headerSecret) return headerSecret;

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  return authHeader.replace('Bearer ', '').trim();
}

function createResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('Missing RESEND_API_KEY environment variable.');
  }

  return new Resend(apiKey);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isRateLimitError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes('too many requests') || normalized.includes('429') || normalized.includes('rate limit');
}

async function sendWithRetry(params: {
  resend: Resend;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<string | undefined> {
  const { resend, from, to, subject, text, html } = params;

  for (let attempt = 1; attempt <= RESEND_MAX_RETRIES; attempt += 1) {
    const { data, error } = await resend.emails.send({ from, to, subject, text, html });

    if (!error) {
      return data?.id;
    }

    const shouldRetry = isRateLimitError(error.message) && attempt < RESEND_MAX_RETRIES;
    if (!shouldRetry) {
      throw new Error(error.message);
    }

    const backoffMs = RESEND_RATE_LIMIT_DELAY_MS * attempt;
    await sleep(backoffMs);
  }

  return undefined;
}

function toUtcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dayDiffFromKeys(previousDayKey: string, currentDayKey: string): number {
  const previous = new Date(`${previousDayKey}T00:00:00.000Z`).getTime();
  const current = new Date(`${currentDayKey}T00:00:00.000Z`).getTime();
  return Math.round((current - previous) / (24 * 60 * 60 * 1000));
}

function computeBestStreakFromDates(dates: Date[]): number {
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

function getWeeklyTargetForHabit(habit: {
  targetValue: number;
  frequency: 'DAILY' | 'WEEKLY';
  activeDays: number[];
}): number {
  if (habit.frequency === 'WEEKLY') {
    return Math.max(habit.targetValue, 0);
  }

  const activeDaysCount = habit.activeDays.length > 0 ? habit.activeDays.length : 7;
  return Math.max(habit.targetValue, 0) * activeDaysCount;
}

function buildWeeklyEmailContent(stats: WeeklyEmailStats, weekStartDate: Date) {
  const { totalHabits, totalCheckIns, completionRate, goalsReached, bestStreak } = stats;
  const weekStartLabel = weekStartDate.toISOString().slice(0, 10);
  const subject =
    totalCheckIns > 0
      ? `🔥 Belle progression cette semaine ! Ton récap Kusari (${weekStartLabel})`
      : `🚀 Nouvelle semaine, nouveau départ — ton récap Kusari (${weekStartLabel})`;
  const ctaUrl = 'https://trackersiya.com';
  const encouragement =
    completionRate >= 70
      ? 'Tu avances bien, continue ce rythme simple et régulier 💪'
      : 'Un petit pas aujourd’hui vaut mieux que rien : tu peux relancer la machine dès maintenant 💪';

  const text = [
    `Ton récap hebdomadaire Kusari (semaine du ${weekStartLabel})`,
    '',
    'Tes stats :',
    `- Habitudes actives : ${totalHabits}`,
    `- Total check-ins de la semaine : ${totalCheckIns}`,
    `- % de complétion : ${completionRate}%`,
    `- Objectifs atteints : ${goalsReached}`,
    `- Meilleure streak : ${bestStreak} jour(s)`,
    '',
    encouragement,
    '',
    `Voir mon tracker : ${ctaUrl}`,
  ].join('\n');

  const html = `
      <div>
        <h2>Ton récap hebdomadaire Kusari</h2>
        <p>Semaine du <strong>${weekStartLabel}</strong></p>

        <h3>📊 Tes stats</h3>
        <ul>
          <li>Habitudes actives : <strong>${totalHabits}</strong></li>
          <li>Total check-ins de la semaine : <strong>${totalCheckIns}</strong></li>
          <li>% de complétion : <strong>${completionRate}%</strong></li>
          <li>Objectifs atteints : <strong>${goalsReached}</strong></li>
          <li>Meilleure streak : <strong>${bestStreak} jour(s)</strong></li>
        </ul>

        <p>${encouragement}</p>

        <p>
          <a href="${ctaUrl}" target="_blank" rel="noopener noreferrer">
            Ouvrir mon tracker sur trackersiya.com
          </a>
        </p>
      </div>
    `;

  return { subject, text, html };
}

async function sendWeeklyEmail(params: {
  resend: Resend;
  to: string;
  stats: WeeklyEmailStats;
  weekStartDate: Date;
}): Promise<string | undefined> {
  const emailFrom = process.env.EMAIL_FROM;
  if (!emailFrom) {
    throw new Error('Missing EMAIL_FROM environment variable.');
  }

  const { resend, to, stats, weekStartDate } = params;
  const { subject, text, html } = buildWeeklyEmailContent(stats, weekStartDate);

  return sendWithRetry({
    resend,
    from: emailFrom,
    to,
    subject,
    text,
    html,
  });
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_WEEKLY_EMAIL_SECRET;
  const providedSecret = getCronSecretFromRequest(request);

  if (!cronSecret || providedSecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const weekStartDate = getWeekStartDateUtc(now);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 7);
  const url = new URL(request.url);
  const testTo = url.searchParams.get('testTo');

  let resend: Resend;
  try {
    resend = createResendClient();
  } catch (error) {
    console.error('[CRON_WEEKLY_EMAIL][CRITICAL] Invalid Resend configuration', error);
    return NextResponse.json({ error: 'Invalid email configuration' }, { status: 500 });
  }

  if (testTo) {
    try {
      const messageId = await sendWeeklyEmail({
        resend,
        to: testTo,
        weekStartDate,
        stats: {
          totalHabits: 4,
          totalCheckIns: 12,
          completionRate: 75,
          goalsReached: 3,
          bestStreak: 5,
        },
      });

      return NextResponse.json({ ok: true, mode: 'test', sentTo: testTo, messageId });
    } catch (error) {
      console.error('[CRON_WEEKLY_EMAIL][CRITICAL] Test email send failed', { testTo, error });
      return NextResponse.json({ error: 'Test email send failed' }, { status: 500 });
    }
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        weeklyEmailEnabled: true,
        email: { not: '' },
      },
      select: {
        clerkId: true,
        email: true,
      },
    });

    let sent = 0;
    let skippedDuplicate = 0;
    let failed = 0;

    for (const user of users) {
      try {
        await prisma.emailDispatchLog.create({
          data: {
            userId: user.clerkId,
            weekStartDate,
            status: 'PROCESSING',
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          skippedDuplicate += 1;
          continue;
        }

        failed += 1;
        console.error('[CRON_WEEKLY_EMAIL][CRITICAL] Unable to lock dispatch log', {
          userId: user.clerkId,
          error,
        });
        continue;
      }

      try {
        const [habits, weeklyCompletions, allCompletions] = await Promise.all([
          prisma.habit.findMany({
            where: { userId: user.clerkId },
            select: {
              id: true,
              targetValue: true,
              frequency: true,
              activeDays: true,
            },
          }),
          prisma.habitCompletion.findMany({
            where: {
              habit: { userId: user.clerkId },
              completedDate: {
                gte: weekStartDate,
                lt: weekEndDate,
              },
            },
            select: {
              habitId: true,
              value: true,
            },
          }),
          prisma.habitCompletion.findMany({
            where: {
              habit: { userId: user.clerkId },
            },
            select: {
              completedDate: true,
            },
          }),
        ]);

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

        const bestStreak = computeBestStreakFromDates(allCompletions.map((completion) => completion.completedDate));

        const stats: WeeklyEmailStats = {
          totalHabits: habits.length,
          totalCheckIns,
          completionRate,
          goalsReached,
          bestStreak,
        };

        await sendWeeklyEmail({
          resend,
          to: user.email,
          stats,
          weekStartDate,
        });

        await prisma.emailDispatchLog.update({
          where: {
            userId_weekStartDate: {
              userId: user.clerkId,
              weekStartDate,
            },
          },
          data: {
            status: 'SENT',
            sentAt: new Date(),
          },
        });

        sent += 1;
      } catch (error) {
        failed += 1;
        console.error('[CRON_WEEKLY_EMAIL][CRITICAL] Weekly email send failed', {
          userId: user.clerkId,
          email: user.email,
          error,
        });

        await prisma.emailDispatchLog.update({
          where: {
            userId_weekStartDate: {
              userId: user.clerkId,
              weekStartDate,
            },
          },
          data: {
            status: 'FAILED',
          },
        });
      }

      await sleep(RESEND_RATE_LIMIT_DELAY_MS);
    }

    return NextResponse.json({
      ok: true,
      weekStartDate: weekStartDate.toISOString(),
      processedUsers: users.length,
      sent,
      skippedDuplicate,
      failed,
    });
  } catch (error) {
    console.error('[CRON_WEEKLY_EMAIL][CRITICAL] Cron execution crashed', error);
    return NextResponse.json({ error: 'Cron execution failed' }, { status: 500 });
  }
}
