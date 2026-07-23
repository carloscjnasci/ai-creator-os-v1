import { describe, expect, it } from 'vitest';
import { parseStoredResearchSignals } from '@/features/research-hub/lib/researchStorage';
import { parseStoredDigitalHumanProfiles } from '@/features/digital-humans/lib/digitalHumanStorage';
import { parseStoredCreativeAssets } from '@/features/creative-library/lib/creativeAssetStorage';

describe('COS storage schemas', () => {
  it('keeps valid research signals and drops invalid entries', () => {
    const valid = { id: 'trend-1', platform: 'tiktok', topic: 'Hook', sourceUrl: '', summary: '', views: 1000, baselineViews: 100, outlierMultiplier: 10, tags: [], capturedAt: '2026-07-16T12:00:00.000Z' };
    expect(parseStoredResearchSignals(JSON.stringify([valid, { id: null }]))).toEqual([valid]);
  });

  it('rejects incomplete Digital Human DNA records', () => {
    expect(parseStoredDigitalHumanProfiles(JSON.stringify([{ id: 'dh-1', characterId: 'char-1' }]))).toEqual([]);
  });

  it('preserves complete asset lineage metadata', () => {
    const asset = { id: 'asset-1', name: 'Hero image', type: 'image', sourceUrl: '', campaignId: 'campaign-1', promptUsed: 'Prompt', model: 'Imagen', tags: ['hero'], createdAt: '2026-07-16T12:00:00.000Z' };
    expect(parseStoredCreativeAssets(JSON.stringify([asset]))).toEqual([asset]);
  });
});
