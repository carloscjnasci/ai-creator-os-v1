import { describe, expect, it } from 'vitest';
import {
  buildExecutionProviderPackage,
  createExecutionRun,
  transitionExecutionTask,
  type CreativePlan,
} from '@/core';

function createPlan(blockProduct = false): CreativePlan {
  return {
    id: 'plan-1',
    intent: {
      id: 'intent-1',
      goal: 'Sell the jacket',
      targetAudience: 'Women 30 to 45',
      platform: 'tiktok-shop',
      objective: 'sales',
      createdAt: '2026-07-16T12:00:00.000Z',
    },
    campaignName: 'Jacket campaign',
    strategy: 'Lead with the product and preserve identity.',
    selectedCharacterId: 'character-1',
    selectedProductId: 'product-1',
    deliverables: {
      hook: 'Stop scrolling.',
      script: ['Hook', 'Body', 'CTA'],
      imagePrompt: 'Create the approved key visual.',
      videoPrompt: 'Create the video.',
      flowPrompt: 'Flow motion package.',
      veoPrompt: 'Veo motion package.',
      thumbnailConcept: 'Product-first thumbnail.',
      title: 'Jacket title',
      caption: 'Jacket caption',
      hashtags: ['#jacket'],
    },
    executionPlan: [
      { id: 'step-1', order: 1, label: 'Strategy', domain: 'strategy', status: 'ready', description: 'Approve strategy.' },
      { id: 'step-2', order: 2, label: 'Product', domain: 'product', status: blockProduct ? 'blocked' : 'ready', description: 'Confirm product.' },
      { id: 'step-3', order: 3, label: 'Prompt', domain: 'prompt', status: 'ready', description: 'Prepare prompts.' },
    ],
    viralScore: {
      overall: 90,
      breakdown: { hook: 90, cta: 90, storytelling: 90, emotion: 90, clothing: 90, trend: 90, productFit: 90, clarity: 90 },
      strengths: ['Clear hook'],
      risks: [],
    },
    createdAt: '2026-07-16T12:00:00.000Z',
  };
}

describe('Execution Engine', () => {
  it('creates a dependency-aware production queue', () => {
    const run = createExecutionRun(createPlan(), { now: '2026-07-16T12:00:00.000Z' });
    expect(run.status).toBe('draft');
    expect(run.tasks.map((task) => task.status)).toEqual(['ready', 'blocked', 'blocked']);
    expect(run.tasks[1].dependsOnTaskIds).toEqual([run.tasks[0].id]);
  });

  it('unlocks the next task when a dependency is completed', () => {
    const run = createExecutionRun(createPlan(), { now: '2026-07-16T12:00:00.000Z' });
    const result = transitionExecutionTask(run, run.tasks[0].id, 'complete', {}, '2026-07-16T12:01:00.000Z');
    expect(result.changed).toBe(true);
    expect(result.run.tasks[0].status).toBe('completed');
    expect(result.run.tasks[1].status).toBe('ready');
    expect(result.run.progress).toBe(33);
    expect(result.run.status).toBe('active');
  });

  it('preserves requirement blockers until explicitly resolved', () => {
    let run = createExecutionRun(createPlan(true), { now: '2026-07-16T12:00:00.000Z' });
    run = transitionExecutionTask(run, run.tasks[0].id, 'complete').run;
    expect(run.tasks[1].status).toBe('blocked');
    expect(run.tasks[1].requirementBlocked).toBe(true);
    const resolved = transitionExecutionTask(run, run.tasks[1].id, 'unblock');
    expect(resolved.run.tasks[1].status).toBe('ready');
    expect(resolved.run.tasks[1].requirementBlocked).toBe(false);
  });

  it('rejects invalid transitions without mutating the run', () => {
    const run = createExecutionRun(createPlan());
    const result = transitionExecutionTask(run, run.tasks[1].id, 'start');
    expect(result.changed).toBe(false);
    expect(result.run).toBe(run);
    expect(result.error).toContain('not allowed');
  });

  it('completes the run and calculates 100 percent progress', () => {
    let run = createExecutionRun(createPlan());
    for (const task of run.tasks) {
      const current = run.tasks.find((item) => item.stepId === task.stepId)!;
      run = transitionExecutionTask(run, current.id, 'complete').run;
    }
    expect(run.status).toBe('completed');
    expect(run.progress).toBe(100);
  });

  it('builds provider-specific packages from the plan', () => {
    const plan = createPlan();
    const run = createExecutionRun(plan);
    const promptTask = run.tasks.find((task) => task.domain === 'prompt')!;
    const providerPackage = buildExecutionProviderPackage(plan, promptTask);
    expect(providerPackage.content).toContain('IMAGE PROMPT');
    expect(providerPackage.content).toContain('Flow motion package');
    expect(providerPackage.suggestedFileName).toContain('jacket-campaign');
  });
});
