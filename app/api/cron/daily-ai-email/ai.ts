import OpenAI from 'openai';
import { DailyEmailCopy, DailyEmailStats } from './types';

const OPENAI_REQUEST_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('OPENAI_TIMEOUT'));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function normalizeLine(value: string | undefined, fallback: string, maxLength: number): string {
  const normalized = (value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return fallback;
  if (normalized.length > maxLength) return normalized.slice(0, maxLength).trim();
  return normalized;
}

function keepMaxSentences(content: string, maxSentences: number) {
  const sentences = content
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= maxSentences) return content;
  return sentences.slice(0, maxSentences).join(' ');
}

function buildFactualSentence(stats: DailyEmailStats): string {
  if (stats.plannedHabits === 0) {
    return 'Hier, aucune habitude n’était planifiée.';
  }

  return `Hier, ${stats.completedHabits}/${stats.plannedHabits} habitude(s) prévue(s) ont eu une progression, avec ${stats.totalCheckIns} check-in(s) et ${stats.completionRate}% de complétion.`;
}

function fallbackDailyCopy(stats: DailyEmailStats): DailyEmailCopy {
  const subject =
    stats.totalCheckIns > 0
      ? `Ton rappel Tracker — progression du ${stats.dispatchDateKey}`
      : `Ton rappel Tracker — on relance le ${stats.dispatchDateKey}`;

  const factualSentence = buildFactualSentence(stats);
  const valorizationSentence =
    stats.totalCheckIns > 0
      ? 'Tu as posé des actions concrètes, c’est une vraie avancée.'
      : 'Le cadre est en place, c’est une excellente base pour progresser.';
  const progressionSentence =
    stats.completionRate >= 70
      ? 'Aujourd’hui, garde ce rythme avec une action simple dès maintenant.'
      : 'Aujourd’hui, vise une micro-victoire pour relancer ta progression.';

  return {
    subject,
    content: `${factualSentence} ${valorizationSentence} ${progressionSentence}`,
    ctaLabel: 'Ouvrir Tracker /today',
    ctaPath: '/today',
  };
}

function ensureCoherentSubject(subject: string, dayKey: string) {
  const normalized = subject.trim();
  if (normalized.length < 8 || normalized.length > 120) {
    return `Ton rappel Tracker — progression du ${dayKey}`;
  }

  return normalized;
}

export async function generateDailyEmailCopy(stats: DailyEmailStats): Promise<DailyEmailCopy> {
  const fallback = fallbackDailyCopy(stats);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fallback;
  }

  const openai = new OpenAI({ apiKey });

  try {
    const completion = await withTimeout(
      openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0.6,
        messages: [
          {
            role: 'system',
            content:
              'Tu écris des emails de rappel quotidiens en français. Toujours positif, orienté progression. Utilise uniquement les nombres fournis, sans inventer. Contenu principal en 3 à 4 phrases maximum. Réponds strictement en JSON avec: subject, content, ctaLabel, ctaPath.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              instruction: 'Le contenu doit inclure une phrase factuelle sur la veille (prévues vs complétées, check-ins, %), puis valorisation, puis encouragement orienté progression. CTA vers /today.',
              stats,
            }),
          },
        ],
      }),
      OPENAI_REQUEST_TIMEOUT_MS
    );

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return fallback;
    }

    const parsed = JSON.parse(content) as Partial<DailyEmailCopy>;

    const factualSentence = buildFactualSentence(stats);
    const normalizedContent = normalizeLine(parsed.content, fallback.content, 480);
    const contentWithFact = `${factualSentence} ${normalizedContent}`;
    const cappedContent = keepMaxSentences(contentWithFact, 4);

    return {
      subject: ensureCoherentSubject(parsed.subject || fallback.subject, stats.dispatchDateKey),
      content: cappedContent,
      ctaLabel: normalizeLine(parsed.ctaLabel, fallback.ctaLabel, 120),
      ctaPath: '/today',
    };
  } catch (error) {
    console.warn('[DAILY_AI_EMAIL] OpenAI fallback used', {
      reason: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      dispatchDateKey: stats.dispatchDateKey,
    });

    return fallback;
  }
}
