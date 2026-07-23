import { createId } from '@/core/id';
import { publishCreativeEvent, subscribeToCreativeEvents, type CreativeEvent } from '@/core/events/creativeEventBus';
import { transitionExecutionTask, updateExecutionTaskOutput } from '@/core/execution-engine/executionEngine';
import { loadCreativePlans } from '@/features/ai-director/lib/creativePlanStorage';
import { loadCampaignWorkflows, saveCampaignWorkflows } from '@/features/campaign-builder/lib/campaignWorkflowStorage';
import { loadCreativeAssets } from '@/features/creative-library/lib/creativeAssetStorage';
import { loadExecutionRuns, saveExecutionRuns } from '@/features/execution-center/lib/executionRunStorage';
import { syncCampaignWorkflowFromExecution } from '@/features/execution-center/lib/executionIntegrations';
import { mockPublishingAdapter } from '../adapters/mockPublishingAdapter';
import { manualPublishingAdapter } from '../adapters/manualPublishingAdapter';
import type {
  PublicationDraft,
  PublishingAdapter,
  PublishingConnectionPreference,
  PublishingJob,
  PublishingPlatform,
} from '../types';
import { PUBLISHING_PLATFORMS } from '../types';
import { normalizeHashtag, validatePublicationDraft } from './publishingPolicies';
import {
  loadPublicationDrafts,
  loadPublishingConnections,
  loadPublishingJobs,
  savePublicationDrafts,
  savePublishingConnections,
  savePublishingJobs,
} from './publishingStorage';

function stableKey(parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(':').toLowerCase();
}

function nowIso(now?: string): string {
  return now ?? new Date().toISOString();
}

function findAssetUrl(assetId?: string): string {
  if (!assetId) return '';
  const asset = loadCreativeAssets().find((item) => item.id === assetId);
  return asset?.sourceUrl || asset?.previewUrl || '';
}

function adapterForDraft(draft: PublicationDraft): PublishingAdapter {
  if (draft.adapterMode === 'mock') return mockPublishingAdapter;
  if (draft.adapterMode === 'manual') return manualPublishingAdapter;
  throw new Error('A secure publishing backend transport is required for this connection.');
}

function replaceDraft(draft: PublicationDraft): boolean {
  const current = loadPublicationDrafts();
  return savePublicationDrafts([draft, ...current.filter((item) => item.id !== draft.id)]);
}

function replaceJob(job: PublishingJob): boolean {
  const current = loadPublishingJobs();
  return savePublishingJobs([job, ...current.filter((item) => item.id !== job.id)]);
}

function requireDraft(id: string): PublicationDraft {
  const draft = loadPublicationDrafts().find((item) => item.id === id);
  if (!draft) throw new Error('Publication draft was not found.');
  return draft;
}

function refreshValidation(draft: PublicationDraft, now: string, allowDueSchedule = false): PublicationDraft {
  const asset = loadCreativeAssets().find((item) => item.id === draft.creativeAssetId);
  const validationInput = allowDueSchedule ? { ...draft, scheduledAt: undefined } : draft;
  return { ...draft, validation: validatePublicationDraft(validationInput, asset, now), updatedAt: now };
}

export function getDefaultPublishingConnections(now = new Date().toISOString()): PublishingConnectionPreference[] {
  return PUBLISHING_PLATFORMS.map((platform) => ({
    id: `publishing-connection-${platform}`,
    platform,
    displayName: platform === 'generic' ? 'Manual export' : `${platform} channel`,
    accountLabel: '',
    status: 'mock-ready',
    adapterMode: platform === 'generic' ? 'manual' : 'mock',
    enabled: true,
    lastVerifiedAt: now,
    updatedAt: now,
  }));
}

export function ensurePublishingConnections(now = new Date().toISOString()): PublishingConnectionPreference[] {
  const stored = loadPublishingConnections();
  if (stored.length > 0) return stored;
  const defaults = getDefaultPublishingConnections(now);
  savePublishingConnections(defaults);
  return defaults;
}

export interface CreateDraftFromWorkflowInput {
  workflowId: string;
  creativeAssetId?: string;
  timezone?: string;
  adapterMode?: PublicationDraft['adapterMode'];
  now?: string;
}

export function createDraftFromWorkflow(input: CreateDraftFromWorkflowInput): PublicationDraft {
  const workflow = loadCampaignWorkflows().find((item) => item.id === input.workflowId);
  if (!workflow) throw new Error('Campaign workflow was not found.');
  const plan = workflow.planId ? loadCreativePlans().find((item) => item.id === workflow.planId) : undefined;
  const matchingAssets = loadCreativeAssets().filter((asset) => !workflow.campaignId || asset.campaignId === workflow.campaignId);
  const selectedAsset = matchingAssets.find((asset) => asset.id === input.creativeAssetId)
    ?? matchingAssets.find((asset) => asset.type === 'video')
    ?? matchingAssets.find((asset) => asset.type === 'image');
  const run = workflow.executionRunId ? loadExecutionRuns().find((item) => item.id === workflow.executionRunId) : undefined;
  const publishingTask = run?.tasks.find((task) => task.domain === 'publishing');
  const platform = (PUBLISHING_PLATFORMS as readonly string[]).includes(workflow.platform)
    ? workflow.platform as PublishingPlatform
    : 'generic';
  const idempotencyKey = stableKey(['publication', workflow.id, platform, selectedAsset?.id ?? 'no-asset']);
  const existing = loadPublicationDrafts().find((item) => item.idempotencyKey === idempotencyKey && item.status !== 'archived');
  if (existing) return existing;
  const now = nowIso(input.now);
  const connection = ensurePublishingConnections(now).find((item) => item.platform === platform && item.enabled);
  const draftBase: PublicationDraft = {
    id: createId('publication'),
    workspaceId: 'default-workspace',
    campaignId: workflow.campaignId,
    workflowId: workflow.id,
    creativePlanId: plan?.id,
    executionRunId: run?.id,
    executionTaskId: publishingTask?.id,
    creativeAssetId: selectedAsset?.id,
    cloudAssetId: selectedAsset?.cloudAssetId,
    digitalHumanId: workflow.digitalHumanId,
    productId: workflow.productId,
    platform,
    connectionId: connection?.id ?? `publishing-connection-${platform}`,
    title: plan?.deliverables.title ?? workflow.name,
    caption: plan?.deliverables.caption ?? workflow.objective,
    hashtags: (plan?.deliverables.hashtags ?? []).map(normalizeHashtag).filter(Boolean),
    mentions: [],
    status: 'draft',
    approvalRequired: true,
    timezone: input.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
    adapterMode: input.adapterMode ?? connection?.adapterMode ?? (platform === 'generic' ? 'manual' : 'mock'),
    validation: { valid: false, issues: [], checkedAt: now, policyVersion: 'pending' },
    idempotencyKey,
    attemptCount: 0,
    metricsStatus: 'not-requested',
    createdAt: now,
    updatedAt: now,
  };
  const draft = refreshValidation(draftBase, now);
  if (!savePublicationDrafts([draft, ...loadPublicationDrafts()])) throw new Error('Unable to persist the publication draft.');
  publishCreativeEvent('publishing.draft.created', { publicationId: draft.id, workflowId: draft.workflowId, campaignId: draft.campaignId });
  return draft;
}

export function updatePublicationDraft(id: string, patch: Partial<Pick<PublicationDraft,
  'title' | 'caption' | 'hashtags' | 'mentions' | 'destinationUrl' | 'creativeAssetId' | 'thumbnailAssetId' | 'timezone' | 'adapterMode' | 'connectionId'
>>, now = new Date().toISOString()): PublicationDraft {
  const current = requireDraft(id);
  if (['publishing', 'published', 'archived'].includes(current.status)) throw new Error(`Published or archived content cannot be edited while ${current.status}.`);
  const draft = refreshValidation({ ...current, ...patch, status: current.status === 'approved' ? 'draft' : current.status }, now);
  if (!replaceDraft(draft)) throw new Error('Unable to save publication changes.');
  publishCreativeEvent('publishing.validation.completed', { publicationId: draft.id, valid: draft.validation.valid });
  return draft;
}

export function requestPublicationReview(id: string, now = new Date().toISOString()): PublicationDraft {
  const current = refreshValidation(requireDraft(id), now);
  if (!current.validation.valid) throw new Error('Resolve validation errors before requesting approval.');
  if (!['draft', 'failed', 'cancelled'].includes(current.status)) throw new Error('Only draft, failed or cancelled publications can enter review.');
  const draft: PublicationDraft = { ...current, status: 'in-review', failureCode: undefined, failureMessage: undefined, updatedAt: now };
  if (!replaceDraft(draft)) throw new Error('Unable to request publication review.');
  publishCreativeEvent('publishing.approval.requested', { publicationId: draft.id });
  return draft;
}

export function approvePublication(id: string, approvedBy = 'Workspace Owner', now = new Date().toISOString()): PublicationDraft {
  const current = refreshValidation(requireDraft(id), now);
  if (!current.validation.valid) throw new Error('Publication validation must pass before approval.');
  if (!['in-review', 'draft'].includes(current.status)) throw new Error('Publication is not awaiting approval.');
  const draft: PublicationDraft = { ...current, status: 'approved', approvedAt: now, approvedBy, rejectionReason: undefined, rejectedAt: undefined, updatedAt: now };
  if (!replaceDraft(draft)) throw new Error('Unable to approve publication.');
  publishCreativeEvent('publishing.approved', { publicationId: draft.id, approvedBy });
  return draft;
}

export function rejectPublication(id: string, reason: string, now = new Date().toISOString()): PublicationDraft {
  const current = requireDraft(id);
  if (current.status !== 'in-review') throw new Error('Only publications in review can be rejected.');
  const draft: PublicationDraft = { ...current, status: 'draft', rejectedAt: now, rejectionReason: reason.trim() || 'Changes requested.', approvedAt: undefined, approvedBy: undefined, updatedAt: now };
  if (!replaceDraft(draft)) throw new Error('Unable to reject publication.');
  publishCreativeEvent('publishing.rejected', { publicationId: draft.id, reason: draft.rejectionReason });
  return draft;
}

function updateWorkflowStatus(draft: PublicationDraft, status: 'scheduled' | 'published'): void {
  const workflows = loadCampaignWorkflows();
  const index = workflows.findIndex((item) => item.id === draft.workflowId || (draft.campaignId && item.campaignId === draft.campaignId));
  if (index < 0) return;
  const next = workflows.slice();
  next[index] = { ...next[index], publishingStatus: status, analyticsStatus: status === 'published' ? 'collecting' : next[index].analyticsStatus, updatedAt: new Date().toISOString() };
  saveCampaignWorkflows(next);
}

export function schedulePublication(id: string, scheduledAt: string, timezone: string, now = new Date().toISOString()): PublicationDraft {
  const current = requireDraft(id);
  if (current.status !== 'approved') throw new Error('Approve the publication before scheduling.');
  const draft = refreshValidation({ ...current, scheduledAt, timezone }, now);
  if (!draft.validation.valid) throw new Error('The publishing schedule failed validation.');
  const scheduled: PublicationDraft = { ...draft, status: 'scheduled', updatedAt: now };
  if (!replaceDraft(scheduled)) throw new Error('Unable to schedule publication.');
  updateWorkflowStatus(scheduled, 'scheduled');
  publishCreativeEvent('publishing.scheduled', { publicationId: scheduled.id, scheduledAt, timezone });
  return scheduled;
}

function syncExecutionAfterPublish(draft: PublicationDraft, permalink: string, now: string): void {
  const runs = loadExecutionRuns();
  const index = runs.findIndex((run) => run.id === draft.executionRunId || (draft.campaignId && run.campaignId === draft.campaignId));
  if (index < 0) return;
  const run = runs[index];
  const task = run.tasks.find((item) => item.id === draft.executionTaskId || item.domain === 'publishing');
  if (!task) return;
  let result = updateExecutionTaskOutput(run, task.id, { outputUrl: permalink, notes: `Published through ${draft.adapterMode}.` }, now);
  if (['ready', 'in-progress', 'review'].includes(result.run.tasks.find((item) => item.id === task.id)?.status ?? 'blocked')) {
    result = transitionExecutionTask(result.run, task.id, 'complete', { outputUrl: permalink }, now);
  }
  const updated = runs.slice();
  updated[index] = result.run;
  if (saveExecutionRuns(updated)) syncCampaignWorkflowFromExecution(result.run);
}

export async function publishPublication(id: string, now = new Date().toISOString()): Promise<PublicationDraft> {
  const current = refreshValidation(requireDraft(id), now, true);
  if (!current.validation.valid) throw new Error('Publication validation failed.');
  if (!['approved', 'scheduled', 'failed', 'cancelled'].includes(current.status)) throw new Error('Publication is not ready to publish.');
  if (current.approvalRequired && !current.approvedAt) throw new Error('Publication approval is required.');
  const duplicateJob = loadPublishingJobs().find((job) => job.idempotencyKey === current.idempotencyKey && job.status === 'succeeded');
  if (duplicateJob?.permalink && duplicateJob.remotePostId) {
    const reused: PublicationDraft = { ...current, status: 'published', activeJobId: duplicateJob.id, remotePostId: duplicateJob.remotePostId, permalink: duplicateJob.permalink, publishedAt: duplicateJob.completedAt ?? now, metricsStatus: 'waiting', updatedAt: now };
    if (!replaceDraft(reused)) throw new Error('Unable to persist reused publishing result.');
    return reused;
  }
  const attempt = current.attemptCount + 1;
  const job: PublishingJob = {
    id: createId('publishing-job'), publicationId: current.id, platform: current.platform, adapterMode: current.adapterMode,
    status: 'running', idempotencyKey: current.idempotencyKey, attempt, maxAttempts: 3,
    scheduledAt: current.scheduledAt, startedAt: now, createdAt: now, updatedAt: now,
  };
  if (!savePublishingJobs([job, ...loadPublishingJobs()])) throw new Error('Unable to create the publishing job.');
  const publishingDraft: PublicationDraft = { ...current, status: 'publishing', activeJobId: job.id, attemptCount: attempt, failureCode: undefined, failureMessage: undefined, updatedAt: now };
  if (!replaceDraft(publishingDraft)) throw new Error('Unable to mark the publication as publishing.');
  publishCreativeEvent('publishing.started', { publicationId: current.id, jobId: job.id, platform: current.platform });
  try {
    const assetUrl = findAssetUrl(current.creativeAssetId);
    const result = await adapterForDraft(current).publish({ publication: current, assetUrl, now });
    const completedJob: PublishingJob = { ...job, status: 'succeeded', remotePostId: result.remotePostId, permalink: result.permalink, completedAt: result.publishedAt, updatedAt: result.publishedAt };
    if (!replaceJob(completedJob)) throw new Error('Unable to persist the successful publishing job.');
    const published: PublicationDraft = {
      ...publishingDraft, status: 'published', remotePostId: result.remotePostId, permalink: result.permalink,
      publishedAt: result.publishedAt, metricsStatus: 'waiting', updatedAt: result.publishedAt,
    };
    if (!replaceDraft(published)) throw new Error('Unable to persist the published content.');
    syncExecutionAfterPublish(published, result.permalink, result.publishedAt);
    updateWorkflowStatus(published, 'published');
    publishCreativeEvent('publishing.published', { publicationId: published.id, jobId: job.id, remotePostId: result.remotePostId, permalink: result.permalink });
    return published;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Publishing failed.';
    const failedJob: PublishingJob = { ...job, status: 'failed', failureCode: 'PUBLISHING_FAILED', failureMessage: message, completedAt: now, updatedAt: now };
    replaceJob(failedJob);
    const failed: PublicationDraft = { ...publishingDraft, status: 'failed', failureCode: 'PUBLISHING_FAILED', failureMessage: message, updatedAt: now };
    replaceDraft(failed);
    publishCreativeEvent('publishing.failed', { publicationId: failed.id, jobId: job.id, failureMessage: message });
    throw error;
  }
}

export async function runDueScheduledPublications(now = new Date().toISOString()): Promise<PublicationDraft[]> {
  const due = loadPublicationDrafts().filter((item) => item.status === 'scheduled' && item.scheduledAt && new Date(item.scheduledAt).getTime() <= new Date(now).getTime());
  const results: PublicationDraft[] = [];
  for (const draft of due) {
    try { results.push(await publishPublication(draft.id, now)); } catch { /* failures persist in the publication */ }
  }
  return results;
}

export function cancelPublication(id: string, now = new Date().toISOString()): PublicationDraft {
  const current = requireDraft(id);
  if (['published', 'archived'].includes(current.status)) throw new Error('Published or archived content cannot be cancelled.');
  const draft: PublicationDraft = { ...current, status: 'cancelled', updatedAt: now };
  if (!replaceDraft(draft)) throw new Error('Unable to cancel publication.');
  if (current.activeJobId) {
    const job = loadPublishingJobs().find((item) => item.id === current.activeJobId);
    if (job && ['queued', 'running'].includes(job.status)) replaceJob({ ...job, status: 'cancelled', completedAt: now, updatedAt: now });
  }
  publishCreativeEvent('publishing.cancelled', { publicationId: draft.id });
  return draft;
}

export function retryPublication(id: string, now = new Date().toISOString()): PublicationDraft {
  const current = requireDraft(id);
  if (!['failed', 'cancelled'].includes(current.status)) throw new Error('Only failed or cancelled publications can be retried.');
  if (current.attemptCount >= 3) throw new Error('Maximum publishing attempts reached.');
  const draft: PublicationDraft = { ...current, status: current.approvedAt ? 'approved' : 'draft', failureCode: undefined, failureMessage: undefined, activeJobId: undefined, updatedAt: now };
  if (!replaceDraft(draft)) throw new Error('Unable to prepare publication retry.');
  publishCreativeEvent('publishing.retry.requested', { publicationId: draft.id, nextAttempt: draft.attemptCount + 1 });
  return draft;
}

export function archivePublication(id: string, now = new Date().toISOString()): PublicationDraft {
  const current = requireDraft(id);
  if (current.status === 'publishing') throw new Error('An active publishing job cannot be archived.');
  const draft: PublicationDraft = { ...current, status: 'archived', archivedAt: now, updatedAt: now };
  if (!replaceDraft(draft)) throw new Error('Unable to archive publication.');
  publishCreativeEvent('publishing.archived', { publicationId: draft.id });
  return draft;
}

export function restorePublication(id: string, now = new Date().toISOString()): PublicationDraft {
  const current = requireDraft(id);
  if (current.status !== 'archived') throw new Error('Only archived publications can be restored.');
  const status: PublicationDraft['status'] = current.publishedAt ? 'published' : current.approvedAt ? 'approved' : 'draft';
  const draft: PublicationDraft = { ...current, status, archivedAt: undefined, updatedAt: now };
  if (!replaceDraft(draft)) throw new Error('Unable to restore publication.');
  publishCreativeEvent('publishing.restored', { publicationId: draft.id });
  return draft;
}

let eventConsumerCleanup: (() => void) | undefined;

function handleCreativeEvent(event: CreativeEvent): void {
  const payload = event.payload as Record<string, unknown> | undefined;
  if (event.name === 'campaign.archived' && typeof payload?.campaignId === 'string') {
    const current = loadPublicationDrafts();
    const now = new Date().toISOString();
    const next = current.map((item) => item.campaignId === payload.campaignId && item.status !== 'archived'
      ? { ...item, status: 'archived' as const, archivedAt: now, updatedAt: now }
      : item);
    savePublicationDrafts(next);
  }
  if (event.name === 'workspace.cleared') {
    savePublicationDrafts([]);
    savePublishingJobs([]);
    savePublishingConnections([]);
  }
}

export function initializePublishingEventConsumer(): () => void {
  if (eventConsumerCleanup) return eventConsumerCleanup;
  const unsubscribe = subscribeToCreativeEvents(handleCreativeEvent);
  eventConsumerCleanup = () => { unsubscribe(); eventConsumerCleanup = undefined; };
  return eventConsumerCleanup;
}
