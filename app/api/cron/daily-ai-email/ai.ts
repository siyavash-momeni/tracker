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

type DailyAiStructuredOutput = {
  subject?: string;
  valorizationSentence?: string;
  encouragementSentence?: string;
  ctaLabel?: string;
  ctaPath?: string;
};

const FORBIDDEN_PATTERNS = [
  /tu as échoué/i,
  /tu aurais dû/i,
  /tu n[’']as pas fait assez/i,
  /tu dois faire mieux/i,
  /échec/i,
  /pas assez/i,
  /raté/i,
  /faute/i,
];

function hasForbiddenTone(text: string) {
  return FORBIDDEN_PATTERNS.some((pattern) => pattern.test(text));
}

function isSentenceCountValid(text: string, min: number, max: number) {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return sentences.length >= min && sentences.length <= max;
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

function getDailyCase(stats: DailyEmailStats) {
  if (stats.plannedHabits === 0) return 'NO_PLANNED';
  if (stats.completedHabits === 0) return 'NONE_COMPLETED';
  if (stats.completionRate >= 90) return 'EXCELLENT_DAY';
  if (stats.completionRate >= 70) return 'GOOD_PROGRESS';
  if (stats.completionRate >= 40) return 'AVERAGE_DAY';
  return 'LOW_ACTIVITY';
}

function fallbackDailyCopy(stats: DailyEmailStats): DailyEmailCopy {
  const subject =
    stats.totalCheckIns > 0
      ? `Ton rappel Tracker — progression du ${stats.dispatchDateKey}`
      : `Ton rappel Tracker — on relance le ${stats.dispatchDateKey}`;

  const factualSentence = buildFactualSentence(stats);
  const valorizationSentence =
    stats.totalCheckIns > 0
      ? 'Tu avances et tu construis une régularité solide.'
      : 'Chaque petite action compte, et tu gardes le cap.';
  const progressionSentence =
    stats.completionRate >= 70
      ? 'Aujourd’hui, garde ce rythme avec une action simple dès maintenant.'
      : 'Aujourd’hui, une action simple suffit pour renforcer la dynamique.';

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
        temperature: 0.35,
        messages: [
          {
            role: 'system',
            content:
              `Tu écris des emails de rappel quotidiens en français, courts et très structurés.

Règles de ton et formulation (obligatoires) :
- positif
- encourageant
- factuel
- orienté progression

Interdits absolus :
- juger
- culpabiliser
- ton négatif
- formulations du type : "Tu as échoué", "Tu aurais dû", "Tu n'as pas fait assez", "Tu dois faire mieux"

Formulations acceptables (style) :
- "Tu avances."
- "Tu construis de la régularité."
- "Belle constance."
- "Chaque petite action compte."
- "Tu te rapproches de ton objectif."

Contraintes de sortie :
- N'écris PAS la phrase factuelle (elle est déjà gérée par le système)
- Produis uniquement 2 phrases courtes :
  1) valorizationSentence
  2) encouragementSentence
- Utilise uniquement les chiffres fournis, sans rien inventer
- Pas de liste, pas de markdown
- CTA clair vers /today
- Réponds strictement en JSON avec : subject, valorizationSentence, encouragementSentence, ctaLabel, ctaPath`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              instruction:
                'Tu dois produire un sujet motivant + 2 phrases (valorisation + encouragement progression) + un CTA vers /today. La phrase factuelle sera ajoutée automatiquement côté système.',
              dailyCase: getDailyCase(stats),
              toneReferenceExamples: [
                {
                  case: 'EXCELLENTE JOURNÉE',
                  subject: 'Belle constance hier 👏',
                  valorizationSentence:
                    'Tu maintiens une régularité solide et tu construis une vraie dynamique.',
                  encouragementSentence:
                    'Aujourd’hui, continue sur cette lancée avec une action simple dès le matin.',
                  ctaLabel: 'Continuer aujourd’hui',
                  ctaPath: '/today',
                },
                {
                  case: 'BONNE PROGRESSION',
                  subject: 'Tu avances 👏',
                  valorizationSentence:
                    'Tu restes aligné avec ton objectif et tu construis une constance utile.',
                  encouragementSentence:
                    'Un petit effort aujourd’hui peut te rapprocher encore plus de ton cap.',
                  ctaLabel: 'Voir mes habitudes',
                  ctaPath: '/today',
                },
                {
                  case: 'JOURNÉE MOYENNE',
                  subject: 'Une étape de plus vers la régularité',
                  valorizationSentence: 'Chaque action compte, et tu as maintenu le mouvement.',
                  encouragementSentence:
                    'Aujourd’hui est une nouvelle opportunité de renforcer cette dynamique.',
                  ctaLabel: 'Continuer aujourd’hui',
                  ctaPath: '/today',
                },
                {
                  case: 'FAIBLE ACTIVITÉ',
                  subject: 'On continue le rythme 💪',
                  valorizationSentence:
                    'Tu restes engagé, même les petites actions construisent la constance.',
                  encouragementSentence:
                    'Reprendre le rythme aujourd’hui peut faire la différence.',
                  ctaLabel: 'Voir mes habitudes',
                  ctaPath: '/today',
                },
                {
                  case: 'AUCUNE COMPLÉTION',
                  subject: 'Nouvelle journée, nouveau départ',
                  valorizationSentence:
                    'Chaque jour est une occasion de repartir sur de bonnes bases.',
                  encouragementSentence:
                    'Commencer par une seule action aujourd’hui suffit pour relancer la dynamique.',
                  ctaLabel: 'Démarrer aujourd’hui',
                  ctaPath: '/today',
                },
              ],
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

    const parsed = JSON.parse(content) as DailyAiStructuredOutput;

    const factualSentence = buildFactualSentence(stats);
    const safeValorization = normalizeLine(
      parsed.valorizationSentence,
      'Tu avances et tu construis une régularité solide.',
      220
    );
    const safeEncouragement = normalizeLine(
      parsed.encouragementSentence,
      'Aujourd’hui, une action simple suffit pour renforcer la dynamique.',
      220
    );
    const contentWithFact = `${factualSentence} ${safeValorization} ${safeEncouragement}`;
    const cappedContent = keepMaxSentences(contentWithFact, 4);
    const safeCtaLabel = normalizeLine(parsed.ctaLabel, fallback.ctaLabel, 120);

    if (!isSentenceCountValid(cappedContent, 3, 4)) {
      return fallback;
    }

    if (hasForbiddenTone(`${parsed.subject || ''} ${cappedContent} ${safeCtaLabel}`)) {
      return fallback;
    }

    return {
      subject: ensureCoherentSubject(parsed.subject || fallback.subject, stats.dispatchDateKey),
      content: cappedContent,
      ctaLabel: safeCtaLabel,
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
