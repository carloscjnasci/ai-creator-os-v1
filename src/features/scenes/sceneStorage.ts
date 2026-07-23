import type { Scene } from '@/features/scenes/types';

export const SCENE_STORAGE_KEY = 'ai-creator-os.scenes.v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isScene(value: unknown): value is Scene {
  if (!isRecord(value)) {
    return false;
  }

  const { id, name, description, createdAt } = value;

  return (
    typeof id === 'string' &&
    id.length > 0 &&
    typeof name === 'string' &&
    name.length > 0 &&
    typeof description === 'string' &&
    typeof createdAt === 'string' &&
    createdAt.length > 0
  );
}

export function parseStoredScenes(
  serializedScenes: string | null,
): Scene[] {
  if (!serializedScenes) {
    return [];
  }

  try {
    const parsedScenes: unknown = JSON.parse(serializedScenes);

    if (!Array.isArray(parsedScenes)) {
      return [];
    }

    return parsedScenes.filter(isScene);
  } catch {
    return [];
  }
}

export function loadScenesFromStorage(): Scene[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const storedScenes = window.localStorage.getItem(
      SCENE_STORAGE_KEY,
    );

    return parseStoredScenes(storedScenes);
  } catch {
    return [];
  }
}

export function saveScenesToStorage(
  scenes: Scene[],
): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    window.localStorage.setItem(
      SCENE_STORAGE_KEY,
      JSON.stringify(scenes),
    );

    return true;
  } catch {
    return false;
  }
}
