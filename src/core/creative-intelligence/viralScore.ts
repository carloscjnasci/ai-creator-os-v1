import type { CreativeObjective, CreativePlatform, ViralScoreResult } from '../types';

interface ViralScoreInput {
  goal: string;
  targetAudience?: string;
  platform: CreativePlatform;
  objective: CreativeObjective;
  hook?: string;
  cta?: string;
  story?: string;
  emotion?: string;
  clothing?: string;
  trendSignals?: string[];
  productName?: string;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function textSignal(text: string | undefined, terms: string[]): number {
  if (!text) return 0;
  const normalized = text.toLocaleLowerCase();
  return terms.reduce((score, term) => score + (normalized.includes(term) ? 1 : 0), 0);
}

export function calculateViralScore(input: ViralScoreInput): ViralScoreResult {
  const goal = input.goal.trim();
  const hookText = input.hook ?? goal;
  const ctaText = input.cta ?? goal;
  const storyText = input.story ?? goal;
  const emotionText = input.emotion ?? goal;

  const hook = clamp(
    58 +
      Math.min(20, hookText.length / 8) +
      textSignal(hookText, ['agora', 'descobri', 'erro', 'ninguém', 'pare', 'olha', 'segredo']) * 4,
  );

  const cta = clamp(
    48 +
      textSignal(ctaText, ['clique', 'clica', 'garanta', 'compre', 'acesse', 'antes que', 'agora']) * 8 +
      (input.objective === 'sales' || input.objective === 'ctr' ? 12 : 4),
  );

  const storytelling = clamp(
    52 +
      Math.min(22, storyText.length / 14) +
      textSignal(storyText, ['antes', 'depois', 'quando', 'porque', 'resultado', 'problema']) * 4,
  );

  const emotion = clamp(
    50 +
      Math.min(18, emotionText.length / 16) +
      textSignal(emotionText, ['medo', 'desejo', 'surpresa', 'alívio', 'confiança', 'urgência']) * 5,
  );

  const clothing = clamp(55 + (input.clothing?.trim() ? 24 : 0) + (input.platform === 'tiktok-shop' ? 8 : 0));
  const trend = clamp(52 + Math.min(36, (input.trendSignals?.length ?? 0) * 9) + (input.objective === 'virality' ? 8 : 0));
  const productFit = clamp(56 + (input.productName ? 24 : 0) + (input.targetAudience?.trim() ? 12 : 0));
  const clarity = clamp(48 + Math.min(28, goal.length / 5) + (input.targetAudience?.trim() ? 12 : 0));

  const breakdown = {
    hook,
    cta,
    storytelling,
    emotion,
    clothing,
    trend,
    productFit,
    clarity,
  };

  const weights = {
    hook: 0.18,
    cta: 0.14,
    storytelling: 0.13,
    emotion: 0.12,
    clothing: 0.08,
    trend: 0.15,
    productFit: 0.12,
    clarity: 0.08,
  };

  const overall = clamp(
    Object.entries(breakdown).reduce(
      (total, [key, value]) => total + value * weights[key as keyof typeof weights],
      0,
    ),
  );

  const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  const strengths = sorted.slice(0, 3).map(([key, value]) => `${key}: ${value}/100`);
  const risks = sorted
    .filter(([, value]) => value < 70)
    .slice(-3)
    .map(([key, value]) => `${key} needs reinforcement (${value}/100)`);

  return { overall, breakdown, strengths, risks };
}
