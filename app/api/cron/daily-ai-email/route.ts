import { prisma } from '@/prisma.client';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getCronSecretFromRequest, getYesterdayUtcRange } from './date-utils';
import { createResendClient, getResendRateLimitDelayMs, sendDailyAiEmail, sleep } from './email';
import { buildDailyStatsForUser } from './stats';
import { generateDailyEmailCopy } from './ai';

export const dynamic = 'force-dynamic';

const PRISMA_RETRY_ATTEMPTS = 3;
const PRISMA_RETRY_DELAY_MS = 350;

function isTransientPrismaConnectionError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P1017';
  }

  return false;
}

async function withPrismaRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= PRISMA_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isTransientPrismaConnectionError(error) || attempt === PRISMA_RETRY_ATTEMPTS) {
        throw error;
      }

      await sleep(PRISMA_RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError;
}

export async function GET(request: Request) {
  const allowedCronSecrets = [
    process.env.CRON_SECRET,
    process.env.CRON_DAILY_AI_EMAIL_SECRET,
    process.env.CRON_WEEKLY_EMAIL_SECRET,
  ].filter(Boolean) as string[];
  const providedSecret = getCronSecretFromRequest(request);

  if (!providedSecret || !allowedCronSecrets.includes(providedSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { start: dayStartUtc, end: dayEndUtc, dayKey } = getYesterdayUtcRange(new Date());
  const dispatchDate = new Date(dayStartUtc);
  const url = new URL(request.url);
  const testTo = url.searchParams.get('testTo');

  let resend;
  try {
    resend = createResendClient();
  } catch (error) {
    console.error('[CRON_DAILY_AI_EMAIL][CRITICAL] Invalid email configuration', error);
    return NextResponse.json({ error: 'Invalid email configuration' }, { status: 500 });
  }

  if (testTo) {
    try {
      const testUser = await withPrismaRetry(() =>
        prisma.user.findUnique({
          where: { email: testTo },
          select: { clerkId: true, email: true },
        })
      );

      if (!testUser) {
        return NextResponse.json({ error: 'Utilisateur test introuvable' }, { status: 404 });
      }

      const stats = await withPrismaRetry(() =>
        buildDailyStatsForUser({
          userId: testUser.clerkId,
          dayStartUtc,
          dayEndUtc,
          dayKey,
        })
      );

      const copy = await generateDailyEmailCopy(stats);

      const messageId = await sendDailyAiEmail({
        resend,
        to: testUser.email,
        copy,
      });

      return NextResponse.json({ ok: true, mode: 'test', sentTo: testUser.email, dayKey, stats, messageId });
    } catch (error) {
      console.error('[CRON_DAILY_AI_EMAIL][CRITICAL] Test email send failed', { testTo, error });
      return NextResponse.json({ error: 'Test email send failed' }, { status: 500 });
    }
  }

  try {
    const users = await withPrismaRetry(() =>
      prisma.user.findMany({
        where: {
          dailyEmailEnabled: true,
          email: { not: '' },
        },
        select: {
          clerkId: true,
          email: true,
        },
      })
    );

    let sent = 0;
    let skippedDuplicate = 0;
    let failed = 0;

    for (const user of users) {
      try {
        await withPrismaRetry(() =>
          prisma.dailyEmailDispatchLog.create({
            data: {
              userId: user.clerkId,
              dispatchDate,
              status: 'PROCESSING',
            },
          })
        );
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          skippedDuplicate += 1;
          continue;
        }

        failed += 1;
        console.error('[CRON_DAILY_AI_EMAIL] Unable to create dispatch lock', {
          userId: user.clerkId,
          error,
        });
        continue;
      }

      try {
        const stats = await withPrismaRetry(() =>
          buildDailyStatsForUser({
            userId: user.clerkId,
            dayStartUtc,
            dayEndUtc,
            dayKey,
          })
        );

        const copy = await generateDailyEmailCopy(stats);

        await sendDailyAiEmail({
          resend,
          to: user.email,
          copy,
        });

        await withPrismaRetry(() =>
          prisma.dailyEmailDispatchLog.update({
            where: {
              userId_dispatchDate: {
                userId: user.clerkId,
                dispatchDate,
              },
            },
            data: {
              status: 'SENT',
              sentAt: new Date(),
            },
          })
        );

        sent += 1;
      } catch (error) {
        failed += 1;

        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
        console.error('[CRON_DAILY_AI_EMAIL] Daily AI email send failed', {
          userId: user.clerkId,
          email: user.email,
          error: errorMessage,
        });

        await withPrismaRetry(() =>
          prisma.dailyEmailDispatchLog.update({
            where: {
              userId_dispatchDate: {
                userId: user.clerkId,
                dispatchDate,
              },
            },
            data: {
              status: 'FAILED',
              errorMessage: errorMessage.slice(0, 500),
            },
          })
        ).catch((updateError) => {
          console.error('[CRON_DAILY_AI_EMAIL] Unable to update dispatch status', {
            userId: user.clerkId,
            error: updateError,
          });
        });
      }

      await sleep(getResendRateLimitDelayMs());
    }

    return NextResponse.json({
      ok: true,
      dayKey,
      processedUsers: users.length,
      sent,
      skippedDuplicate,
      failed,
    });
  } catch (error) {
    console.error('[CRON_DAILY_AI_EMAIL][CRITICAL] Cron execution crashed', error);
    return NextResponse.json({ error: 'Cron execution failed' }, { status: 500 });
  }
}
