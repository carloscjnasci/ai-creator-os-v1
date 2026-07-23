export const PROMPT_OUTPUT_TYPES = [
  'image',
  'video',
] as const;

export type PromptOutputType =
  (typeof PROMPT_OUTPUT_TYPES)[number];

export const PROMPT_PLATFORMS = [
  'generic',
  'veo-3',
  'grok',
  'nano-banana',
] as const;

export type PromptPlatform =
  (typeof PROMPT_PLATFORMS)[number];

export const PROMPT_ASPECT_RATIOS = [
  '9:16',
  '16:9',
  '1:1',
  '4:5',
] as const;

export type PromptAspectRatio =
  (typeof PROMPT_ASPECT_RATIOS)[number];

export interface PromptConfiguration {
  outputType: PromptOutputType;
  platform: PromptPlatform;
  aspectRatio: PromptAspectRatio;
  durationSeconds: number;
  characterId: string;
  productId: string;
  wardrobeItemId: string;
  sceneId: string;
  poseId: string;
  customInstructions: string;
}

export interface PromptHistoryEntry {
  id: string;
  configuration: PromptConfiguration;
  generatedPrompt: string;
  createdAt: string;
  campaignId?: string;
  campaignName?: string;
}

export const DEFAULT_PROMPT_CONFIGURATION: PromptConfiguration = {
  outputType: 'video',
  platform: 'veo-3',
  aspectRatio: '9:16',
  durationSeconds: 8,
  characterId: '',
  productId: '',
  wardrobeItemId: '',
  sceneId: '',
  poseId: '',
  customInstructions: '',
};
