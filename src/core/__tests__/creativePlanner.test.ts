import { describe, expect, it } from 'vitest';
import { createCreativePlan } from '../creative-planner/creativePlanner';
import type { CreativeIntent, CreativeWorkspaceSnapshot } from '../types';

const intent: CreativeIntent = {
  id: 'intent-1',
  goal: 'Quero vender esta jaqueta com um vídeo curto e convincente.',
  targetAudience: 'Mulheres de 30 a 45 anos',
  platform: 'tiktok-shop',
  objective: 'sales',
  productId: 'product-1',
  digitalHumanId: 'human-1',
  createdAt: '2026-07-16T12:00:00.000Z',
};

const workspace: CreativeWorkspaceSnapshot = {
  characters: [{ id: 'human-1', name: 'Maya Costa', description: 'Creator' }],
  products: [{ id: 'product-1', name: 'Jaqueta térmica', description: 'Warm jacket' }],
  wardrobe: [{ id: 'wardrobe-1', name: 'Look urbano', description: 'Black styling' }],
  scenes: [{ id: 'scene-1', name: 'Boutique', description: 'Premium store' }],
  poses: [{ id: 'pose-1', name: 'Product reveal', description: 'Natural pose' }],
};

describe('createCreativePlan', () => {
  it('converts a Creative Intent into a connected execution plan', () => {
    const plan = createCreativePlan(intent, workspace);
    expect(plan.selectedCharacterId).toBe('human-1');
    expect(plan.selectedProductId).toBe('product-1');
    expect(plan.executionPlan).toHaveLength(10);
    expect(plan.executionPlan.every((step) => step.status !== 'blocked')).toBe(true);
    expect(plan.deliverables.flowPrompt).toContain('Maya Costa');
    expect(plan.viralScore.overall).toBeGreaterThanOrEqual(0);
    expect(plan.viralScore.overall).toBeLessThanOrEqual(100);
  });

  it('marks required missing workspace entities as blocked', () => {
    const plan = createCreativePlan({ ...intent, productId: undefined, digitalHumanId: undefined }, { ...workspace, products: [], characters: [] });
    expect(plan.executionPlan.filter((step) => step.status === 'blocked').map((step) => step.domain)).toEqual(['product', 'digital-human']);
  });
});
