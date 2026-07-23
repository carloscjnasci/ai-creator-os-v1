import { loadCollection, parseCollection, saveCollection, subscribeToCollection } from '@/core/localStorageCollection';
import type { PublicationDraft, PublishingConnectionPreference, PublishingJob } from '../types';
import { publicationDraftSchema, publishingConnectionSchema, publishingJobSchema } from './publishingSchemas';

export const PUBLICATION_DRAFT_STORAGE_KEY = 'ai-creator-os.publication-drafts.v1';
export const PUBLISHING_JOB_STORAGE_KEY = 'ai-creator-os.publishing-jobs.v1';
export const PUBLISHING_CONNECTION_STORAGE_KEY = 'ai-creator-os.publishing-connections.v1';
export const PUBLISHING_STORAGE_CHANGED_EVENT = 'ai-creator-os:publishing-storage-changed';

function notifyPublishingStorageChanged(key: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(PUBLISHING_STORAGE_CHANGED_EVENT, { detail: { key } }));
}

function saveValidatedAndNotify<T>(key: string, items: T[], schema: { safeParse(value: unknown): { success: boolean; data?: T } }): boolean {
  const normalized = items.flatMap((item) => {
    const parsed = schema.safeParse(item);
    return parsed.success && parsed.data ? [parsed.data] : [];
  });
  const saved = saveCollection(key, normalized);
  if (saved) notifyPublishingStorageChanged(key);
  return saved;
}

function subscribeWithSameTab<T>(key: string, schema: Parameters<typeof subscribeToCollection<T>>[1], loader: () => T[], listener: (items: T[]) => void): () => void {
  const cleanupStorage = subscribeToCollection(key, schema, listener);
  if (typeof window === 'undefined') return cleanupStorage;
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ key?: string }>).detail;
    if (detail?.key === key) listener(loader());
  };
  window.addEventListener(PUBLISHING_STORAGE_CHANGED_EVENT, handler);
  return () => {
    cleanupStorage();
    window.removeEventListener(PUBLISHING_STORAGE_CHANGED_EVENT, handler);
  };
}

export const parseStoredPublicationDrafts = (value: string | null) => parseCollection(value, publicationDraftSchema);
export const loadPublicationDrafts = () => loadCollection(PUBLICATION_DRAFT_STORAGE_KEY, publicationDraftSchema);
export const savePublicationDrafts = (items: PublicationDraft[]) => saveValidatedAndNotify(PUBLICATION_DRAFT_STORAGE_KEY, items, publicationDraftSchema);
export const subscribeToPublicationDrafts = (listener: (items: PublicationDraft[]) => void) => subscribeWithSameTab(PUBLICATION_DRAFT_STORAGE_KEY, publicationDraftSchema, loadPublicationDrafts, listener);

export const parseStoredPublishingJobs = (value: string | null) => parseCollection(value, publishingJobSchema);
export const loadPublishingJobs = () => loadCollection(PUBLISHING_JOB_STORAGE_KEY, publishingJobSchema);
export const savePublishingJobs = (items: PublishingJob[]) => saveValidatedAndNotify(PUBLISHING_JOB_STORAGE_KEY, items, publishingJobSchema);
export const subscribeToPublishingJobs = (listener: (items: PublishingJob[]) => void) => subscribeWithSameTab(PUBLISHING_JOB_STORAGE_KEY, publishingJobSchema, loadPublishingJobs, listener);

export const parseStoredPublishingConnections = (value: string | null) => parseCollection(value, publishingConnectionSchema);
export const loadPublishingConnections = () => loadCollection(PUBLISHING_CONNECTION_STORAGE_KEY, publishingConnectionSchema);
export const savePublishingConnections = (items: PublishingConnectionPreference[]) => saveValidatedAndNotify(PUBLISHING_CONNECTION_STORAGE_KEY, items, publishingConnectionSchema);
