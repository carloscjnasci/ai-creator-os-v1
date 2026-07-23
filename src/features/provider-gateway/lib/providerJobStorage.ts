import { z } from 'zod';
import {
  AI_PROVIDER_IDS,
  PROVIDER_JOB_STATUSES,
  type ProviderJob,
} from '@/core/provider-gateway';
import { loadCollection, parseCollection, saveCollection, subscribeToCollection } from '@/core/localStorageCollection';

export const PROVIDER_JOB_STORAGE_KEY = 'ai-creator-os.provider-jobs.v1';

const responseSchema = z.object({
  outputText: z.string().optional(),
  outputUrl: z.string().optional(),
  mimeType: z.string().optional(),
  providerMetadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const providerJobSchema = z.object({
  id: z.string().min(1),
  idempotencyKey: z.string().min(1),
  providerId: z.enum(AI_PROVIDER_IDS),
  model: z.string().min(1),
  status: z.enum(PROVIDER_JOB_STATUSES),
  executionRunId: z.string().min(1),
  executionTaskId: z.string().min(1),
  planId: z.string().min(1),
  campaignId: z.string().optional(),
  remoteJobId: z.string().optional(),
  request: z.object({
    title: z.string().min(1),
    content: z.string(),
    suggestedFileName: z.string().min(1),
    parameters: z.record(z.union([z.string(), z.number(), z.boolean()])),
  }),
  response: responseSchema.optional(),
  attempt: z.number().int().min(1),
  maxAttempts: z.number().int().min(1),
  estimatedCostUsd: z.number().finite().min(0).optional(),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime(),
});

export const parseStoredProviderJobs = (value: string | null) => parseCollection(value, providerJobSchema);
export const loadProviderJobs = () => loadCollection(PROVIDER_JOB_STORAGE_KEY, providerJobSchema);
export const saveProviderJobs = (jobs: ProviderJob[]) => saveCollection(PROVIDER_JOB_STORAGE_KEY, jobs);
export const subscribeToProviderJobs = (listener: (jobs: ProviderJob[]) => void) =>
  subscribeToCollection(PROVIDER_JOB_STORAGE_KEY, providerJobSchema, listener);
