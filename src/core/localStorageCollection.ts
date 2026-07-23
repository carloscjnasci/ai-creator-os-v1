import type { ZodType } from 'zod';

export function parseCollection<T>(serialized: string | null, schema: ZodType<T>): T[] {
  if (!serialized) return [];
  try {
    const value: unknown = JSON.parse(serialized);
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
      const result = schema.safeParse(entry);
      return result.success ? [result.data] : [];
    });
  } catch {
    return [];
  }
}

export function loadCollection<T>(key: string, schema: ZodType<T>): T[] {
  if (typeof window === 'undefined') return [];
  try {
    return parseCollection(window.localStorage.getItem(key), schema);
  } catch {
    return [];
  }
}

export function saveCollection<T>(key: string, items: T[]): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

export function subscribeToCollection<T>(
  key: string,
  schema: ZodType<T>,
  listener: (items: T[]) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = (event: StorageEvent) => {
    if (event.storageArea !== window.localStorage || event.key !== key) return;
    listener(parseCollection(event.newValue, schema));
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
