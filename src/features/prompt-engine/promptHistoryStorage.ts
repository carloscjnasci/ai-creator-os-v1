import {
  PromptHistoryEntry,
  PROMPT_OUTPUT_TYPES,
  PROMPT_PLATFORMS,
  PROMPT_ASPECT_RATIOS,
  PromptOutputType,
  PromptPlatform,
  PromptAspectRatio,
} from './types';

export const PROMPT_HISTORY_STORAGE_KEY = 'ai-creator-os.prompt-history.v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidOutputType(val: unknown): val is PromptOutputType {
  return typeof val === 'string' && (PROMPT_OUTPUT_TYPES as readonly string[]).includes(val);
}

function isValidPlatform(val: unknown): val is PromptPlatform {
  return typeof val === 'string' && (PROMPT_PLATFORMS as readonly string[]).includes(val);
}

function isValidAspectRatio(val: unknown): val is PromptAspectRatio {
  return typeof val === 'string' && (PROMPT_ASPECT_RATIOS as readonly string[]).includes(val);
}

function isPromptHistoryEntry(value: unknown): value is PromptHistoryEntry {
  if (!isRecord(value)) {
    return false;
  }

  const { id, configuration, generatedPrompt, createdAt, campaignId, campaignName } = value;

  if (
    typeof id !== 'string' || id.trim() === '' ||
    typeof generatedPrompt !== 'string' || generatedPrompt.trim() === '' ||
    typeof createdAt !== 'string' || createdAt.trim() === ''
  ) {
    return false;
  }

  if (campaignId !== undefined && typeof campaignId !== 'string') {
    return false;
  }

  if (campaignName !== undefined && typeof campaignName !== 'string') {
    return false;
  }

  if (!isRecord(configuration)) {
    return false;
  }

  const {
    outputType,
    platform,
    aspectRatio,
    durationSeconds,
    characterId,
    productId,
    wardrobeItemId,
    sceneId,
    poseId,
    customInstructions,
  } = configuration;

  if (!isValidOutputType(outputType)) {
    return false;
  }

  if (!isValidPlatform(platform)) {
    return false;
  }

  if (!isValidAspectRatio(aspectRatio)) {
    return false;
  }

  if (
    typeof durationSeconds !== 'number' ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds < 1 ||
    durationSeconds > 60
  ) {
    return false;
  }

  if (
    typeof characterId !== 'string' ||
    typeof productId !== 'string' ||
    typeof wardrobeItemId !== 'string' ||
    typeof sceneId !== 'string' ||
    typeof poseId !== 'string' ||
    typeof customInstructions !== 'string'
  ) {
    return false;
  }

  return true;
}

export function parseStoredPromptHistory(
  serializedHistory: string | null,
): PromptHistoryEntry[] {
  if (!serializedHistory) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(serializedHistory);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isPromptHistoryEntry);
  } catch {
    return [];
  }
}

export function loadPromptHistoryFromStorage(): PromptHistoryEntry[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(PROMPT_HISTORY_STORAGE_KEY);
    return parseStoredPromptHistory(stored);
  } catch {
    return [];
  }
}

export function savePromptHistoryToStorage(
  history: PromptHistoryEntry[],
): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    window.localStorage.setItem(
      PROMPT_HISTORY_STORAGE_KEY,
      JSON.stringify(history),
    );
    return true;
  } catch {
    return false;
  }
}
