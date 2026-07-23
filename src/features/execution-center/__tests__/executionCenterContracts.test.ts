import { beforeEach, describe, expect, it } from 'vitest';
import { createExecutionRun, transitionExecutionTask, updateExecutionTaskOutput, type CreativePlan } from '@/core';
import { parseStoredExecutionRuns } from '../lib/executionRunStorage';
import { registerExecutionOutput, syncCampaignWorkflowFromExecution } from '../lib/executionIntegrations';
import { loadPromptExperiments } from '@/features/prompt-intelligence/lib/promptExperimentStorage';
import { loadCreativeAssets } from '@/features/creative-library/lib/creativeAssetStorage';
import { saveCampaignWorkflows, loadCampaignWorkflows } from '@/features/campaign-builder/lib/campaignWorkflowStorage';

function plan(): CreativePlan {
  return {
    id: 'plan-1',
    intent: { id: 'intent-1', goal: 'Sell', targetAudience: 'Audience', platform: 'tiktok-shop', objective: 'sales', createdAt: '2026-07-16T12:00:00.000Z' },
    campaignName: 'Campaign', strategy: 'Strategy', selectedCharacterId: 'human-1', selectedProductId: 'product-1', selectedWardrobeItemId: 'wardrobe-1', selectedSceneId: 'scene-1', selectedPoseId: 'pose-1',
    deliverables: { hook: 'Hook', script: ['Hook','Body','CTA'], imagePrompt: 'Image prompt', videoPrompt: 'Video prompt', flowPrompt: 'Flow prompt', veoPrompt: 'Veo prompt', thumbnailConcept: 'Thumbnail', title: 'Title', caption: 'Caption', hashtags: ['#tag'] },
    executionPlan: [
      { id: 's1', order: 1, label: 'Prompt', domain: 'prompt', status: 'ready', description: 'Prompt' },
      { id: 's2', order: 2, label: 'Image', domain: 'image', status: 'ready', description: 'Image' },
    ],
    viralScore: { overall: 88, breakdown: { hook: 88, cta: 88, storytelling: 88, emotion: 88, clothing: 88, trend: 88, productFit: 88, clarity: 88 }, strengths: [], risks: [] },
    createdAt: '2026-07-16T12:00:00.000Z',
  };
}

beforeEach(() => window.localStorage.clear());

describe('Execution Center contracts', () => {
  it('parses valid runs and rejects invalid entries independently', () => {
    const run = createExecutionRun(plan(), { now: '2026-07-16T12:00:00.000Z' });
    const parsed = parseStoredExecutionRuns(JSON.stringify([run, { ...run, id: '', progress: 500 }]));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe(run.id);
  });

  it('registers completed prompt packages in Prompt Intelligence', () => {
    let run = createExecutionRun(plan(), { campaignId: 'campaign-1' });
    run = transitionExecutionTask(run, run.tasks[0].id, 'complete').run;
    const task = run.tasks[0];
    const registered = registerExecutionOutput(run, task, plan());
    expect(registered.promptExperimentId).toBeTruthy();
    expect(loadPromptExperiments()).toHaveLength(1);
    expect(loadPromptExperiments()[0].campaignId).toBe('campaign-1');
  });

  it('registers image outputs in the Creative Asset Library', () => {
    let run = createExecutionRun(plan(), { campaignId: 'campaign-1' });
    run = transitionExecutionTask(run, run.tasks[0].id, 'complete').run;
    run = updateExecutionTaskOutput(run, run.tasks[1].id, { outputUrl: 'https://example.com/image.png', outputText: 'Final image prompt' }).run;
    run = transitionExecutionTask(run, run.tasks[1].id, 'complete').run;
    const registered = registerExecutionOutput(run, run.tasks[1], plan());
    expect(registered.creativeAssetId).toBeTruthy();
    const assets = loadCreativeAssets();
    expect(assets).toHaveLength(1);
    expect(assets[0].sourceUrl).toBe('https://example.com/image.png');
    expect(assets[0].productId).toBe('product-1');
  });

  it('synchronizes execution progress into the campaign workflow', () => {
    saveCampaignWorkflows([{
      id: 'workflow-1', campaignId: 'campaign-1', planId: 'plan-1', name: 'Campaign', objective: 'Sell', platform: 'tiktok-shop',
      promptStatus: 'pending', imageStatus: 'pending', videoStatus: 'pending', publishingStatus: 'not-scheduled', analyticsStatus: 'waiting',
      createdAt: '2026-07-16T12:00:00.000Z', updatedAt: '2026-07-16T12:00:00.000Z',
    }]);
    let run = createExecutionRun(plan(), { campaignId: 'campaign-1', workflowId: 'workflow-1' });
    run = transitionExecutionTask(run, run.tasks[0].id, 'complete').run;
    expect(syncCampaignWorkflowFromExecution(run)).toBe(true);
    const workflow = loadCampaignWorkflows()[0];
    expect(workflow.executionRunId).toBe(run.id);
    expect(workflow.promptStatus).toBe('approved');
    expect(workflow.imageStatus).toBe('ready');
  });
});
