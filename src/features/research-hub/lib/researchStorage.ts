import { z } from 'zod';
import { CREATIVE_PLATFORMS } from '@/core/types';
import { loadCollection, parseCollection, saveCollection, subscribeToCollection } from '@/core/localStorageCollection';
import type { TrendSignal } from '../types';

export const RESEARCH_SIGNAL_STORAGE_KEY = 'ai-creator-os.research-signals.v1';
export const trendSignalSchema = z.object({
  id: z.string().min(1),
  platform: z.enum(CREATIVE_PLATFORMS),
  topic: z.string().min(1),
  sourceUrl: z.string(),
  summary: z.string(),
  views: z.number().finite().min(0),
  baselineViews: z.number().finite().min(0),
  outlierMultiplier: z.number().finite().min(0),
  tags: z.array(z.string()),
  capturedAt: z.string().datetime(),
});
export const parseStoredResearchSignals = (value: string | null) => parseCollection(value, trendSignalSchema);
export const loadResearchSignals = () => loadCollection(RESEARCH_SIGNAL_STORAGE_KEY, trendSignalSchema);
export const saveResearchSignals = (items: TrendSignal[]) => saveCollection(RESEARCH_SIGNAL_STORAGE_KEY, items);
export const subscribeToResearchSignals = (listener: (items: TrendSignal[]) => void) => subscribeToCollection(RESEARCH_SIGNAL_STORAGE_KEY, trendSignalSchema, listener);
