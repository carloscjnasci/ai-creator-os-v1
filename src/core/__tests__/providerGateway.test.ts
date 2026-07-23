import { describe, expect, it } from 'vitest';
import {
  createExecutionRun,
  createProviderJob,
  findIdempotentProviderJob,
  getCompatibleProviders,
  transitionProviderJob,
  type CreativePlan,
} from '@/core';

function plan(): CreativePlan {
  return {
    id: 'plan-provider',
    intent: { id: 'intent-provider', goal: 'Sell', targetAudience: 'Audience', platform: 'tiktok-shop', objective: 'sales', createdAt: '2026-07-16T12:00:00.000Z' },
    campaignName: 'Provider campaign',
    strategy: 'Strategy',
    deliverables: { hook: 'Hook', script: ['Hook', 'Body', 'CTA'], imagePrompt: 'Image prompt', videoPrompt: 'Video prompt', flowPrompt: 'Flow prompt', veoPrompt: 'Veo prompt', thumbnailConcept: 'Thumbnail', title: 'Title', caption: 'Caption', hashtags: ['#tag'] },
    executionPlan: [
      { id: 'step-prompt', order: 1, label: 'Prompt', domain: 'prompt', status: 'ready', description: 'Prepare prompt.' },
      { id: 'step-image', order: 2, label: 'Image', domain: 'image', status: 'ready', description: 'Generate image.' },
    ],
    viralScore: { overall: 90, breakdown: { hook: 90, cta: 90, storytelling: 90, emotion: 90, clothing: 90, trend: 90, productFit: 90, clarity: 90 }, strengths: [], risks: [] },
    createdAt: '2026-07-16T12:00:00.000Z',
  };
}

describe('Provider Gateway domain', () => {
  it('creates deterministic idempotency keys for equivalent jobs', () => {
    const creativePlan = plan();
    const run = createExecutionRun(creativePlan, { now: '2026-07-16T12:00:00.000Z' });
    const first = createProviderJob({ providerId: 'mock', run, task: run.tasks[0], plan: creativePlan, now: '2026-07-16T12:00:00.000Z' });
    const second = createProviderJob({ providerId: 'mock', run, task: run.tasks[0], plan: creativePlan, now: '2026-07-16T12:01:00.000Z' });
    expect(first.id).not.toBe(second.id);
    expect(first.idempotencyKey).toBe(second.idempotencyKey);
    expect(findIdempotentProviderJob([first], second)?.id).toBe(first.id);
  });

  it('enforces provider capabilities by execution domain', () => {
    const creativePlan = plan();
    const run = createExecutionRun(creativePlan);
    expect(getCompatibleProviders(run.tasks[0], 'https://gateway.example').map((item) => item.id)).toEqual(['mock', 'gemini']);
    expect(getCompatibleProviders(run.tasks[1], 'https://gateway.example').map((item) => item.id)).toEqual(['mock', 'imagen']);
    expect(() => createProviderJob({ providerId: 'veo', run, task: run.tasks[0], plan: creativePlan })).toThrow(/cannot execute/);
  });

  it('supports success, failure, cancellation and bounded retries', () => {
    const creativePlan = plan();
    const run = createExecutionRun(creativePlan);
    const job = createProviderJob({ providerId: 'mock', run, task: run.tasks[0], plan: creativePlan });
    const running = transitionProviderJob(job, 'start').job;
    expect(running.status).toBe('running');
    const failed = transitionProviderJob(running, 'fail', { errorMessage: 'Failure' }).job;
    expect(failed.status).toBe('failed');
    const retried = transitionProviderJob(failed, 'retry').job;
    expect(retried.status).toBe('queued');
    expect(retried.attempt).toBe(2);
    const cancelled = transitionProviderJob(retried, 'cancel').job;
    expect(cancelled.status).toBe('cancelled');
  });
});
