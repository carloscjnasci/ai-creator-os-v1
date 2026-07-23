import type { CreativePlatform, ViralContentAnalysis } from '../types';
import { calculateViralScore } from './viralScore';

export function inferPlatformFromUrl(url: string): CreativePlatform {
  const normalized = url.toLocaleLowerCase();
  if (normalized.includes('tiktok')) return 'tiktok';
  if (normalized.includes('instagram')) return 'instagram';
  if (normalized.includes('youtube') || normalized.includes('youtu.be')) return 'youtube';
  if (normalized.includes('pinterest') || normalized.includes('pin.it')) return 'pinterest';
  return 'generic';
}

function firstSentence(text: string): string {
  return text.split(/(?<=[.!?])\s+/)[0]?.trim() || 'The content opens with immediate visual context.';
}

function findCta(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  return (
    sentences.find((sentence) => /click|clica|compre|garanta|siga|salve|compartilhe|acesse|link|carrinho/i.test(sentence)) ??
    'No explicit CTA detected; add one clear action.'
  );
}

export function analyzeViralContent(input: {
  sourceUrl: string;
  notes: string;
  digitalHumanName?: string;
  productName?: string;
}): ViralContentAnalysis {
  const platform = inferPlatformFromUrl(input.sourceUrl);
  const notes = input.notes.trim();
  const hook = firstSentence(notes);
  const cta = findCta(notes);
  const hasStory = /antes|depois|problema|resultado|quando|descobri|transform/i.test(notes);
  const emotionalTerms = notes.match(/surpresa|medo|desejo|urgência|confiança|alívio|curiosidade/gi) ?? [];
  const hashtags = notes.match(/#[\p{L}\p{N}_-]+/gu) ?? [];
  const digitalHuman = input.digitalHumanName || 'the selected Digital Human';
  const product = input.productName || 'the selected product';

  const analysis: ViralContentAnalysis = {
    platform,
    sourceUrl: input.sourceUrl,
    hook,
    storytelling: hasStory
      ? 'Uses a problem-to-result or before-and-after progression.'
      : 'The narrative structure is weak; add a clear problem, tension and payoff.',
    cta,
    camera: /close|zoom|pov|handheld|câmera|camera|tracking/i.test(notes)
      ? 'Uses an explicit camera language or point of view.'
      : 'Camera language is not explicit; use a close product reveal and controlled handheld movement.',
    lighting: /light|lighting|luz|iluminação|golden|soft/i.test(notes)
      ? 'Lighting direction is described.'
      : 'Use soft, natural, product-revealing light with realistic skin and fabric texture.',
    emotion: emotionalTerms.length > 0
      ? `Detected emotional drivers: ${Array.from(new Set(emotionalTerms)).join(', ')}.`
      : 'Curiosity is present, but a stronger emotional payoff would improve retention.',
    caption: notes.slice(0, 220) || 'Create a concise caption that restates the benefit and urgency.',
    hashtags,
    audio: /audio|music|música|voice|fala|narr/i.test(notes)
      ? 'The source includes an audio or narration cue.'
      : 'No audio strategy detected; choose native-feeling voiceover or trend-compatible sound.',
    scene: /kitchen|bedroom|store|street|studio|cozinha|quarto|loja|rua/i.test(notes)
      ? 'A contextual scene is referenced.'
      : 'Scene context is generic; use an environment that validates the product use case.',
    clothing: /dress|shirt|jacket|pants|roupa|vestido|jaqueta|calça|blusa/i.test(notes)
      ? 'Clothing is part of the visual message.'
      : 'No clothing signal detected.',
    expression: /smile|surprise|confident|sorriso|surpresa|confiante/i.test(notes)
      ? 'An expression cue is present.'
      : 'Use a natural, confident expression without exaggerated acting.',
    pose: /pose|turn|walk|hold|gira|caminha|segura/i.test(notes)
      ? 'A demonstrative pose or movement is present.'
      : 'Use subtle product-revealing gestures and realistic posture.',
    rhythm: notes.length > 500
      ? 'Information density is high; use fast cuts with one idea per beat.'
      : 'Compact pacing supports a short-form format.',
    adaptedPrompt: `Create a platform-native ${platform} creative featuring ${digitalHuman} and ${product}. Preserve the winning hook structure: “${hook}”. Build a clear problem-to-benefit progression, show the product early, use realistic handheld camera movement, soft commercial lighting, natural expression, precise product fidelity and a single explicit CTA. Adapt the original concept without copying the source creator identity, copyrighted visual identity or exact wording.`,
    viralScore: calculateViralScore({
      goal: notes || `Adapt a viral ${platform} content structure`,
      targetAudience: 'Audience inferred from the source content',
      platform,
      objective: 'virality',
      hook,
      cta,
      story: notes,
      emotion: emotionalTerms.join(' '),
      clothing: notes,
      trendSignals: [input.sourceUrl],
      productName: input.productName,
    }),
  };

  return analysis;
}
