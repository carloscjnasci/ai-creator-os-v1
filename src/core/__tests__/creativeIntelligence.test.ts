import { describe, expect, it } from 'vitest';
import { calculateViralScore } from '../creative-intelligence/viralScore';
import { optimizePrompt } from '../creative-intelligence/promptOptimizer';
import { analyzeViralContent, inferPlatformFromUrl } from '../creative-intelligence/viralAnalyzer';

describe('Creative Intelligence', () => {
  it('calculates a deterministic bounded Viral Score', () => {
    const input = { goal: 'Olha este produto e garanta agora antes que acabe', targetAudience: 'Mulheres', platform: 'tiktok-shop' as const, objective: 'sales' as const, productName: 'Jaqueta', clothing: 'Look urbano', trendSignals: ['outlier'] };
    const first = calculateViralScore(input);
    const second = calculateViralScore(input);
    expect(first).toEqual(second);
    expect(first.overall).toBeGreaterThanOrEqual(0);
    expect(first.overall).toBeLessThanOrEqual(100);
  });

  it('detects conflicts and removes duplicate prompt instructions', () => {
    const result = optimizePrompt('Create a video. No text on screen. Add text on screen. Keep the product identical. Keep the product identical.');
    expect(result.issues.some((issue) => issue.type === 'conflict')).toBe(true);
    expect(result.issues.some((issue) => issue.type === 'redundancy')).toBe(true);
    expect(result.optimizedPrompt.match(/Keep the product identical/g)?.length).toBe(1);
  });

  it('infers the source platform and creates a brand-safe adaptation', () => {
    expect(inferPlatformFromUrl('https://www.tiktok.com/@creator/video/1')).toBe('tiktok');
    const result = analyzeViralContent({ sourceUrl: 'https://youtu.be/example', notes: 'Olha isso. Antes eu tinha um problema, depois encontrei o resultado. Clica agora.', digitalHumanName: 'Maya', productName: 'Jaqueta' });
    expect(result.platform).toBe('youtube');
    expect(result.adaptedPrompt).toContain('Maya');
    expect(result.adaptedPrompt).toContain('without copying');
  });
});
