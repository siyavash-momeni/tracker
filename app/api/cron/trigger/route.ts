import { NextResponse } from 'next/server';
import { GET as GET_EMAIL } from '../daily-ai-email/route';
import { GET as GET_PUSH } from '../daily-push/route';
import { getCronSecretFromRequest } from '../daily-ai-email/date-utils';

export const dynamic = 'force-dynamic';

function isAllowedSecret(provided: string | null) {
  const allowed = [
    process.env.CRON_SECRET,
    process.env.CRON_DAILY_AI_EMAIL_SECRET,
    process.env.CRON_DAILY_PUSH_SECRET,
    process.env.CRON_WEEKLY_EMAIL_SECRET,
  ].filter(Boolean) as string[];

  if (!provided) return false;
  return allowed.includes(provided);
}

async function forwardToHandler(handler: (req: Request) => Promise<Response>, providedSecret: string | null, pathQuery = '') {
  const headers = new Headers();
  if (providedSecret) headers.set('x-cron-secret', providedSecret);

  const fakeUrl = `https://internal.local/api/cron${pathQuery}`;
  const forwarded = new Request(fakeUrl, { method: 'GET', headers });
  return handler(forwarded);
}

export async function POST(request: Request) {
  const providedSecret = getCronSecretFromRequest(request);
  if (!isAllowedSecret(providedSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: any = {};
  try {
    payload = await request.json().catch(() => ({}));
  } catch {
    payload = {};
  }

  const mode = (payload.mode || 'both') as 'both' | 'email' | 'push';
  const testTo = payload.testTo ? String(payload.testTo) : null;

  const results: Record<string, any> = {};

  try {
    if (mode === 'both' || mode === 'email') {
      const qs = testTo ? `?testTo=${encodeURIComponent(testTo)}` : '';
      const res = await forwardToHandler(GET_EMAIL, providedSecret, `/daily-ai-email${qs}`);
      results.email = await res.json().catch(() => ({ status: res.status }));
    }

    if (mode === 'both' || mode === 'push') {
      const qs = testTo ? `?testTo=${encodeURIComponent(testTo)}` : '';
      const res = await forwardToHandler(GET_PUSH, providedSecret, `/daily-push${qs}`);
      results.push = await res.json().catch(() => ({ status: res.status }));
    }

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    console.error('[CRON_TRIGGER] Error triggering crons', error);
    return NextResponse.json({ error: 'Trigger failed', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  // Allow quick GET usage with query params: ?mode=both|email|push&testTo=...
  const providedSecret = getCronSecretFromRequest(request);
  if (!isAllowedSecret(providedSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const mode = (url.searchParams.get('mode') || 'both') as 'both' | 'email' | 'push';
  const testTo = url.searchParams.get('testTo');

  try {
    const results: Record<string, any> = {};

    if (mode === 'both' || mode === 'email') {
      const qs = testTo ? `?testTo=${encodeURIComponent(testTo)}` : '';
      const res = await forwardToHandler(GET_EMAIL, providedSecret, `/daily-ai-email${qs}`);
      results.email = await res.json().catch(() => ({ status: res.status }));
    }

    if (mode === 'both' || mode === 'push') {
      const qs = testTo ? `?testTo=${encodeURIComponent(testTo)}` : '';
      const res = await forwardToHandler(GET_PUSH, providedSecret, `/daily-push${qs}`);
      results.push = await res.json().catch(() => ({ status: res.status }));
    }

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    console.error('[CRON_TRIGGER] Error triggering crons', error);
    return NextResponse.json({ error: 'Trigger failed', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
