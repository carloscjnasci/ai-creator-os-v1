import { z } from 'zod';
import { CREATIVE_OBJECTIVES, CREATIVE_PLATFORMS } from '@/core/types';
import { loadCollection, parseCollection, saveCollection } from '@/core/localStorageCollection';
import type { CreativePlan } from '@/core/types';

export const CREATIVE_PLAN_STORAGE_KEY = 'ai-creator-os.creative-plans.v1';
const scoreSchema = z.object({ overall: z.number(), breakdown: z.object({ hook: z.number(), cta: z.number(), storytelling: z.number(), emotion: z.number(), clothing: z.number(), trend: z.number(), productFit: z.number(), clarity: z.number() }), strengths: z.array(z.string()), risks: z.array(z.string()) });
const intentSchema = z.object({ id: z.string(), goal: z.string(), targetAudience: z.string(), platform: z.enum(CREATIVE_PLATFORMS), objective: z.enum(CREATIVE_OBJECTIVES), productId: z.string().optional(), digitalHumanId: z.string().optional(), createdAt: z.string().datetime() });
const stepSchema = z.object({ id: z.string(), order: z.number(), label: z.string(), domain: z.enum(['strategy','product','digital-human','wardrobe','scene','prompt','image','video','publishing','analytics']), status: z.enum(['ready','blocked','completed']), description: z.string(), provider: z.string().optional() });
export const creativePlanSchema = z.object({ id: z.string(), intent: intentSchema, campaignName: z.string(), strategy: z.string(), selectedCharacterId: z.string().optional(), selectedProductId: z.string().optional(), selectedWardrobeItemId: z.string().optional(), selectedSceneId: z.string().optional(), selectedPoseId: z.string().optional(), deliverables: z.object({ hook: z.string(), script: z.array(z.string()), imagePrompt: z.string(), videoPrompt: z.string(), flowPrompt: z.string(), veoPrompt: z.string(), thumbnailConcept: z.string(), title: z.string(), caption: z.string(), hashtags: z.array(z.string()) }), executionPlan: z.array(stepSchema), viralScore: scoreSchema, createdAt: z.string().datetime() });
export const parseStoredCreativePlans = (value: string | null) => parseCollection(value, creativePlanSchema);
export const loadCreativePlans = () => loadCollection(CREATIVE_PLAN_STORAGE_KEY, creativePlanSchema);
export const saveCreativePlans = (items: CreativePlan[]) => saveCollection(CREATIVE_PLAN_STORAGE_KEY, items);
