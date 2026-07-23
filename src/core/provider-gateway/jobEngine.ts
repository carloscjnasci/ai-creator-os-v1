import { buildExecutionProviderPackage } from '../execution-engine';
import { createId } from '../id';
import { getProviderDefinition } from './providerRegistry';
import type {
  CreateProviderJobInput,
  ProviderJob,
  ProviderJobAction,
  ProviderJobPatch,
  ProviderJobStatus,
  ProviderJobTransitionResult,
} from './types';

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createProviderJob(input: CreateProviderJobInput): ProviderJob {
  const now = input.now ?? new Date().toISOString();
  const provider = getProviderDefinition(input.providerId);
  if (!provider.executionDomains.includes(input.task.domain)) {
    throw new Error(`${provider.name} cannot execute ${input.task.domain} tasks.`);
  }

  const providerPackage = buildExecutionProviderPackage(input.plan, input.task);
  const providerContent = input.providerId === 'flow'
    ? input.plan.deliverables.flowPrompt
    : input.providerId === 'veo'
      ? input.plan.deliverables.veoPrompt
      : providerPackage.content;
  const providerTitle = input.providerId === 'flow'
    ? 'Flow video generation package'
    : input.providerId === 'veo'
      ? 'Veo video generation package'
      : providerPackage.title;
  const model = input.model?.trim() || provider.defaultModel;
  const idempotencyKey = [
    input.run.id,
    input.task.id,
    input.providerId,
    model,
    stableHash(providerContent),
  ].join(':');

  return {
    id: createId('provider-job'),
    idempotencyKey,
    providerId: input.providerId,
    model,
    status: 'queued',
    executionRunId: input.run.id,
    executionTaskId: input.task.id,
    planId: input.plan.id,
    campaignId: input.run.campaignId,
    request: {
      title: providerTitle,
      content: providerContent,
      suggestedFileName: providerPackage.suggestedFileName,
      parameters: {
        platform: input.plan.intent.platform,
        objective: input.plan.intent.objective,
        viralScore: input.plan.viralScore.overall,
        taskDomain: input.task.domain,
      },
    },
    attempt: 1,
    maxAttempts: provider.maxAttempts,
    createdAt: now,
    updatedAt: now,
  };
}

function nextStatus(current: ProviderJobStatus, action: ProviderJobAction): ProviderJobStatus | null {
  const transitions: Record<ProviderJobStatus, Partial<Record<ProviderJobAction, ProviderJobStatus>>> = {
    queued: { start: 'running', succeed: 'succeeded', fail: 'failed', cancel: 'cancelled' },
    running: { succeed: 'succeeded', fail: 'failed', cancel: 'cancelled' },
    succeeded: {},
    failed: { retry: 'queued' },
    cancelled: { retry: 'queued' },
  };
  return transitions[current][action] ?? null;
}

export function transitionProviderJob(
  job: ProviderJob,
  action: ProviderJobAction,
  patch: ProviderJobPatch = {},
  now = new Date().toISOString(),
): ProviderJobTransitionResult {
  const status = nextStatus(job.status, action);
  if (!status) {
    return { job, changed: false, error: `Action ${action} is not allowed while the job is ${job.status}.` };
  }
  if (action === 'retry' && job.attempt >= job.maxAttempts) {
    return { job, changed: false, error: 'The provider job reached its retry limit.' };
  }

  const nextJob: ProviderJob = {
    ...job,
    ...patch,
    status,
    attempt: action === 'retry' ? job.attempt + 1 : job.attempt,
    remoteJobId: action === 'retry' ? undefined : patch.remoteJobId ?? job.remoteJobId,
    response: action === 'retry' ? undefined : patch.response ?? job.response,
    errorCode: action === 'retry' ? undefined : patch.errorCode,
    errorMessage: action === 'retry' ? undefined : patch.errorMessage,
    startedAt: status === 'running' ? job.startedAt ?? now : job.startedAt,
    completedAt: ['succeeded', 'failed', 'cancelled'].includes(status) ? now : undefined,
    updatedAt: now,
  };
  return { job: nextJob, changed: true };
}

export function findIdempotentProviderJob(jobs: ProviderJob[], candidate: ProviderJob): ProviderJob | undefined {
  return jobs.find((job) =>
    job.idempotencyKey === candidate.idempotencyKey &&
    ['queued', 'running', 'succeeded'].includes(job.status),
  );
}

export function isProviderJobActive(job: ProviderJob): boolean {
  return job.status === 'queued' || job.status === 'running';
}
