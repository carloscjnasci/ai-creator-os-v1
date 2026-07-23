import { beforeEach, describe, expect, it } from 'vitest';
import { createExecutionRun, transitionExecutionTask, type CreativePlan } from '@/core';
import { buildCreativeGraph } from '@/core/knowledge-graph/creativeGraph';
import { saveCreativePlans } from '@/features/ai-director/lib/creativePlanStorage';
import { saveCampaignWorkflows, loadCampaignWorkflows } from '@/features/campaign-builder/lib/campaignWorkflowStorage';
import type { CampaignWorkflow } from '@/features/campaign-builder/types';
import { saveCreativeAssets } from '@/features/creative-library/lib/creativeAssetStorage';
import type { CreativeAsset } from '@/features/creative-library/types';
import { loadExecutionRuns, saveExecutionRuns } from '@/features/execution-center/lib/executionRunStorage';
import { validatePublicationDraft } from '../lib/publishingPolicies';
import {
  approvePublication,
  archivePublication,
  cancelPublication,
  createDraftFromWorkflow,
  publishPublication,
  requestPublicationReview,
  restorePublication,
  retryPublication,
  schedulePublication,
  updatePublicationDraft,
} from '../lib/publishingService';
import { loadPublicationDrafts, loadPublishingJobs } from '../lib/publishingStorage';

const NOW = '2026-07-17T12:00:00.000Z';

function plan(): CreativePlan {
  return {
    id: 'plan-publishing',
    intent: { id: 'intent-publishing', goal: 'Sell jacket', targetAudience: 'Women 30-45', platform: 'tiktok-shop', objective: 'sales', createdAt: NOW },
    campaignName: 'Jacket launch',
    strategy: 'Use a concise TikTok Shop demonstration.',
    selectedCharacterId: 'human-1',
    selectedProductId: 'product-1',
    deliverables: {
      hook: 'Stop scrolling', script: ['Hook', 'Benefit', 'CTA'], imagePrompt: 'Image', videoPrompt: 'Video', flowPrompt: 'Flow', veoPrompt: 'Veo',
      thumbnailConcept: 'Jacket close-up', title: 'The jacket for cold days', caption: 'A practical jacket for cold days.', hashtags: ['jacket', '#tiktokshop'],
    },
    executionPlan: [
      { id: 'step-video', order: 1, label: 'Video', domain: 'video', status: 'ready', description: 'Generate video' },
      { id: 'step-publishing', order: 2, label: 'Publishing', domain: 'publishing', status: 'ready', description: 'Publish' },
      { id: 'step-analytics', order: 3, label: 'Analytics', domain: 'analytics', status: 'ready', description: 'Collect metrics' },
    ],
    viralScore: { overall: 90, breakdown: { hook: 90, cta: 90, storytelling: 90, emotion: 90, clothing: 90, trend: 90, productFit: 90, clarity: 90 }, strengths: [], risks: [] },
    createdAt: NOW,
  };
}

function asset(): CreativeAsset {
  return {
    id: 'asset-video', name: 'Approved video', type: 'video', sourceUrl: 'https://cdn.example.test/video.mp4', campaignId: 'campaign-1',
    digitalHumanId: 'human-1', productId: 'product-1', promptUsed: 'Video prompt', model: 'veo', tags: [], createdAt: NOW,
  };
}

function workflow(): CampaignWorkflow {
  return {
    id: 'workflow-1', campaignId: 'campaign-1', planId: 'plan-publishing', executionRunId: 'run-placeholder', name: 'Jacket launch', objective: 'Sell jacket',
    platform: 'tiktok-shop', productId: 'product-1', digitalHumanId: 'human-1', promptStatus: 'approved', imageStatus: 'approved', videoStatus: 'approved',
    publishingStatus: 'not-scheduled', analyticsStatus: 'waiting', createdAt: NOW, updatedAt: NOW,
  };
}

function seed() {
  const creativePlan = plan();
  let run = createExecutionRun(creativePlan, { campaignId: 'campaign-1', workflowId: 'workflow-1', now: NOW });
  run = transitionExecutionTask(run, run.tasks[0].id, 'complete', {}, NOW).run;
  const seededWorkflow = { ...workflow(), executionRunId: run.id };
  saveCreativePlans([creativePlan]);
  saveCreativeAssets([asset()]);
  saveCampaignWorkflows([seededWorkflow]);
  saveExecutionRuns([run]);
  return { creativePlan, run, workflow: seededWorkflow };
}

beforeEach(() => window.localStorage.clear());

describe('Publishing Hub domain', () => {
  it('validates platform media and configured content policies', () => {
    const result = validatePublicationDraft({ platform: 'tiktok', title: '', caption: 'Caption', hashtags: [], timezone: 'UTC', creativeAssetId: asset().id }, asset(), NOW);
    expect(result.valid).toBe(true);
    const invalid = validatePublicationDraft({ platform: 'tiktok', title: '', caption: '', hashtags: [], timezone: '', creativeAssetId: undefined }, undefined, NOW);
    expect(invalid.valid).toBe(false);
    expect(invalid.issues.map((item) => item.code)).toEqual(expect.arrayContaining(['CAPTION_REQUIRED', 'TIMEZONE_REQUIRED', 'ASSET_REQUIRED']));
  });

  it('rejects a non-video asset for TikTok publishing', () => {
    const imageAsset = { ...asset(), id: 'image', type: 'image' as const };
    const result = validatePublicationDraft({ platform: 'tiktok', title: '', caption: 'Caption', hashtags: [], timezone: 'UTC', creativeAssetId: imageAsset.id }, imageAsset, NOW);
    expect(result.valid).toBe(false);
    expect(result.issues.some((item) => item.code === 'ASSET_TYPE_NOT_ALLOWED')).toBe(true);
  });

  it('creates one idempotent draft from a workflow and normalizes hashtags', () => {
    seed();
    const first = createDraftFromWorkflow({ workflowId: 'workflow-1', creativeAssetId: 'asset-video', now: NOW, timezone: 'UTC' });
    const second = createDraftFromWorkflow({ workflowId: 'workflow-1', creativeAssetId: 'asset-video', now: NOW, timezone: 'UTC' });
    expect(second.id).toBe(first.id);
    expect(loadPublicationDrafts()).toHaveLength(1);
    expect(first.hashtags).toEqual(['#jacket', '#tiktokshop']);
    expect(first.validation.valid).toBe(true);
  });

  it('requires validation and approval before scheduling', () => {
    seed();
    const draft = createDraftFromWorkflow({ workflowId: 'workflow-1', creativeAssetId: 'asset-video', now: NOW, timezone: 'UTC' });
    expect(() => schedulePublication(draft.id, '2026-07-18T12:00:00.000Z', 'UTC', NOW)).toThrow('Approve');
    updatePublicationDraft(draft.id, { caption: '' }, NOW);
    expect(() => requestPublicationReview(draft.id, NOW)).toThrow('validation');
  });

  it('moves through review, approval and scheduling while updating the campaign workflow', () => {
    seed();
    const draft = createDraftFromWorkflow({ workflowId: 'workflow-1', creativeAssetId: 'asset-video', now: NOW, timezone: 'UTC' });
    requestPublicationReview(draft.id, NOW);
    approvePublication(draft.id, 'Owner', NOW);
    const scheduled = schedulePublication(draft.id, '2026-07-18T12:00:00.000Z', 'UTC', NOW);
    expect(scheduled.status).toBe('scheduled');
    expect(loadCampaignWorkflows()[0].publishingStatus).toBe('scheduled');
  });

  it('publishes through the mock adapter and synchronizes execution and campaign status', async () => {
    seed();
    const draft = createDraftFromWorkflow({ workflowId: 'workflow-1', creativeAssetId: 'asset-video', now: NOW, timezone: 'UTC' });
    requestPublicationReview(draft.id, NOW);
    approvePublication(draft.id, 'Owner', NOW);
    const published = await publishPublication(draft.id, NOW);
    expect(published.status).toBe('published');
    expect(published.permalink).toContain('mock.publisher.invalid');
    expect(loadPublishingJobs()).toHaveLength(1);
    expect(loadCampaignWorkflows()[0].publishingStatus).toBe('published');
    expect(loadExecutionRuns()[0].tasks.find((task) => task.domain === 'publishing')?.status).toBe('completed');
  });

  it('reuses a successful idempotent publishing job', async () => {
    seed();
    const draft = createDraftFromWorkflow({ workflowId: 'workflow-1', creativeAssetId: 'asset-video', now: NOW, timezone: 'UTC' });
    requestPublicationReview(draft.id, NOW);
    approvePublication(draft.id, 'Owner', NOW);
    const first = await publishPublication(draft.id, NOW);
    const restored = restorePublication(archivePublication(first.id, NOW).id, NOW);
    expect(restored.status).toBe('published');
    expect(loadPublishingJobs()).toHaveLength(1);
  });

  it('supports cancellation, retry preparation, archive and restore', () => {
    seed();
    const draft = createDraftFromWorkflow({ workflowId: 'workflow-1', creativeAssetId: 'asset-video', now: NOW, timezone: 'UTC' });
    const cancelled = cancelPublication(draft.id, NOW);
    expect(cancelled.status).toBe('cancelled');
    const retry = retryPublication(draft.id, NOW);
    expect(retry.status).toBe('draft');
    const archived = archivePublication(retry.id, NOW);
    expect(archived.status).toBe('archived');
    expect(restorePublication(archived.id, NOW).status).toBe('draft');
  });


  it('runs due scheduled publications without treating the due timestamp as an invalid past schedule', async () => {
    seed();
    const draft = createDraftFromWorkflow({ workflowId: 'workflow-1', creativeAssetId: 'asset-video', now: NOW, timezone: 'UTC' });
    requestPublicationReview(draft.id, NOW);
    approvePublication(draft.id, 'Owner', NOW);
    schedulePublication(draft.id, '2026-07-17T13:00:00.000Z', 'UTC', NOW);
    const { runDueScheduledPublications } = await import('../lib/publishingService');
    const results = await runDueScheduledPublications('2026-07-17T13:00:01.000Z');
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('published');
  });

  it('adds publication and publishing-job lineage to the Creative Graph', async () => {
    seed();
    const draft = createDraftFromWorkflow({ workflowId: 'workflow-1', creativeAssetId: 'asset-video', now: NOW, timezone: 'UTC' });
    requestPublicationReview(draft.id, NOW);
    approvePublication(draft.id, 'Owner', NOW);
    await publishPublication(draft.id, NOW);
    const graph = buildCreativeGraph({ campaigns: [], promptHistory: [], assets: [asset()], workflows: loadCampaignWorkflows(), executionRuns: loadExecutionRuns(), publications: loadPublicationDrafts(), publishingJobs: loadPublishingJobs() });
    expect(graph.nodes.some((node) => node.type === 'publication')).toBe(true);
    expect(graph.nodes.some((node) => node.type === 'publishing-job')).toBe(true);
    expect(graph.edges.some((edge) => edge.relation === 'executes-publication')).toBe(true);
  });
});
