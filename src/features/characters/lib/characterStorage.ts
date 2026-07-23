import type { Character } from '@/features/characters/types';

export const CHARACTER_STORAGE_KEY = 'ai-creator-os.characters.v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isCharacter(value: unknown): value is Character {
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
    !Number.isNaN(Date.parse(createdAt))
  );
}

export function parseStoredCharacters(serializedCharacters: string | null): Character[] {
  if (!serializedCharacters) {
    return [];
  }

  try {
    const parsedCharacters: unknown = JSON.parse(serializedCharacters);

    if (!Array.isArray(parsedCharacters)) {
      return [];
    }

    return parsedCharacters.filter(isCharacter);
  } catch {
    return [];
  }
}

export function loadCharactersFromStorage(): Character[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const storedCharacters = window.localStorage.getItem(CHARACTER_STORAGE_KEY);

    return parseStoredCharacters(storedCharacters);
  } catch {
    return [];
  }
}

export function saveCharactersToStorage(characters: Character[]): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    window.localStorage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify(characters));

    return true;
  } catch {
    return false;
  }
}

export function subscribeToCharacterStorage(
  listener: (characters: Character[]) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  function handleStorageEvent(event: StorageEvent) {
    if (
      event.storageArea !== window.localStorage ||
      event.key !== CHARACTER_STORAGE_KEY
    ) {
      return;
    }

    listener(
      parseStoredCharacters(event.newValue),
    );
  }

  window.addEventListener('storage', handleStorageEvent);

  return () => {
    window.removeEventListener('storage', handleStorageEvent);
  };
}
