import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/prisma.client';
import { NextResponse } from 'next/server';
import { GET as runWeeklyCron } from '@/app/api/cron/weekly-email/route';
import { GET as runDailyAiCron } from '@/app/api/cron/daily-ai-email/route';
import { GET as runDailyPushCron } from '@/app/api/cron/daily-push/route';

function readBooleanEnv(value: string | undefined, fallback = false) {
  if (!value) return fallback;
  return value.toLowerCase() === 'true';
}

export async function POST(request: Request) {
  try {
    if (!readBooleanEnv(process.env.SHOW_EMAIL_TEST_ACTIONS, false)) {
      return NextResponse.json({ error: 'Tests d\'envoi désactivés' }, { status: 403 });
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { email: true },
    });

    if (!user?.email || user.email.endsWith('@temp.com')) {
      return NextResponse.json(
        { error: 'Email utilisateur non disponible pour test' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const type = body?.type;

    if (type !== 'weekly' && type !== 'daily' && type !== 'push') {
      return NextResponse.json({ error: 'Type invalide' }, { status: 400 });
    }

    if (type === 'weekly') {
      const secret = process.env.CRON_WEEKLY_EMAIL_SECRET || process.env.CRON_SECRET;
      if (!secret) {
        return NextResponse.json({ error: 'CRON_WEEKLY_EMAIL_SECRET manquant' }, { status: 500 });
      }

      const internalRequest = new Request(
        `http://internal/api/cron/weekly-email?testTo=${encodeURIComponent(user.email)}`,
        {
          method: 'GET',
          headers: {
            'x-cron-secret': secret,
          },
        }
      );

      const result = await runWeeklyCron(internalRequest);
      const data = await result.json();
      return NextResponse.json(data, { status: result.status });
    }

    if (type === 'daily') {
      const secret = process.env.CRON_DAILY_AI_EMAIL_SECRET || process.env.CRON_SECRET || process.env.CRON_WEEKLY_EMAIL_SECRET;
      if (!secret) {
        return NextResponse.json({ error: 'Secret cron daily manquant' }, { status: 500 });
      }

      const internalRequest = new Request(
        `http://internal/api/cron/daily-ai-email?testTo=${encodeURIComponent(user.email)}`,
        {
          method: 'GET',
          headers: {
            'x-cron-secret': secret,
          },
        }
      );

      const result = await runDailyAiCron(internalRequest);
      const data = await result.json();
      return NextResponse.json(data, { status: result.status });
    }

    const secret = process.env.CRON_DAILY_PUSH_SECRET || process.env.CRON_SECRET || process.env.CRON_DAILY_AI_EMAIL_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'Secret cron push manquant' }, { status: 500 });
    }

    const internalRequest = new Request(
      `http://internal/api/cron/daily-push?testTo=${encodeURIComponent(user.email)}`,
      {
        method: 'GET',
        headers: {
          'x-cron-secret': secret,
        },
      }
    );

    const result = await runDailyPushCron(internalRequest);
    const data = await result.json();

    if (result.status === 404 && data?.error === 'Aucune subscription push active pour cet utilisateur') {
      return NextResponse.json(
        {
          error:
            'Aucune subscription push active. Active les notifications push sur cet appareil depuis Paramètres, puis réessaie.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(data, { status: result.status });
  } catch (error) {
    console.error('Erreur test email settings:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
