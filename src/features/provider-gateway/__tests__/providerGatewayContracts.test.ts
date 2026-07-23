import { beforeEach, describe, expect, it } from 'vitest';
import { createExecutionRun, type CreativePlan } from '@/core';
import { saveCreativePlans } from '@/features/ai-director/lib/creativePlanStorage';
import { saveExecutionRuns, loadExecutionRuns } from '@/features/execution-center/lib/executionRunStorage';
import { loadCreativeAssets } from '@/features/creative-library/lib/creativeAssetStorage';
import { loadPromptExperiments } from '@/features/prompt-intelligence/lib/promptExperimentStorage';
import { loadProviderConnections, saveProviderConnections } from '../lib/providerConnectionStorage';
import { dispatchExecutionTaskToProvider } from '../lib/providerGatewayService';
import { loadProviderJobs, parseStoredProviderJobs } from '../lib/providerJobStorage';

function plan(): CreativePlan {
  return {
    id: 'plan-gateway',
    intent: { id: 'intent-gateway', goal: 'Sell', targetAudience: 'Audience', platform: 'tiktok-shop', objective: 'sales', createdAt: '2026-07-16T12:00:00.000Z' },
    campaignName: 'Gateway campaign', strategy: 'Strategy', selectedProductId: 'product-1',
    deliverables: { hook: 'Hook', script: ['Hook', 'Body', 'CTA'], imagePrompt: 'Image prompt', videoPrompt: 'Video prompt', flowPrompt: 'Flow prompt', veoPrompt: 'Veo prompt', thumbnailConcept: 'Thumbnail', title: 'Title', caption: 'Caption', hashtags: ['#tag'] },
    executionPlan: [
      { id: 's1', order: 1, label: 'Prompt', domain: 'prompt', status: 'ready', description: 'Prompt' },
      { id: 's2', order: 2, label: 'Image', domain: 'image', status: 'ready', description: 'Image' },
    ],
    viralScore: { overall: 88, breakdown: { hook: 88, cta: 88, storytelling: 88, emotion: 88, clothing: 88, trend: 88, productFit: 88, clarity: 88 }, strengths: [], risks: [] },
    createdAt: '2026-07-16T12:00:00.000Z',
  };
}

beforeEach(() => {
  window.localStorage.clear();
  const connections = loadProviderConnections().map((item) => ({ ...item, enabled: item.providerId === 'mock' }));
  saveProviderConnections(connections);
});

describe('Provider Gateway integration contracts', () => {
  it('parses valid jobs and rejects invalid entries independently', async () => {
    const creativePlan = plan();
    const run = createExecutionRun(creativePlan);
    saveCreativePlans([creativePlan]);
    saveExecutionRuns([run]);
    await dispatchExecutionTaskToProvider({ run, task: run.tasks[0], plan: creativePlan, providerId: 'mock' });
    const job = loadProviderJobs()[0];
    const parsed = parseStoredProviderJobs(JSON.stringify([job, { ...job, id: '', attempt: 0 }]));
    expect(parsed).toHaveLength(1);
  });

  it('executes a prompt task end to end with the mock adapter', async () => {
    const creativePlan = plan();
    const run = createExecutionRun(creativePlan);
    saveCreativePlans([creativePlan]);
    saveExecutionRuns([run]);
    const result = await dispatchExecutionTaskToProvider({ run, task: run.tasks[0], plan: creativePlan, providerId: 'mock' });
    expect(result.error).toBeUndefined();
    expect(loadProviderJobs()[0].status).toBe('succeeded');
    expect(loadExecutionRuns()[0].tasks[0].status).toBe('completed');
    expect(loadExecutionRuns()[0].tasks[0].providerJobId).toBe(loadProviderJobs()[0].id);
    expect(loadPromptExperiments()).toHaveLength(1);
  });

  it('executes an image task and registers a traceable creative asset', async () => {
    const creativePlan = plan();
    let run = createExecutionRun(creativePlan);
    saveCreativePlans([creativePlan]);
    saveExecutionRuns([run]);
    await dispatchExecutionTaskToProvider({ run, task: run.tasks[0], plan: creativePlan, providerId: 'mock' });
    run = loadExecutionRuns()[0];
    const imageTask = run.tasks[1];
    expect(imageTask.status).toBe('ready');
    await dispatchExecutionTaskToProvider({ run, task: imageTask, plan: creativePlan, providerId: 'mock' });
    const asset = loadCreativeAssets()[0];
    expect(asset.sourceUrl).toContain('mock://ai-creator-os/image/');
    expect(asset.tags.some((tag) => tag.startsWith('provider-job:'))).toBe(true);
  });

  it('prevents duplicate equivalent dispatches', async () => {
    const creativePlan = plan();
    const run = createExecutionRun(creativePlan);
    saveCreativePlans([creativePlan]);
    saveExecutionRuns([run]);
    await dispatchExecutionTaskToProvider({ run, task: run.tasks[0], plan: creativePlan, providerId: 'mock' });
    const jobsBefore = loadProviderJobs().length;
    const duplicate = await dispatchExecutionTaskToProvider({ run, task: run.tasks[0], plan: creativePlan, providerId: 'mock' });
    expect(duplicate.changed).toBe(false);
    expect(loadProviderJobs()).toHaveLength(jobsBefore);
  });
});
