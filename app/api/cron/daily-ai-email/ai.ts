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

function normalizeRequiredLine(value: string | undefined, maxLength: number): string {
  const normalized = (value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    throw new Error('OPENAI_INVALID_OUTPUT');
  }
  if (normalized.length > maxLength) return normalized.slice(0, maxLength).trim();
  return normalized;
}

type DailyAiStructuredOutput = {
  subject?: string;
  factualSentence?: string;
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

function countSentences(text: string) {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return sentences.length;
}

function keepMaxSentences(content: string, maxSentences: number) {
  const sentences = content
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= maxSentences) return content;
  return sentences.slice(0, maxSentences).join(' ');
}

function hasForbiddenTone(text: string) {
  return FORBIDDEN_PATTERNS.some((pattern) => pattern.test(text));
}

function buildFactualSentence(stats: DailyEmailStats): string {
  if (stats.plannedHabits === 0) {
    return 'Hier, aucune habitude n’était planifiée.';
  }

  const habitWord = stats.plannedHabits > 1 ? 'habitudes' : 'habitude';
  const plannedAgreement = stats.plannedHabits > 1 ? 'prévues' : 'prévue';
  const progressVerb = stats.completedHabits > 1 ? 'ont eu' : 'a eu';
  const checkInWord = stats.totalCheckIns > 1 ? 'check-ins' : 'check-in';

  return `Hier, ${stats.completedHabits}/${stats.plannedHabits} ${habitWord} ${plannedAgreement} ${progressVerb} une progression, avec ${stats.totalCheckIns} ${checkInWord} et ${stats.completionRate}% de complétion.`;
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
    source: 'fallback',
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
- Produis exactement 3 phrases courtes :
  1) factualSentence (avec statistiques de la veille)
  2) valorizationSentence
  3) encouragementSentence
- Utilise uniquement les chiffres fournis, sans rien inventer
- Pas de liste, pas de markdown
- CTA clair vers /today
- Réponds strictement en JSON avec : subject, factualSentence, valorizationSentence, encouragementSentence, ctaLabel, ctaPath`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              instruction:
                'Tu dois produire un sujet motivant + 3 phrases (factuel, valorisation, encouragement progression) + un CTA vers /today. La phrase factuelle doit reprendre fidèlement les stats fournies.',
              dailyCase: getDailyCase(stats),
              toneReferenceExamples: [
                {
                  case: 'EXCELLENTE JOURNÉE',
                  subject: 'Belle constance hier 👏',
                  factualSentence: 'Hier, tu as complété 5 habitudes sur 5 prévues.',
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
                  factualSentence: 'Hier, tu as complété 3 habitudes sur 4 prévues (75%).',
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
                  factualSentence: 'Hier, tu as complété 2 habitudes sur 5 prévues.',
                  valorizationSentence: 'Chaque action compte, et tu as maintenu le mouvement.',
                  encouragementSentence:
                    'Aujourd’hui est une nouvelle opportunité de renforcer cette dynamique.',
                  ctaLabel: 'Continuer aujourd’hui',
                  ctaPath: '/today',
                },
                {
                  case: 'FAIBLE ACTIVITÉ',
                  subject: 'On continue le rythme 💪',
                  factualSentence: 'Hier, tu as validé 1 habitude.',
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
                  factualSentence: 'Hier n’a pas enregistré d’habitudes complétées.',
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

    const factualSentence = normalizeRequiredLine(parsed.factualSentence, 260);
    const safeValorization = normalizeRequiredLine(parsed.valorizationSentence, 220);
    const safeEncouragement = normalizeRequiredLine(parsed.encouragementSentence, 220);
    const contentWithFact = `${factualSentence} ${safeValorization} ${safeEncouragement}`;
    const cappedContent = keepMaxSentences(contentWithFact, 4);
    const safeCtaLabel = normalizeRequiredLine(parsed.ctaLabel, 120);
    const safeSubject = normalizeRequiredLine(parsed.subject, 120);

    if (countSentences(cappedContent) < 3) {
      throw new Error('OPENAI_INVALID_OUTPUT');
    }

    if (hasForbiddenTone(`${safeSubject} ${cappedContent} ${safeCtaLabel}`)) {
      throw new Error('OPENAI_INVALID_OUTPUT');
    }

    return {
      subject: ensureCoherentSubject(safeSubject, stats.dispatchDateKey),
      content: cappedContent,
      ctaLabel: safeCtaLabel,
      ctaPath: '/today',
      source: 'ia',
    };
  } catch (error) {
    console.warn('[DAILY_AI_EMAIL] OpenAI fallback used', {
      reason: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      dispatchDateKey: stats.dispatchDateKey,
    });

    return fallback;
  }
}
