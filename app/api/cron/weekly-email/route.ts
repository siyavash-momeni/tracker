import { prisma } from '@/prisma.client';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { computeBestStreakFromDates, getCronSecretFromRequest, getWeekStartDateUtc } from './date-utils';
import { createResendClient, getResendRateLimitDelayMs, sendWeeklyEmail, sleep } from './email';
import { buildWeeklyStats } from './stats';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_WEEKLY_EMAIL_SECRET;
  const providedSecret = getCronSecretFromRequest(request);

  if (!cronSecret || providedSecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const currentWeekStartDate = getWeekStartDateUtc(now);
  const weekEndDate = new Date(currentWeekStartDate);
  const weekStartDate = new Date(currentWeekStartDate);
  weekStartDate.setUTCDate(weekStartDate.getUTCDate() - 7);
  const url = new URL(request.url);
  const testTo = url.searchParams.get('testTo');

  const resendRateLimitDelayMs = getResendRateLimitDelayMs();

  let resend;
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

        const bestStreak = computeBestStreakFromDates(allCompletions.map((completion) => completion.completedDate));

        const stats = buildWeeklyStats({
          habits,
          weeklyCompletions,
          bestStreak,
        });

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

      await sleep(resendRateLimitDelayMs);
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
