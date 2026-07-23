import type { CreativePlan } from '../types';
import type { ExecutionRun, ExecutionTask } from '../execution-engine';

export const AI_PROVIDER_IDS = ['mock', 'gemini', 'imagen', 'flow', 'veo'] as const;
export type AIProviderId = (typeof AI_PROVIDER_IDS)[number];

export const AI_PROVIDER_CAPABILITIES = ['text', 'image', 'video'] as const;
export type AIProviderCapability = (typeof AI_PROVIDER_CAPABILITIES)[number];

export const PROVIDER_JOB_STATUSES = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
] as const;
export type ProviderJobStatus = (typeof PROVIDER_JOB_STATUSES)[number];

export interface ProviderDefinition {
  id: AIProviderId;
  name: string;
  description: string;
  capabilities: AIProviderCapability[];
  executionDomains: ExecutionTask['domain'][];
  defaultModel: string;
  connectionMode: 'local-mock' | 'secure-gateway';
  availability: 'available' | 'requires-backend';
  supportsCancellation: boolean;
  supportsPolling: boolean;
  maxAttempts: number;
}

export interface ProviderConnectionPreference {
  id: string;
  providerId: AIProviderId;
  enabled: boolean;
  defaultModel: string;
  updatedAt: string;
}

export interface ProviderJobRequest {
  title: string;
  content: string;
  suggestedFileName: string;
  parameters: Record<string, string | number | boolean>;
}

export interface ProviderJobResponse {
  outputText?: string;
  outputUrl?: string;
  mimeType?: string;
  providerMetadata?: Record<string, string | number | boolean>;
}

export interface ProviderJob {
  id: string;
  idempotencyKey: string;
  providerId: AIProviderId;
  model: string;
  status: ProviderJobStatus;
  executionRunId: string;
  executionTaskId: string;
  planId: string;
  campaignId?: string;
  remoteJobId?: string;
  request: ProviderJobRequest;
  response?: ProviderJobResponse;
  attempt: number;
  maxAttempts: number;
  estimatedCostUsd?: number;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
}

export interface CreateProviderJobInput {
  providerId: AIProviderId;
  model?: string;
  run: ExecutionRun;
  task: ExecutionTask;
  plan: CreativePlan;
  now?: string;
}

export type ProviderJobAction = 'start' | 'succeed' | 'fail' | 'cancel' | 'retry';

export interface ProviderJobPatch {
  remoteJobId?: string;
  response?: ProviderJobResponse;
  estimatedCostUsd?: number;
  errorCode?: string;
  errorMessage?: string;
}

export interface ProviderJobTransitionResult {
  job: ProviderJob;
  changed: boolean;
  error?: string;
}

export interface ProviderAdapterSubmission {
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  remoteJobId?: string;
  response?: ProviderJobResponse;
  estimatedCostUsd?: number;
  errorCode?: string;
  errorMessage?: string;
}

export interface ProviderAdapterPollResult {
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  response?: ProviderJobResponse;
  estimatedCostUsd?: number;
  errorCode?: string;
  errorMessage?: string;
}

export interface ProviderAdapter {
  submit(job: ProviderJob): Promise<ProviderAdapterSubmission>;
  poll(job: ProviderJob): Promise<ProviderAdapterPollResult>;
  cancel(job: ProviderJob): Promise<boolean>;
}
