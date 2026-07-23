import {
  createProviderAdapter,
  createProviderJob,
  findIdempotentProviderJob,
  publishCreativeEvent,
  transitionExecutionTask,
  transitionProviderJob,
  updateExecutionTaskOutput,
  type AIProviderId,
  type CreativePlan,
  type ExecutionRun,
  type ExecutionTask,
  type ProviderAdapterPollResult,
  type ProviderJob,
} from '@/core';
import { loadCreativePlans } from '@/features/ai-director/lib/creativePlanStorage';
import { loadExecutionRuns, saveExecutionRuns } from '@/features/execution-center/lib/executionRunStorage';
import { registerExecutionOutput, syncCampaignWorkflowFromExecution } from '@/features/execution-center/lib/executionIntegrations';
import { loadProviderConnections } from './providerConnectionStorage';
import { loadProviderJobs, saveProviderJobs } from './providerJobStorage';
import { assetPipelineService, detectAssetType } from '@/features/asset-pipeline/assetPipelineService';

export interface ProviderGatewayOperationResult {
  job?: ProviderJob;
  run?: ExecutionRun;
  changed: boolean;
  error?: string;
}

function persistJob(job: ProviderJob): boolean {
  return saveProviderJobs([job, ...loadProviderJobs().filter((item) => item.id !== job.id)]);
}

function persistRun(run: ExecutionRun): boolean {
  const saved = saveExecutionRuns([run, ...loadExecutionRuns().filter((item) => item.id !== run.id)]);
  if (saved) syncCampaignWorkflowFromExecution(run);
  return saved;
}

function getContext(job: ProviderJob): { plan: CreativePlan; run: ExecutionRun; task: ExecutionTask } | null {
  const plan = loadCreativePlans().find((item) => item.id === job.planId);
  const run = loadExecutionRuns().find((item) => item.id === job.executionRunId);
  const task = run?.tasks.find((item) => item.id === job.executionTaskId);
  return plan && run && task ? { plan, run, task } : null;
}

function failExecutionTask(job: ProviderJob, errorMessage: string): ExecutionRun | undefined {
  const context = getContext(job);
  if (!context) return undefined;
  let run = context.run;
  const task = run.tasks.find((item) => item.id === job.executionTaskId);
  if (!task) return undefined;
  if (task.status === 'ready') run = transitionExecutionTask(run, task.id, 'start').run;
  const activeTask = run.tasks.find((item) => item.id === task.id);
  if (activeTask && (activeTask.status === 'in-progress' || activeTask.status === 'review')) {
    run = transitionExecutionTask(run, task.id, 'fail', {
      providerJobId: job.id,
      providerModel: job.model,
      notes: [task.notes, errorMessage].filter(Boolean).join('\n'),
    }).run;
    persistRun(run);
  }
  return run;
}

async function applySucceededJob(job: ProviderJob): Promise<ExecutionRun | undefined> {
  const context = getContext(job);
  if (!context) return undefined;
  let run = context.run;
  let task = run.tasks.find((item) => item.id === job.executionTaskId);
  if (!task) return undefined;

  if (task.status === 'ready') {
    run = transitionExecutionTask(run, task.id, 'start', {
      providerJobId: job.id,
      providerModel: job.model,
    }).run;
    task = run.tasks.find((item) => item.id === job.executionTaskId);
  }

  if (!task || !['in-progress', 'review'].includes(task.status)) return run;

  const isPipelineAssetType = ['image', 'video', 'audio', 'document'].includes(task.domain as string);
  if (isPipelineAssetType && job.response?.outputUrl) {
    // Set initial successful metadata on task
    run = updateExecutionTaskOutput(run, task.id, {
      providerJobId: job.id,
      providerModel: job.model,
      outputUrl: job.response?.outputUrl,
      outputText: job.response?.outputText,
    }).run;
    persistRun(run);

    // Transition execution task to complete
    run = transitionExecutionTask(run, task.id, 'complete').run;
    persistRun(run);

    // Call asset pipeline service to ingest and synchronize
    const detectedType = detectAssetType((task.domain as string) === 'document' ? 'application/pdf' : `${task.domain}/mock`);
    await assetPipelineService.ingestProviderResult({
      providerJobId: job.id,
      outputUrl: job.response.outputUrl,
      assetType: detectedType,
      displayName: `${run.name} — ${task.label}`,
      campaignId: run.campaignId,
      executionTaskId: task.id,
      executionId: run.id,
      workspaceId: 'default-workspace',
      modelProvider: job.providerId,
      modelName: job.model,
    });

    // Reload execution run as it was updated by downstream sync
    const reloadedRuns = loadExecutionRuns();
    run = reloadedRuns.find((item) => item.id === job.executionRunId) || run;
  } else {
    // Fallback/legacy workflow for texts and manual assets
    run = updateExecutionTaskOutput(run, task.id, {
      providerJobId: job.id,
      providerModel: job.model,
      outputUrl: job.response?.outputUrl,
      outputText: job.response?.outputText,
      notes: [task.notes, `Provider job ${job.id} succeeded with ${job.providerId}/${job.model}.`]
        .filter(Boolean)
        .join('\n'),
    }).run;
    run = transitionExecutionTask(run, task.id, 'complete').run;

    const completedTask = run.tasks.find((item) => item.id === task?.id);
    if (completedTask) {
      const registered = registerExecutionOutput(run, completedTask, context.plan);
      if (registered.creativeAssetId || registered.promptExperimentId) {
        run = updateExecutionTaskOutput(run, completedTask.id, registered).run;
      }
    }
    persistRun(run);
  }

  publishCreativeEvent('provider.job.completed', { jobId: job.id, runId: run.id, taskId: task.id });
  publishCreativeEvent('execution.task.updated', { runId: run.id, taskId: task.id, action: 'provider-complete' });
  return run;
}

async function applyAdapterResult(job: ProviderJob, result: ProviderAdapterPollResult): Promise<ProviderGatewayOperationResult> {
  if (result.status === 'queued') {
    const queued = { ...job, updatedAt: new Date().toISOString() };
    persistJob(queued);
    publishCreativeEvent('provider.job.updated', queued);
    return { job: queued, changed: true };
  }
  if (result.status === 'running') {
    const transitioned = job.status === 'queued'
      ? transitionProviderJob(job, 'start', { estimatedCostUsd: result.estimatedCostUsd })
      : { job: { ...job, estimatedCostUsd: result.estimatedCostUsd, updatedAt: new Date().toISOString() }, changed: true };
    persistJob(transitioned.job);
    publishCreativeEvent('provider.job.updated', transitioned.job);
    return { job: transitioned.job, changed: true };
  }
  if (result.status === 'succeeded') {
    const transitioned = transitionProviderJob(job, 'succeed', {
      response: result.response,
      estimatedCostUsd: result.estimatedCostUsd,
    });
    if (!transitioned.changed) return { job, changed: false, error: transitioned.error };
    persistJob(transitioned.job);
    const run = await applySucceededJob(transitioned.job);
    return { job: transitioned.job, run, changed: true };
  }
  const action = result.status === 'cancelled' ? 'cancel' : 'fail';
  const transitioned = transitionProviderJob(job, action, {
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
    estimatedCostUsd: result.estimatedCostUsd,
  });
  if (!transitioned.changed) return { job, changed: false, error: transitioned.error };
  persistJob(transitioned.job);
  const run = failExecutionTask(transitioned.job, result.errorMessage ?? `Provider job ${result.status}.`);
  publishCreativeEvent('provider.job.updated', transitioned.job);
  return { job: transitioned.job, run, changed: true };
}

export async function dispatchExecutionTaskToProvider(input: {
  run: ExecutionRun;
  task: ExecutionTask;
  plan: CreativePlan;
  providerId: AIProviderId;
  model?: string;
}): Promise<ProviderGatewayOperationResult> {
  if (input.task.status !== 'ready') {
    return { changed: false, error: 'Only ready tasks can be dispatched to a provider.' };
  }
  const connection = loadProviderConnections().find((item) => item.providerId === input.providerId);
  if (!connection?.enabled) {
    return { changed: false, error: 'Enable this provider in Provider Gateway before dispatching.' };
  }

  let candidate: ProviderJob;
  try {
    candidate = createProviderJob({
      providerId: input.providerId,
      model: input.model || connection.defaultModel,
      run: input.run,
      task: input.task,
      plan: input.plan,
    });
  } catch (error) {
    return { changed: false, error: error instanceof Error ? error.message : 'Unable to create provider job.' };
  }

  const existing = findIdempotentProviderJob(loadProviderJobs(), candidate);
  if (existing) {
    const run = existing.status === 'succeeded' ? await applySucceededJob(existing) : undefined;
    return { job: existing, run, changed: false, error: 'An equivalent active or completed job already exists.' };
  }
  if (!persistJob(candidate)) return { changed: false, error: 'Unable to persist the provider job.' };

  const started = transitionExecutionTask(input.run, input.task.id, 'start', {
    providerJobId: candidate.id,
    providerModel: candidate.model,
  });
  if (!started.changed || !persistRun(started.run)) {
    const failed = transitionProviderJob(candidate, 'fail', { errorMessage: 'Unable to start the execution task.' });
    if (failed.changed) persistJob(failed.job);
    return { job: failed.job, changed: false, error: started.error ?? 'Unable to start the execution task.' };
  }

  publishCreativeEvent('provider.job.created', candidate);
  try {
    const adapter = createProviderAdapter(candidate.providerId);
    const submission = await adapter.submit(candidate);
    let submitted = candidate;
    if (submission.remoteJobId) {
      submitted = { ...submitted, remoteJobId: submission.remoteJobId, updatedAt: new Date().toISOString() };
      persistJob(submitted);
    }
    return applyAdapterResult(submitted, {
      status: submission.status,
      response: submission.response,
      estimatedCostUsd: submission.estimatedCostUsd,
      errorCode: submission.errorCode,
      errorMessage: submission.errorMessage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Provider submission failed.';
    const failed = transitionProviderJob(candidate, 'fail', { errorCode: 'SUBMISSION_ERROR', errorMessage: message });
    if (failed.changed) persistJob(failed.job);
    const run = failExecutionTask(failed.job, message);
    return { job: failed.job, run, changed: true, error: message };
  }
}

export async function pollProviderJob(jobId: string): Promise<ProviderGatewayOperationResult> {
  const job = loadProviderJobs().find((item) => item.id === jobId);
  if (!job) return { changed: false, error: 'Provider job was not found.' };
  if (!['queued', 'running'].includes(job.status)) return { job, changed: false, error: 'Only active jobs can be polled.' };
  try {
    const result = await createProviderAdapter(job.providerId).poll(job);
    return applyAdapterResult(job, result);
  } catch (error) {
    return { job, changed: false, error: error instanceof Error ? error.message : 'Provider polling failed.' };
  }
}

export async function cancelProviderJob(jobId: string): Promise<ProviderGatewayOperationResult> {
  const job = loadProviderJobs().find((item) => item.id === jobId);
  if (!job) return { changed: false, error: 'Provider job was not found.' };
  if (!['queued', 'running'].includes(job.status)) return { job, changed: false, error: 'Only active jobs can be cancelled.' };
  try {
    const cancelledRemotely = await createProviderAdapter(job.providerId).cancel(job);
    if (!cancelledRemotely) return { job, changed: false, error: 'The provider did not accept cancellation.' };
    const transitioned = transitionProviderJob(job, 'cancel', { errorMessage: 'Cancelled by the Workspace user.' });
    if (!transitioned.changed) return { job, changed: false, error: transitioned.error };
    persistJob(transitioned.job);
    const run = failExecutionTask(transitioned.job, 'Provider job cancelled.');
    publishCreativeEvent('provider.job.updated', transitioned.job);
    return { job: transitioned.job, run, changed: true };
  } catch (error) {
    return { job, changed: false, error: error instanceof Error ? error.message : 'Provider cancellation failed.' };
  }
}

export async function retryProviderJob(jobId: string): Promise<ProviderGatewayOperationResult> {
  const job = loadProviderJobs().find((item) => item.id === jobId);
  if (!job) return { changed: false, error: 'Provider job was not found.' };
  const retried = transitionProviderJob(job, 'retry');
  if (!retried.changed) return { job, changed: false, error: retried.error };
  const context = getContext(job);
  if (!context) return { job, changed: false, error: 'The linked execution context is unavailable.' };

  let run = context.run;
  const task = run.tasks.find((item) => item.id === job.executionTaskId);
  if (!task) return { job, changed: false, error: 'The linked execution task is unavailable.' };
  if (task.status === 'failed') run = transitionExecutionTask(run, task.id, 'retry').run;
  const readyTask = run.tasks.find((item) => item.id === task.id);
  if (!readyTask || readyTask.status !== 'ready') return { job, changed: false, error: 'The execution task is not ready for retry.' };
  run = transitionExecutionTask(run, readyTask.id, 'start', {
    providerJobId: retried.job.id,
    providerModel: retried.job.model,
  }).run;
  if (!persistRun(run) || !persistJob(retried.job)) return { changed: false, error: 'Unable to persist the retry state.' };
  publishCreativeEvent('provider.job.updated', retried.job);

  try {
    const submission = await createProviderAdapter(retried.job.providerId).submit(retried.job);
    const submitted = submission.remoteJobId
      ? { ...retried.job, remoteJobId: submission.remoteJobId, updatedAt: new Date().toISOString() }
      : retried.job;
    persistJob(submitted);
    return applyAdapterResult(submitted, {
      status: submission.status,
      response: submission.response,
      estimatedCostUsd: submission.estimatedCostUsd,
      errorCode: submission.errorCode,
      errorMessage: submission.errorMessage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Provider retry failed.';
    const failed = transitionProviderJob(retried.job, 'fail', { errorCode: 'RETRY_ERROR', errorMessage: message });
    if (failed.changed) persistJob(failed.job);
    const failedRun = failExecutionTask(failed.job, message);
    return { job: failed.job, run: failedRun, changed: true, error: message };
  }
}
