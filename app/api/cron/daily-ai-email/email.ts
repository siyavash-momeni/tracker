import { Resend } from 'resend';
import { DailyEmailCopy } from './types';

const RESEND_MAX_RETRIES = 4;
const RESEND_RATE_LIMIT_DELAY_MS = 600;

export function getResendRateLimitDelayMs() {
  return RESEND_RATE_LIMIT_DELAY_MS;
}

export function createResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('Missing RESEND_API_KEY environment variable.');
  }

  return new Resend(apiKey);
}

export function sleep(milliseconds: number): Promise<void> {
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

export async function sendDailyAiEmail(params: {
  resend: Resend;
  to: string;
  copy: DailyEmailCopy;
}): Promise<string | undefined> {
  const emailFrom = process.env.EMAIL_FROM;
  if (!emailFrom) {
    throw new Error('Missing EMAIL_FROM environment variable.');
  }

  const { resend, to, copy } = params;
  const ctaUrl = 'https://trackersiya.com';
  const contentSentences = copy.content
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const text = [copy.content, '', `${copy.ctaLabel}: ${ctaUrl}`].join('\n');

  const html = `
    <div>
      <h2>Ton rappel quotidien Tracker</h2>

      <h3>✨ Ton point du jour</h3>
      ${contentSentences.map((sentence) => `<p>${sentence}</p>`).join('')}

      <p>
        <a href="${ctaUrl}" target="_blank" rel="noopener noreferrer"><strong>${copy.ctaLabel}</strong></a>
      </p>
    </div>
  `;

  return sendWithRetry({
    resend,
    from: emailFrom,
    to,
    subject: `${copy.subject} (${copy.source})`,
    text,
    html,
  });
}
