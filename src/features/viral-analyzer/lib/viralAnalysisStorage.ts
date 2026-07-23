import { z } from 'zod';
import { CREATIVE_PLATFORMS } from '@/core/types';
import { loadCollection, parseCollection, saveCollection } from '@/core/localStorageCollection';
import type { SavedViralAnalysis } from '../types';

export const VIRAL_ANALYSIS_STORAGE_KEY = 'ai-creator-os.viral-analyses.v1';
const scoreSchema = z.object({
  overall: z.number().min(0).max(100),
  breakdown: z.object({
    hook: z.number(), cta: z.number(), storytelling: z.number(), emotion: z.number(), clothing: z.number(), trend: z.number(), productFit: z.number(), clarity: z.number(),
  }),
  strengths: z.array(z.string()),
  risks: z.array(z.string()),
});
export const viralAnalysisSchema = z.object({
  id: z.string().min(1),
  platform: z.enum(CREATIVE_PLATFORMS),
  sourceUrl: z.string(),
  notes: z.string(),
  digitalHumanId: z.string().optional(),
  productId: z.string().optional(),
  hook: z.string(), storytelling: z.string(), cta: z.string(), camera: z.string(), lighting: z.string(), emotion: z.string(), caption: z.string(), hashtags: z.array(z.string()), audio: z.string(), scene: z.string(), clothing: z.string(), expression: z.string(), pose: z.string(), rhythm: z.string(), adaptedPrompt: z.string(),
  viralScore: scoreSchema,
  createdAt: z.string().datetime(),
});
export const parseStoredViralAnalyses = (value: string | null) => parseCollection(value, viralAnalysisSchema);
export const loadViralAnalyses = () => loadCollection(VIRAL_ANALYSIS_STORAGE_KEY, viralAnalysisSchema);
export const saveViralAnalyses = (items: SavedViralAnalysis[]) => saveCollection(VIRAL_ANALYSIS_STORAGE_KEY, items);
