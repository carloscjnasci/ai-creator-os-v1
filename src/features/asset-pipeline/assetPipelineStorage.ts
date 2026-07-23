import { CloudAssetRecord } from './types';
import { CloudAssetRecordSchema } from './assetPipelineSchemas';

export const ASSET_STORAGE_KEY = 'ai_creator_os_cloud_assets';

export interface StorageResult {
  success: boolean;
  error?: string;
}

/**
 * Safely parses serialized JSON into clean CloudAssetRecord objects.
 * Filters out malformed records so that valid records remain available.
 */
export function parseAssetRecords(serialized: string | null): CloudAssetRecord[] {
  if (!serialized) return [];
  try {
    const raw = JSON.parse(serialized);
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item) => {
      const parsed = CloudAssetRecordSchema.safeParse(item);
      return parsed.success ? [parsed.data as CloudAssetRecord] : [];
    });
  } catch {
    return [];
  }
}

/**
 * Safely loads registered asset pipeline records from local storage.
 * Malformed JSON returns a safe empty list.
 */
export function loadAssetRecords(): CloudAssetRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = window.localStorage.getItem(ASSET_STORAGE_KEY);
    return parseAssetRecords(data);
  } catch {
    return [];
  }
}

function deepSanitizeRecords(value: any): any {
  if (Array.isArray(value)) {
    return value.map(deepSanitizeRecords);
  }
  if (value !== null && typeof value === 'object') {
    // If it is a browser File, Blob, ArrayBuffer, or other raw binary representation, skip/do not persist
    if (
      (typeof window !== 'undefined' && (value instanceof File || value instanceof Blob || value instanceof ArrayBuffer)) ||
      value.constructor?.name === 'File' ||
      value.constructor?.name === 'Blob' ||
      value.constructor?.name === 'ArrayBuffer'
    ) {
      return undefined;
    }
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      const lowerK = k.toLowerCase();
      if (
        lowerK.includes('authorization') ||
        lowerK.includes('credential') ||
        lowerK.includes('secret') ||
        lowerK.includes('token') ||
        lowerK.includes('uploadurl') ||
        lowerK.includes('upload_url') ||
        lowerK.includes('signedurl') ||
        lowerK.includes('signed_url') ||
        lowerK.includes('uploadheader') ||
        lowerK.includes('upload_header') ||
        lowerK.includes('password')
      ) {
        continue;
      }

      let cleanedVal = v;
      if (typeof v === 'string') {
        const lowerV = v.toLowerCase();
        if (
          lowerV.startsWith('http') &&
          (lowerV.includes('signature=') ||
           lowerV.includes('expires=') ||
           lowerV.includes('token=') ||
           lowerV.includes('mock-token') ||
           lowerV.includes('sig='))
        ) {
          cleanedVal = undefined;
        }
      } else {
        cleanedVal = deepSanitizeRecords(v);
      }

      if (cleanedVal !== undefined) {
        cleaned[k] = cleanedVal;
      }
    }
    return cleaned;
  }
  return value;
}

/**
 * Persists asset records atomically in local storage.
 * Handles write limit failures gracefully and returns a clear result.
 */
export function saveAssetRecords(records: CloudAssetRecord[]): StorageResult {
  if (typeof window === 'undefined') {
    return { success: false, error: 'Storage context unavailable (non-browser)' };
  }
  try {
    const sanitized = deepSanitizeRecords(records);
    const serialized = JSON.stringify(sanitized);
    window.localStorage.setItem(ASSET_STORAGE_KEY, serialized);
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Storage quota exceeded or write failed',
    };
  }
}

/**
 * Subscribes a listener to changes in the asset pipeline storage collection.
 * Properly ignores unrelated storage key updates and supports clean teardown.
 */
export function subscribeToAssetRecords(
  listener: (records: CloudAssetRecord[]) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const handler = (event: StorageEvent) => {
    // Check that storageArea matches and key is our asset key
    if (event.storageArea !== window.localStorage || event.key !== ASSET_STORAGE_KEY) {
      return;
    }
    listener(parseAssetRecords(event.newValue));
  };

  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener('storage', handler);
  };
}
