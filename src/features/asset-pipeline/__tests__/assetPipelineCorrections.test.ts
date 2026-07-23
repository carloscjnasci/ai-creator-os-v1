import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { publishCreativeEvent } from '@/core/events/creativeEventBus';
import {
  assetPipelineService,
  initializeAssetPipelineEventConsumer,
  shutdownAssetPipelineEventConsumer,
} from '../assetPipelineService';
import { ASSET_STORAGE_KEY, loadAssetRecords } from '../assetPipelineStorage';
import { AssetType, LifecycleStatus, ProcessingStatus, SourceType } from '../types';

function clearStorage() {
  window.localStorage.clear();
  shutdownAssetPipelineEventConsumer();
}

describe('Sprint 13D independent correction contracts', () => {
  beforeEach(clearStorage);
  afterEach(() => {
    clearStorage();
    vi.restoreAllMocks();
  });

  it('keeps signed URLs ephemeral and out of localStorage', async () => {
    const record = assetPipelineService.createAssetRecord({
      id: 'signed-url-asset',
      workspaceId: 'ws',
      sourceType: SourceType.USER_UPLOAD,
      assetType: AssetType.IMAGE,
      lifecycleStatus: LifecycleStatus.READY,
      processingStatus: ProcessingStatus.COMPLETED,
      displayName: 'Signed URL Test',
      storageKey: 'mock-assets/ws/signed-url-asset.png',
    });

    const before = window.localStorage.getItem(ASSET_STORAGE_KEY);
    const signedUrl = await assetPipelineService.requestSignedUrl(record.id, 60);
    const after = window.localStorage.getItem(ASSET_STORAGE_KEY);

    expect(signedUrl).toContain('signature=');
    expect(after).toBe(before);
    expect(after).not.toContain('signature=');
    expect(after).not.toContain('mock-token');
  });

  it('prevents deletion during active processing without an override path', async () => {
    const record = assetPipelineService.createAssetRecord({
      id: 'active-delete-asset',
      workspaceId: 'ws',
      sourceType: SourceType.USER_UPLOAD,
      assetType: AssetType.VIDEO,
      lifecycleStatus: LifecycleStatus.PROCESSING,
      processingStatus: ProcessingStatus.UPLOADING,
      displayName: 'Active Upload',
    });

    await expect(assetPipelineService.markAssetDeleted(record.id)).rejects.toThrow(
      'Active processing blocks deletion.',
    );
    expect(loadAssetRecords().find((item) => item.id === record.id)?.lifecycleStatus).toBe(
      LifecycleStatus.PROCESSING,
    );
  });

  it('cancellation is stable and cannot transition back to ready', async () => {
    const record = assetPipelineService.createAssetRecord({
      id: 'cancel-race-asset',
      workspaceId: 'ws',
      sourceType: SourceType.USER_UPLOAD,
      assetType: AssetType.IMAGE,
      lifecycleStatus: LifecycleStatus.PENDING,
      processingStatus: ProcessingStatus.NOT_STARTED,
      displayName: 'Cancellation Race',
    });

    const pipeline = assetPipelineService.runMockPipeline(record.id);
    await assetPipelineService.cancelActiveIngestion(record.id);
    await pipeline;
    await new Promise((resolve) => setTimeout(resolve, 220));

    const finalRecord = loadAssetRecords().find((item) => item.id === record.id);
    expect(finalRecord?.lifecycleStatus).toBe(LifecycleStatus.FAILED);
    expect(finalRecord?.failureCode).toBe('USER_CANCELLED');
  });

  it('initializes one Event Bus subscription and cleans it up', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const cleanup1 = initializeAssetPipelineEventConsumer();
    const cleanup2 = initializeAssetPipelineEventConsumer();

    const creativeAdds = addSpy.mock.calls.filter(([name]) => name === 'ai-creator-os:creative-event');
    expect(creativeAdds).toHaveLength(1);

    cleanup1();
    cleanup2();

    const creativeRemoves = removeSpy.mock.calls.filter(([name]) => name === 'ai-creator-os:creative-event');
    expect(creativeRemoves).toHaveLength(1);
  });

  it('consumes campaign and workspace events idempotently', async () => {
    initializeAssetPipelineEventConsumer();
    const record = assetPipelineService.createAssetRecord({
      id: 'event-asset',
      workspaceId: 'ws',
      campaignId: 'campaign-1',
      sourceType: SourceType.PROVIDER_GENERATION,
      assetType: AssetType.IMAGE,
      lifecycleStatus: LifecycleStatus.READY,
      processingStatus: ProcessingStatus.COMPLETED,
      displayName: 'Event Asset',
    });

    publishCreativeEvent('campaign.archived', { campaignId: 'campaign-1' });
    expect(loadAssetRecords().find((item) => item.id === record.id)?.lifecycleStatus).toBe(
      LifecycleStatus.ARCHIVED,
    );

    publishCreativeEvent('campaign.archived', { campaignId: 'campaign-1' });
    expect(loadAssetRecords()).toHaveLength(1);

    publishCreativeEvent('workspace.cleared', { workspaceId: 'ws' });
    expect(loadAssetRecords()).toEqual([]);
  });
});
