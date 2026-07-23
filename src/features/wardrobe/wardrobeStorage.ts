import type { WardrobeItem } from './types';

export const WARDROBE_STORAGE_KEY = 'ai-creator-os.wardrobe.v1';

export function loadWardrobeItemsFromStorage(): WardrobeItem[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const stored = window.localStorage.getItem(WARDROBE_STORAGE_KEY);
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is WardrobeItem => {
      return (
        item &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        item.id.trim() !== '' &&
        typeof item.name === 'string' &&
        item.name.trim() !== '' &&
        typeof item.description === 'string' &&
        typeof item.createdAt === 'string' &&
        item.createdAt.trim() !== ''
      );
    });
  } catch {
    return [];
  }
}

export function saveWardrobeItemsToStorage(items: WardrobeItem[]): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    window.localStorage.setItem(WARDROBE_STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}
