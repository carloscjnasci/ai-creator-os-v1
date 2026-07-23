import { z } from 'zod';
import {
  EXECUTION_PROVIDERS,
  EXECUTION_RUN_STATUSES,
  EXECUTION_TASK_STATUSES,
  type ExecutionRun,
} from '@/core/execution-engine';
import { loadCollection, parseCollection, saveCollection, subscribeToCollection } from '@/core/localStorageCollection';

export const EXECUTION_RUN_STORAGE_KEY = 'ai-creator-os.execution-runs.v1';

const taskSchema = z.object({
  id: z.string().min(1),
  stepId: z.string().min(1),
  order: z.number().int().min(1),
  label: z.string().min(1),
  domain: z.enum(['strategy','product','digital-human','wardrobe','scene','prompt','image','video','publishing','analytics']),
  provider: z.enum(EXECUTION_PROVIDERS),
  status: z.enum(EXECUTION_TASK_STATUSES),
  instruction: z.string(),
  dependsOnTaskIds: z.array(z.string()),
  requirementBlocked: z.boolean(),
  blockedReason: z.string().optional(),
  outputUrl: z.string().optional(),
  outputText: z.string().optional(),
  notes: z.string().optional(),
  creativeAssetId: z.string().optional(),
  promptExperimentId: z.string().optional(),
  providerJobId: z.string().optional(),
  providerModel: z.string().optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime(),
});

export const executionRunSchema = z.object({
  id: z.string().min(1),
  planId: z.string().min(1),
  campaignId: z.string().optional(),
  workflowId: z.string().optional(),
  name: z.string().min(1),
  status: z.enum(EXECUTION_RUN_STATUSES),
  progress: z.number().int().min(0).max(100),
  tasks: z.array(taskSchema).min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const parseStoredExecutionRuns = (value: string | null) => parseCollection(value, executionRunSchema);
export const loadExecutionRuns = () => loadCollection(EXECUTION_RUN_STORAGE_KEY, executionRunSchema);
export const saveExecutionRuns = (items: ExecutionRun[]) => saveCollection(EXECUTION_RUN_STORAGE_KEY, items);
export const subscribeToExecutionRuns = (listener: (items: ExecutionRun[]) => void) => subscribeToCollection(EXECUTION_RUN_STORAGE_KEY, executionRunSchema, listener);
