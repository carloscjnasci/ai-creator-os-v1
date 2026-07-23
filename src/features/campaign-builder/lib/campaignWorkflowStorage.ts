import { z } from 'zod';
import { CREATIVE_PLATFORMS } from '@/core/types';
import { loadCollection, parseCollection, saveCollection } from '@/core/localStorageCollection';
import type { CampaignWorkflow } from '../types';

export const CAMPAIGN_WORKFLOW_STORAGE_KEY = 'ai-creator-os.campaign-workflows.v1';
const viralScoreSchema = z.object({
  overall: z.number(),
  breakdown: z.object({ hook: z.number(), cta: z.number(), storytelling: z.number(), emotion: z.number(), clothing: z.number(), trend: z.number(), productFit: z.number(), clarity: z.number() }),
  strengths: z.array(z.string()), risks: z.array(z.string()),
});
export const campaignWorkflowSchema = z.object({
  id: z.string().min(1), campaignId: z.string().optional(), planId: z.string().optional(), executionRunId: z.string().optional(), name: z.string().min(1), objective: z.string(), platform: z.enum(CREATIVE_PLATFORMS), productId: z.string().optional(), digitalHumanId: z.string().optional(), wardrobeItemId: z.string().optional(), sceneId: z.string().optional(), poseId: z.string().optional(),
  promptStatus: z.enum(['pending', 'ready', 'approved']), imageStatus: z.enum(['pending', 'ready', 'approved']), videoStatus: z.enum(['pending', 'ready', 'approved']), publishingStatus: z.enum(['not-scheduled', 'scheduled', 'published']), analyticsStatus: z.enum(['waiting', 'collecting', 'complete']), viralScore: viralScoreSchema.optional(), updatedAt: z.string().datetime(), createdAt: z.string().datetime(),
});
export const parseStoredCampaignWorkflows = (value: string | null) => parseCollection(value, campaignWorkflowSchema);
export const loadCampaignWorkflows = () => loadCollection(CAMPAIGN_WORKFLOW_STORAGE_KEY, campaignWorkflowSchema);
export const saveCampaignWorkflows = (items: CampaignWorkflow[]) => saveCollection(CAMPAIGN_WORKFLOW_STORAGE_KEY, items);
