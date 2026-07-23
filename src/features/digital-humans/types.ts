export const DIGITAL_HUMAN_LIFECYCLES = ['draft', 'active', 'training', 'generating', 'archived'] as const;
export type DigitalHumanLifecycle = (typeof DIGITAL_HUMAN_LIFECYCLES)[number];

export interface DigitalHumanProfile {
  id: string;
  characterId: string;
  lifecycle: DigitalHumanLifecycle;
  personality: string;
  voiceDNA: string;
  appearanceDNA: string;
  promptDNA: string;
  negativePrompt: string;
  memory: string;
  brandRules: string;
  catchphrases: string[];
  specialties: string[];
  referenceImages: string[];
  referenceVideos: string[];
  updatedAt: string;
}
