import type { CreativePlan, ExecutionPlanStep } from '../types';

export const EXECUTION_PROVIDERS = [
  'cos',
  'gemini',
  'imagen',
  'flow',
  'veo',
  'manual',
  'publishing',
  'analytics',
] as const;

export type ExecutionProvider = (typeof EXECUTION_PROVIDERS)[number];

export const EXECUTION_TASK_STATUSES = [
  'blocked',
  'ready',
  'in-progress',
  'review',
  'completed',
  'failed',
  'skipped',
] as const;

export type ExecutionTaskStatus = (typeof EXECUTION_TASK_STATUSES)[number];

export const EXECUTION_RUN_STATUSES = [
  'draft',
  'active',
  'blocked',
  'completed',
  'cancelled',
] as const;

export type ExecutionRunStatus = (typeof EXECUTION_RUN_STATUSES)[number];

export interface ExecutionTask {
  id: string;
  stepId: string;
  order: number;
  label: string;
  domain: ExecutionPlanStep['domain'];
  provider: ExecutionProvider;
  status: ExecutionTaskStatus;
  instruction: string;
  dependsOnTaskIds: string[];
  requirementBlocked: boolean;
  blockedReason?: string;
  outputUrl?: string;
  outputText?: string;
  notes?: string;
  creativeAssetId?: string;
  promptExperimentId?: string;
  providerJobId?: string;
  providerModel?: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
}

export interface ExecutionRun {
  id: string;
  planId: string;
  campaignId?: string;
  workflowId?: string;
  name: string;
  status: ExecutionRunStatus;
  progress: number;
  tasks: ExecutionTask[];
  createdAt: string;
  updatedAt: string;
}

export type ExecutionTaskAction =
  | 'start'
  | 'send-to-review'
  | 'complete'
  | 'fail'
  | 'retry'
  | 'skip'
  | 'reopen'
  | 'unblock';

export interface ExecutionTaskPatch {
  outputUrl?: string;
  outputText?: string;
  notes?: string;
  creativeAssetId?: string;
  promptExperimentId?: string;
  providerJobId?: string;
  providerModel?: string;
}

export interface ExecutionTransitionResult {
  run: ExecutionRun;
  changed: boolean;
  error?: string;
}

export interface ExecutionProviderPackage {
  provider: ExecutionProvider;
  title: string;
  content: string;
  suggestedFileName: string;
}

export interface CreateExecutionRunContext {
  campaignId?: string;
  workflowId?: string;
  now?: string;
}

export type ExecutionPlanLike = Pick<
  CreativePlan,
  | 'id'
  | 'campaignName'
  | 'strategy'
  | 'executionPlan'
  | 'deliverables'
  | 'viralScore'
  | 'intent'
  | 'selectedCharacterId'
  | 'selectedProductId'
  | 'selectedWardrobeItemId'
  | 'selectedSceneId'
  | 'selectedPoseId'
>;
