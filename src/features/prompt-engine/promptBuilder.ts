import type { Character } from '@/features/characters/types';
import type { Product } from '@/features/products/types';
import type { WardrobeItem } from '@/features/wardrobe/types';
import type { Scene } from '@/features/scenes/types';
import type { Pose } from '@/features/poses/types';
import type { PromptConfiguration } from './types';

export interface PromptBuilderResources {
  character?: Character;
  product?: Product;
  wardrobeItem?: WardrobeItem;
  scene?: Scene;
  pose?: Pose;
}

const PLATFORM_LABELS: Record<string, string> = {
  generic: 'Generic AI generator',
  'veo-3': 'Google Veo 3',
  grok: 'Grok',
  'nano-banana': 'Nano Banana',
};

export function buildPrompt(
  configuration: PromptConfiguration,
  resources: PromptBuilderResources,
  campaign?: { name: string; description?: string },
): string {
  const parts: string[] = [];

  const isVideo = configuration.outputType === 'video';

  // Header
  parts.push(`CREATE A ${configuration.outputType.toUpperCase()} PROMPT`);

  // Campaign Context
  if (campaign) {
    const trimmedName = (campaign.name || '').trim();
    const campName = trimmedName.length > 0 ? trimmedName : 'Unnamed campaign';
    const campDesc = campaign.description && campaign.description.trim()
      ? campaign.description.trim()
      : 'No campaign description provided.';
    parts.push(`CAMPAIGN CONTEXT\nName: ${campName}\nDescription: ${campDesc}`);
  }

  // Target Platform
  const platformLabel = PLATFORM_LABELS[configuration.platform] || configuration.platform;
  parts.push(`TARGET PLATFORM\n${platformLabel}`);

  // Format
  const formatLines = [
    `- Output: ${configuration.outputType.charAt(0).toUpperCase() + configuration.outputType.slice(1)}`,
    `- Aspect ratio: ${configuration.aspectRatio}`,
  ];
  if (isVideo) {
    formatLines.push(`- Duration: ${configuration.durationSeconds} seconds`);
  }
  parts.push(`FORMAT\n${formatLines.join('\n')}`);

  // Character
  if (resources.character && resources.character.name) {
    const name = resources.character.name.trim();
    const desc = resources.character.description ? resources.character.description.trim() : 'No description provided.';
    parts.push(`CHARACTER\nName: ${name}\nDescription: ${desc}`);
  }

  // Product
  if (resources.product && resources.product.name) {
    const name = resources.product.name.trim();
    const desc = resources.product.description ? resources.product.description.trim() : 'No description provided.';
    parts.push(`PRODUCT\nName: ${name}\nDescription: ${desc}`);
  }

  // Wardrobe
  if (resources.wardrobeItem && resources.wardrobeItem.name) {
    const name = resources.wardrobeItem.name.trim();
    const desc = resources.wardrobeItem.description ? resources.wardrobeItem.description.trim() : 'No description provided.';
    parts.push(`WARDROBE\nName: ${name}\nDescription: ${desc}`);
  }

  // Scene
  if (resources.scene && resources.scene.name) {
    const name = resources.scene.name.trim();
    const desc = resources.scene.description ? resources.scene.description.trim() : 'No description provided.';
    parts.push(`SCENE\nName: ${name}\nDescription: ${desc}`);
  }

  // Pose
  if (resources.pose && resources.pose.name) {
    const name = resources.pose.name.trim();
    const desc = resources.pose.description ? resources.pose.description.trim() : 'No description provided.';
    parts.push(`POSE\nName: ${name}\nDescription: ${desc}`);
  }

  // Custom Instructions
  if (configuration.customInstructions && configuration.customInstructions.trim()) {
    parts.push(`CUSTOM INSTRUCTIONS\n${configuration.customInstructions.trim()}`);
  }

  // Quality and consistency rules
  const qualityHeader = 'QUALITY AND CONSISTENCY RULES';
  const qualityRules = [
    '- Preserve selected subjects and products consistently.',
    '- Do not introduce conflicting visual elements.',
    '- Keep proportions, colors, materials and defining details consistent.',
    '- Use natural composition and physically believable details.',
  ];

  if (isVideo) {
    qualityRules.push(
      '- natural movement;',
      '- visual continuity;',
      '- physically believable motion;',
      '- no accidental extra limbs or objects;',
      '- preserve subject and product identity between frames.',
    );
  } else {
    qualityRules.push(
      '- coherent composition;',
      '- realistic anatomy when people are present;',
      '- clean edges and textures;',
      '- no duplicated subjects or objects.',
    );
  }

  parts.push(`${qualityHeader}\n${qualityRules.join('\n')}`);

  return parts.join('\n\n');
}
export default buildPrompt;
