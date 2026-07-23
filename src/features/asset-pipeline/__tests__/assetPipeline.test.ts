import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  SourceType,
  AssetType,
  LifecycleStatus,
  ProcessingStatus,
  ChecksumAlgorithm,
  CloudAssetRecord,
} from '../types';
import { isValidTransition, transitionAsset } from '../assetPipeline';
import {
  loadAssetRecords,
  saveAssetRecords,
  parseAssetRecords,
  subscribeToAssetRecords,
  ASSET_STORAGE_KEY,
} from '../assetPipelineStorage';
import { MockAssetStorageAdapter } from '../adapters/mockAssetStorageAdapter';
import { SecureAssetStorageAdapter } from '../adapters/secureAssetStorageAdapter';

const createValidRecord = (overrides?: Partial<CloudAssetRecord>): CloudAssetRecord => ({
  id: 'asset-123',
  sourceType: SourceType.PROVIDER_GENERATION,
  assetType: AssetType.IMAGE,
  lifecycleStatus: LifecycleStatus.PENDING,
  processingStatus: ProcessingStatus.NOT_STARTED,
  displayName: 'Test Asset Name',
  tags: ['test'],
  createdAt: '2026-07-16T12:00:00.000Z',
  updatedAt: '2026-07-16T12:00:00.000Z',
  attemptCount: 0,
  ...overrides,
});

describe('Cloud Asset Pipeline Lifecycle Transitions', () => {
  it('allows valid state pathways', () => {
    expect(isValidTransition(LifecycleStatus.PENDING, LifecycleStatus.INGESTING)).toBe(true);
    expect(isValidTransition(LifecycleStatus.INGESTING, LifecycleStatus.PROCESSING)).toBe(true);
    expect(isValidTransition(LifecycleStatus.PROCESSING, LifecycleStatus.READY)).toBe(true);
    expect(isValidTransition(LifecycleStatus.INGESTING, LifecycleStatus.FAILED)).toBe(true);
    expect(isValidTransition(LifecycleStatus.PROCESSING, LifecycleStatus.FAILED)).toBe(true);
    expect(isValidTransition(LifecycleStatus.FAILED, LifecycleStatus.INGESTING)).toBe(true);
    expect(isValidTransition(LifecycleStatus.READY, LifecycleStatus.ARCHIVED)).toBe(true);
    expect(isValidTransition(LifecycleStatus.ARCHIVED, LifecycleStatus.READY)).toBe(true);
    expect(isValidTransition(LifecycleStatus.READY, LifecycleStatus.DELETED)).toBe(true);
    expect(isValidTransition(LifecycleStatus.ARCHIVED, LifecycleStatus.DELETED)).toBe(true);
  });

  it('rejects invalid state pathways', () => {
    expect(isValidTransition(LifecycleStatus.READY, LifecycleStatus.INGESTING)).toBe(false);
    expect(isValidTransition(LifecycleStatus.READY, LifecycleStatus.PROCESSING)).toBe(false);
    expect(isValidTransition(LifecycleStatus.FAILED, LifecycleStatus.READY)).toBe(false);
    expect(isValidTransition(LifecycleStatus.PENDING, LifecycleStatus.READY)).toBe(false);
  });

  it('treats DELETED status as strictly terminal', () => {
    const statuses = [
      LifecycleStatus.PENDING,
      LifecycleStatus.INGESTING,
      LifecycleStatus.PROCESSING,
      LifecycleStatus.READY,
      LifecycleStatus.FAILED,
      LifecycleStatus.ARCHIVED,
    ];

    statuses.forEach((status) => {
      expect(isValidTransition(LifecycleStatus.DELETED, status)).toBe(false);
    });
  });

  it('supports archive and restore preserving record data', () => {
    const record = createValidRecord({
      lifecycleStatus: LifecycleStatus.READY,
      processingStatus: ProcessingStatus.COMPLETED,
      parentAssetId: 'parent-abc',
    });

    const archived = transitionAsset(record, LifecycleStatus.ARCHIVED);
    expect(archived.lifecycleStatus).toBe(LifecycleStatus.ARCHIVED);
    expect(archived.parentAssetId).toBe('parent-abc');
    expect(archived.archivedAt).toBeDefined();

    const restored = transitionAsset(archived, LifecycleStatus.READY);
    expect(restored.lifecycleStatus).toBe(LifecycleStatus.READY);
    expect(restored.parentAssetId).toBe('parent-abc');
  });

  it('records failure metadata and increments retry attempt count', () => {
    const record = createValidRecord({
      lifecycleStatus: LifecycleStatus.INGESTING,
      processingStatus: ProcessingStatus.UPLOADING,
    });

    const failed = transitionAsset(record, LifecycleStatus.FAILED, {
      failureCode: 'LIMIT_EXCEEDED',
      failureMessage: 'File size exceeds maximum threshold',
    });

    expect(failed.lifecycleStatus).toBe(LifecycleStatus.FAILED);
    expect(failed.failureCode).toBe('LIMIT_EXCEEDED');
    expect(failed.failureMessage).toBe('File size exceeds maximum threshold');

    const retrying = transitionAsset(failed, LifecycleStatus.INGESTING);
    expect(retrying.lifecycleStatus).toBe(LifecycleStatus.INGESTING);
    expect(retrying.attemptCount).toBe(1);
    expect(retrying.failureCode).toBeUndefined();
    expect(retrying.failureMessage).toBeUndefined();
  });
});

describe('Cloud Asset Pipeline Local Persistence storage', () => {
  let getItemSpy: any;
  let setItemSpy: any;

  beforeEach(() => {
    getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a safe empty array on malformed storage JSON', () => {
    const parsed = parseAssetRecords('not valid JSON {[');
    expect(parsed).toEqual([]);
  });

  it('filters out malformed entries, keeping valid ones', () => {
    const valid = createValidRecord({ id: 'valid-1' });
    const invalid = { id: 'invalid-1', sourceType: 'invalid_source' };

    const parsed = parseAssetRecords(JSON.stringify([valid, invalid]));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('valid-1');
  });

  it('handles storage write failures gracefully', () => {
    setItemSpy.mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const result = saveAssetRecords([createValidRecord()]);
    expect(result.success).toBe(false);
    expect(result.error).toBe('QuotaExceededError');
  });

  it('registers storage events subscription, ignores unrelated events, and performs listener cleanup', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const listener = vi.fn();
    const unsubscribe = subscribeToAssetRecords(listener);

    expect(addSpy).toHaveBeenCalledWith('storage', expect.any(Function));

    // Trigger unrelated storage event
    const handler = addSpy.mock.calls.find((call) => call[0] === 'storage')?.[1] as EventListener;
    
    // Simulate event on another key
    handler({
      key: 'some_other_key',
      storageArea: window.localStorage,
      newValue: '[]',
    } as any);
    expect(listener).not.toHaveBeenCalled();

    // Simulate event on correct key
    const validRecord = createValidRecord();
    handler({
      key: ASSET_STORAGE_KEY,
      storageArea: window.localStorage,
      newValue: JSON.stringify([validRecord]),
    } as any);

    expect(listener).toHaveBeenCalledWith([validRecord]);

    unsubscribe();
    expect(removeSpy).toHaveBeenCalledWith('storage', expect.any(Function));
  });
});

describe('Mock Asset Storage Adapter', () => {
  it('simulates upload success, progress reporting, object metadata and signed URLs', async () => {
    const adapter = new MockAssetStorageAdapter();
    
    // Initialize
    const initRes = await adapter.initializeUpload({
      filename: 'image.png',
      mimeType: 'image/png',
      byteSize: 2048,
      assetType: 'image',
      workspaceId: 'workspace-1',
    });

    expect(initRes.uploadSessionId).toBeDefined();
    expect(initRes.storageKey).toContain('mock-assets/workspace-1/');
    expect(initRes.uploadUrl).toBeDefined();

    // Upload with progress callback
    const progressLogs: number[] = [];
    const uploadRes = await adapter.upload({
      uploadSessionId: initRes.uploadSessionId,
      storageKey: initRes.storageKey,
      chunk: new ArrayBuffer(2048),
      onProgress: (p) => progressLogs.push(p),
    });

    expect(uploadRes.success).toBe(true);
    expect(progressLogs).toContain(100);

    // Complete upload
    const completeRes = await adapter.completeUpload({
      uploadSessionId: initRes.uploadSessionId,
      storageKey: initRes.storageKey,
    });

    expect(completeRes.success).toBe(true);
    expect(completeRes.publicUrl).toBeDefined();

    // Verify object existence and metadata
    const exists = await adapter.objectExists({ storageKey: initRes.storageKey });
    expect(exists.exists).toBe(true);

    const metadata = await adapter.getObjectMetadata({ storageKey: initRes.storageKey });
    expect(metadata.storageKey).toBe(initRes.storageKey);
    expect(metadata.byteSize).toBe(2048);

    // Signed read url
    const signedRes = await adapter.createSignedReadUrl({ storageKey: initRes.storageKey });
    expect(signedRes.signedUrl).toContain(initRes.storageKey);
    expect(signedRes.expiresAt).toBeDefined();

    // Deletion
    const deleteRes = await adapter.deleteObject({ storageKey: initRes.storageKey });
    expect(deleteRes.success).toBe(true);

    const existsAfterDelete = await adapter.objectExists({ storageKey: initRes.storageKey });
    expect(existsAfterDelete.exists).toBe(false);
  });

  it('triggers failure configuration on demand', async () => {
    const adapter = new MockAssetStorageAdapter();
    adapter.setSimulateFailure(true, 'CUSTOM_ERR', 'Manual custom error');

    await expect(
      adapter.initializeUpload({
        filename: 'video.mp4',
        mimeType: 'video/mp4',
        byteSize: 10000,
        assetType: 'video',
      }),
    ).rejects.toEqual({
      code: 'CUSTOM_ERR',
      message: 'Manual custom error',
      retryable: true,
    });
  });

  it('handles client-side cancellation gracefully', async () => {
    const adapter = new MockAssetStorageAdapter();
    const controller = new AbortController();
    
    // Abort signal instantly
    controller.abort();

    await expect(
      adapter.upload({
        uploadSessionId: 'session-id',
        storageKey: 'key',
        chunk: new ArrayBuffer(10),
        abortSignal: controller.signal,
      }),
    ).rejects.toEqual({
      code: 'UPLOAD_CANCELLED',
      message: 'The asset upload was aborted by the client signal.',
      retryable: false,
    });
  });
});

describe('Secure Asset Storage Adapter', () => {
  it('correctly maps adapter methods to backend request shapes without credential exposure', async () => {
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            uploadSessionId: 'sess-secure-456',
            storageKey: 'secure-path/key.jpg',
            uploadMethod: 'PUT',
            uploadUrl: 'https://secure-s3-or-gcs.example.com/presigned',
            expiresAt: '2026-07-16T19:00:00.000Z',
          }),
      } as any),
    );

    const secureAdapter = new SecureAssetStorageAdapter({
      baseUrl: 'https://api.mybrand.com/v1',
      fetchFn: mockFetch,
    });

    const initResult = await secureAdapter.initializeUpload({
      filename: 'hero.jpg',
      mimeType: 'image/jpeg',
      byteSize: 5000,
      assetType: 'image',
      workspaceId: 'ws-789',
    });

    expect(mockFetch).toHaveBeenCalledWith('https://api.mybrand.com/v1/asset-uploads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: 'hero.jpg',
        mimeType: 'image/jpeg',
        byteSize: 5000,
        assetType: 'image',
        workspaceId: 'ws-789',
      }),
    });

    expect(initResult.uploadSessionId).toBe('sess-secure-456');
    expect(initResult.storageKey).toBe('secure-path/key.jpg');
    expect(initResult.uploadUrl).toBe('https://secure-s3-or-gcs.example.com/presigned');
  });
});
