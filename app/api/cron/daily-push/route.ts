import { prisma } from '@/prisma.client';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { generateDailyEmailCopy } from '../daily-ai-email/ai';
import { getCronSecretFromRequest, getYesterdayUtcRange } from '../daily-ai-email/date-utils';
import { buildDailyStatsForUser } from '../daily-ai-email/stats';

export const dynamic = 'force-dynamic';

const PRISMA_RETRY_ATTEMPTS = 3;
const PRISMA_RETRY_DELAY_MS = 350;
const WEB_PUSH_DELAY_MS = 80;

type DbSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  expirationTime: Date | null;
};

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function splitSentences(content: string) {
  return normalizeWhitespace(content)
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildPushTitle(subject: string) {
  const normalized = normalizeWhitespace(subject);
  if (!normalized) return 'Continue ta progression 💪';
  if (normalized.length <= 55) return normalized;
  return `${normalized.slice(0, 54).trim()}…`;
}

function buildPushBody(content: string) {
  const sentences = splitSentences(content);
  const factual = sentences[0] || 'Hier, une étape de plus a été posée.';
  const encouragement = sentences.length > 1 ? sentences[sentences.length - 1] : 'Aujourd’hui, un petit pas suffit.';
  const body = normalizeWhitespace(`${factual} ${encouragement}`);
  if (body.length <= 220) return body;
  return `${body.slice(0, 219).trim()}…`;
}

function buildPushPayload(copy: { subject: string; content: string; ctaPath: '/today'; source: 'ia' | 'fallback' }) {
  return {
    title: buildPushTitle(copy.subject),
    body: buildPushBody(copy.content),
    url: 'https://trackesiya.com',
    source: copy.source,
  };
}

function isInvalidSubscriptionError(error: unknown) {
  const statusCode = (error as { statusCode?: number })?.statusCode;
  return statusCode === 404 || statusCode === 410;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Erreur inconnue';
}

function mapSubscriptionForWebPush(subscription: DbSubscription) {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };
}

async function sendPushForUser(params: {
  userId: string;
  subscriptions: DbSubscription[];
  dayStartUtc: Date;
  dayEndUtc: Date;
  dayKey: string;
}) {
  const { userId, subscriptions, dayStartUtc, dayEndUtc, dayKey } = params;

  const stats = await withPrismaRetry(() =>
    buildDailyStatsForUser({
      userId,
      dayStartUtc,
      dayEndUtc,
      dayKey,
    })
  );

  const copy = await generateDailyEmailCopy(stats);
  const payload = buildPushPayload(copy);
  const payloadRaw = JSON.stringify(payload);

  let sent = 0;
  let cleanedInvalid = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(mapSubscriptionForWebPush(subscription), payloadRaw, {
        TTL: 24 * 60 * 60,
      });

      await withPrismaRetry(() =>
        prisma.pushSubscription.update({
          where: { id: subscription.id },
          data: {
            lastSuccessAt: new Date(),
            lastFailureAt: null,
            failureReason: null,
          },
        })
      );

      sent += 1;
    } catch (error) {
      if (isInvalidSubscriptionError(error)) {
        cleanedInvalid += 1;

        await withPrismaRetry(() =>
          prisma.pushSubscription.deleteMany({
            where: {
              id: subscription.id,
            },
          })
        );
      } else {
        failed += 1;

        await withPrismaRetry(() =>
          prisma.pushSubscription.update({
            where: { id: subscription.id },
            data: {
              lastFailureAt: new Date(),
              failureReason: getErrorMessage(error).slice(0, 500),
            },
          })
        ).catch(() => null);
      }
    }

    await sleep(WEB_PUSH_DELAY_MS);
  }

  return {
    sent,
    cleanedInvalid,
    failed,
    payload,
  };
}

function configureWebPush() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:no-reply@trackersiya.com';

  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error('VAPID keys missing');
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export async function GET(request: Request) {
  const allowedCronSecrets = [
    process.env.CRON_SECRET,
    process.env.CRON_DAILY_PUSH_SECRET,
    process.env.CRON_DAILY_AI_EMAIL_SECRET,
  ].filter(Boolean) as string[];
  const providedSecret = getCronSecretFromRequest(request);

  if (!providedSecret || !allowedCronSecrets.includes(providedSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    configureWebPush();
  } catch (error) {
    console.error('[CRON_DAILY_PUSH][CRITICAL] Invalid push configuration', error);
    return NextResponse.json({ error: 'Invalid push configuration' }, { status: 500 });
  }

  const { start: dayStartUtc, end: dayEndUtc, dayKey } = getYesterdayUtcRange(new Date());
  const dispatchDate = new Date(dayStartUtc);
  const now = new Date();
  const url = new URL(request.url);
  const testTo = url.searchParams.get('testTo');

  try {
    const expiredCleanup = await withPrismaRetry(() =>
      prisma.pushSubscription.deleteMany({
        where: {
          expirationTime: {
            lte: now,
          },
        },
      })
    );

    if (testTo) {
      const user = await withPrismaRetry(() =>
        prisma.user.findUnique({
          where: { email: testTo },
          select: {
            clerkId: true,
            pushSubscriptions: {
              select: {
                id: true,
                endpoint: true,
                p256dh: true,
                auth: true,
                expirationTime: true,
              },
            },
          },
        })
      );

      if (!user) {
        return NextResponse.json({ error: 'Utilisateur test introuvable' }, { status: 404 });
      }

      if (!user.pushSubscriptions.length) {
        return NextResponse.json({ error: 'Aucune subscription push active pour cet utilisateur' }, { status: 404 });
      }

      const testResult = await sendPushForUser({
        userId: user.clerkId,
        subscriptions: user.pushSubscriptions,
        dayStartUtc,
        dayEndUtc,
        dayKey,
      });

      return NextResponse.json({
        ok: true,
        mode: 'test',
        dayKey,
        cleanedExpiredBeforeSend: expiredCleanup.count,
        result: testResult,
      });
    }

    const users = await withPrismaRetry(() =>
      prisma.user.findMany({
        where: {
          dailyPushEnabled: true,
          pushSubscriptions: {
            some: {},
          },
        },
        select: {
          clerkId: true,
          pushSubscriptions: {
            select: {
              id: true,
              endpoint: true,
              p256dh: true,
              auth: true,
              expirationTime: true,
            },
          },
        },
      })
    );

    let sentUsers = 0;
    let skippedDuplicate = 0;
    let failedUsers = 0;
    let notificationsSent = 0;
    let cleanedInvalidSubscriptions = 0;

    for (const user of users) {
      try {
        await withPrismaRetry(() =>
          prisma.dailyPushDispatchLog.create({
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

        failedUsers += 1;
        continue;
      }

      try {
        const result = await sendPushForUser({
          userId: user.clerkId,
          subscriptions: user.pushSubscriptions,
          dayStartUtc,
          dayEndUtc,
          dayKey,
        });

        notificationsSent += result.sent;
        cleanedInvalidSubscriptions += result.cleanedInvalid;

        const status = result.sent > 0 ? 'SENT' : 'FAILED';
        if (result.sent > 0) {
          sentUsers += 1;
        } else {
          failedUsers += 1;
        }

        await withPrismaRetry(() =>
          prisma.dailyPushDispatchLog.update({
            where: {
              userId_dispatchDate: {
                userId: user.clerkId,
                dispatchDate,
              },
            },
            data: {
              status,
              sentAt: result.sent > 0 ? new Date() : null,
              errorMessage: result.sent > 0 ? null : 'Aucune notification envoyée',
            },
          })
        );
      } catch (error) {
        failedUsers += 1;
        const message = getErrorMessage(error);

        await withPrismaRetry(() =>
          prisma.dailyPushDispatchLog.update({
            where: {
              userId_dispatchDate: {
                userId: user.clerkId,
                dispatchDate,
              },
            },
            data: {
              status: 'FAILED',
              errorMessage: message.slice(0, 500),
            },
          })
        ).catch(() => null);
      }
    }

    return NextResponse.json({
      ok: true,
      dayKey,
      processedUsers: users.length,
      sentUsers,
      failedUsers,
      skippedDuplicate,
      notificationsSent,
      cleanedExpiredBeforeSend: expiredCleanup.count,
      cleanedInvalidSubscriptions,
    });
  } catch (error) {
    console.error('[CRON_DAILY_PUSH][CRITICAL] Cron execution crashed', error);
    return NextResponse.json({ error: 'Cron execution failed' }, { status: 500 });
  }
}
