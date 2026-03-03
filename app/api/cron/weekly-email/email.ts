import { Resend } from 'resend';
import { WeeklyEmailStats } from './types';

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

function buildWeeklyEmailContent(stats: WeeklyEmailStats, weekStartDate: Date) {
  const { totalHabits, totalCheckIns, completionRate, goalsReached, bestStreak } = stats;
  const weekStartLabel = weekStartDate.toISOString().slice(0, 10);
  const subject =
    totalCheckIns > 0
      ? `🔥 Belle progression cette semaine ! Ton récap Tracker (${weekStartLabel})`
      : `🚀 Nouvelle semaine, nouveau départ — ton récap Tracker (${weekStartLabel})`;
  const ctaUrl = 'https://trackersiya.com';
  const encouragement =
    completionRate >= 70
      ? 'Tu avances bien, continue ce rythme simple et régulier 💪'
      : 'Un petit pas aujourd’hui vaut mieux que rien : tu peux relancer la machine dès maintenant 💪';

  const text = [
    `Ton récap hebdomadaire Tracker (semaine du ${weekStartLabel})`,
    '',
    'Tes stats :',
    `- Habitudes actives : ${totalHabits}`,
    `- Total check-ins de la semaine : ${totalCheckIns}`,
    `- Ton pourcentage de complétion : ${completionRate}%`,
    `- Objectifs atteints : ${goalsReached}`,
    `- Meilleure streak : ${bestStreak} jour(s)`,
    '',
    encouragement,
    '',
    `Voir mon tracker : ${ctaUrl}`,
  ].join('\n');

  const html = `
      <div>
        <h2>Ton récap hebdomadaire Tracker</h2>
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

export async function sendWeeklyEmail(params: {
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
