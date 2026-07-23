import { z } from 'zod';
import { loadCollection, parseCollection, saveCollection } from '@/core/localStorageCollection';
import type { PromptExperiment } from '../types';

export const PROMPT_EXPERIMENT_STORAGE_KEY = 'ai-creator-os.prompt-experiments.v1';
const optimizationSchema = z.object({ originalLength: z.number(), optimizedLength: z.number(), optimizedPrompt: z.string(), qualityScore: z.number(), issues: z.array(z.object({ type: z.enum(['length','redundancy','conflict','ambiguity','structure']), severity: z.enum(['low','medium','high']), message: z.string() })) });
const viralScoreSchema = z.object({ overall: z.number(), breakdown: z.object({ hook: z.number(), cta: z.number(), storytelling: z.number(), emotion: z.number(), clothing: z.number(), trend: z.number(), productFit: z.number(), clarity: z.number() }), strengths: z.array(z.string()), risks: z.array(z.string()) });
export const promptExperimentSchema = z.object({ id: z.string().min(1), name: z.string().min(1), prompt: z.string().min(1), version: z.number().int().min(1), parentId: z.string().optional(), campaignId: z.string().optional(), model: z.string(), userRating: z.number().min(0).max(10).optional(), performanceScore: z.number().min(0).max(100).optional(), optimization: optimizationSchema, viralScore: viralScoreSchema, createdAt: z.string().datetime() });
export const parseStoredPromptExperiments = (value: string | null) => parseCollection(value, promptExperimentSchema);
export const loadPromptExperiments = () => loadCollection(PROMPT_EXPERIMENT_STORAGE_KEY, promptExperimentSchema);
export const savePromptExperiments = (items: PromptExperiment[]) => saveCollection(PROMPT_EXPERIMENT_STORAGE_KEY, items);
