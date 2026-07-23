import { createId } from '@/core/id';
import { publishCreativeEvent, subscribeToCreativeEvents } from '@/core/events/creativeEventBus';
import {
  AssetType,
  LifecycleStatus,
  ProcessingStatus,
  SourceType,
  ChecksumAlgorithm,
  type CloudAssetRecord,
} from './types';
import { transitionAsset } from './assetPipeline';
import { loadAssetRecords, saveAssetRecords } from './assetPipelineStorage';
import { MockAssetStorageAdapter } from './adapters/mockAssetStorageAdapter';
import {
  publishAssetIngestionCreated,
  publishAssetIngestionStarted,
  publishAssetProcessingStarted,
  publishAssetReady,
  publishAssetFailed,
  publishAssetRetryRequested,
  publishAssetCancelled,
  publishAssetArchived,
  publishAssetRestored,
  publishAssetDeletionRequested,
  publishAssetDeleted,
  publishAssetDerivativeCreated,
  publishAssetSignedUrlRequested,
} from './assetPipelineEvents';

// For legacy and standard synchronizations
import { loadCreativeAssets, saveCreativeAssets } from '@/features/creative-library/lib/creativeAssetStorage';
import type { CreativeAsset } from '@/features/creative-library/types';
import { loadExecutionRuns, saveExecutionRuns } from '@/features/execution-center/lib/executionRunStorage';
import { syncCampaignWorkflowFromExecution } from '@/features/execution-center/lib/executionIntegrations';

// Imports for Sprint 13D corrections
import { sanitizeFilename, deriveDisplayName } from './utils/filenameSanitizer';
import { computeSha256 } from './utils/cryptoUtils';

// Initialize a standard mock storage adapter
const mockAdapter = new MockAssetStorageAdapter();

/**
 * Generates deterministic metadata based on AssetType and name/checksum seed.
 * Secure backend workers are responsible for actual transcode and extraction.
 */
export function generateDeterministicMetadata(
  assetType: AssetType,
  displayName: string,
  checksum?: string,
): Record<string, any> {
  const seedString = checksum || displayName;
  const seed = seedString.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  switch (assetType) {
    case AssetType.IMAGE: {
      const width = 1024 + (seed % 1024);
      const height = 768 + (seed % 768);
      const aspect = (width / height).toFixed(2);
      return {
        width,
        height,
        aspectRatio: aspect,
        thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=60',
        preview: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60',
      };
    }
    case AssetType.VIDEO: {
      const duration = 10 + (seed % 50);
      return {
        width: 1920,
        height: 1080,
        duration,
        posterFrame: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=400&auto=format&fit=crop&q=60',
        preview: 'https://mock-storage.local/video-preview.mp4',
      };
    }
    case AssetType.AUDIO: {
      const duration = 30 + (seed % 120);
      return {
        duration,
        waveformPreview: [10, 20, 30, 40, 50, 40, 30, 20, 10, 15, 25, 35, 45, 50, 20],
      };
    }
    case AssetType.DOCUMENT: {
      const pageCount = 1 + (seed % 10);
      return {
        pageCount,
        thumbnail: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=150&auto=format&fit=crop&q=60',
      };
    }
    default:
      return {};
  }
}

/**
 * Maps standard mimeTypes to the matching AssetType.
 */
export function detectAssetType(mimeType?: string): AssetType {
  if (!mimeType) return AssetType.OTHER;
  const lower = mimeType.toLowerCase();
  if (lower.startsWith('image/')) return AssetType.IMAGE;
  if (lower.startsWith('video/')) return AssetType.VIDEO;
  if (lower.startsWith('audio/')) return AssetType.AUDIO;
  if (lower === 'application/pdf') return AssetType.DOCUMENT;
  return AssetType.OTHER;
}

/**
 * Core Asset Pipeline Service
 * Orchestrates cloud asset records, duplicate ingestion checks, mock pipelines,
 * and downstream Creative Library / Execution center synchronizations.
 */
export class AssetPipelineService {
  private activeControllers = new Map<string, AbortController>();
  /**
   * Safe list retrieval
   */
  public getRecords(): CloudAssetRecord[] {
    return loadAssetRecords();
  }

  /**
   * Saves records with atomicity
   */
  public saveRecords(records: CloudAssetRecord[]): boolean {
    const res = saveAssetRecords(records);
    return res.success;
  }

  /**
   * Creates a brand-new cloud asset record.
   */
  public createAssetRecord(record: Partial<CloudAssetRecord>): CloudAssetRecord {
    const now = new Date().toISOString();
    const cleanRecord: CloudAssetRecord = {
      id: record.id || createId('asset'),
      workspaceId: record.workspaceId || 'default-workspace',
      campaignId: record.campaignId,
      executionId: record.executionId,
      executionTaskId: record.executionTaskId,
      providerJobId: record.providerJobId,
      sourceType: record.sourceType || SourceType.USER_UPLOAD,
      assetType: record.assetType || AssetType.OTHER,
      lifecycleStatus: record.lifecycleStatus || LifecycleStatus.PENDING,
      processingStatus: record.processingStatus || ProcessingStatus.NOT_STARTED,
      displayName: record.displayName || 'Untitled Asset',
      originalFilename: record.originalFilename,
      mimeType: record.mimeType,
      byteSize: record.byteSize,
      checksum: record.checksum,
      checksumAlgorithm: record.checksumAlgorithm,
      tags: record.tags || [],
      attemptCount: record.attemptCount ?? (record.lifecycleStatus === LifecycleStatus.INGESTING ? 1 : 0),
      createdAt: now,
      updatedAt: now,
      ...record,
    };

    const current = this.getRecords();
    const saved = this.saveRecords([cleanRecord, ...current]);
    if (!saved) {
      throw new Error('FAILED_TO_PERSIST: Could not persist new asset record.');
    }
    publishAssetIngestionCreated({
      assetId: cleanRecord.id,
      workspaceId: cleanRecord.workspaceId,
      campaignId: cleanRecord.campaignId,
    });
    return cleanRecord;
  }

  /**
   * Ingests a successful Provider Job result.
   * Utilizes idempotency so that duplicate providerJobId + URL won't duplicate records.
   */
  public async ingestProviderResult(params: {
    providerJobId: string;
    outputUrl: string;
    assetType: AssetType;
    displayName: string;
    campaignId?: string;
    executionTaskId?: string;
    executionId?: string;
    workspaceId: string;
    modelProvider?: string;
    modelName?: string;
  }): Promise<CloudAssetRecord> {
    const current = this.getRecords();

    // 1. Idempotency Check: Same providerJobId + outputUrl + executionTaskId
    const existing = current.find(
      (r) =>
        r.providerJobId === params.providerJobId &&
        r.publicUrl === params.outputUrl &&
        r.executionTaskId === params.executionTaskId &&
        r.lifecycleStatus !== LifecycleStatus.DELETED,
    );

    if (existing) {
      // Re-trigger sync in case it missed downstream targets
      this.syncWithCreativeLibrary(existing);
      return existing;
    }

    // 2. Create asset record
    const record = this.createAssetRecord({
      workspaceId: params.workspaceId,
      campaignId: params.campaignId,
      executionId: params.executionId,
      executionTaskId: params.executionTaskId,
      providerJobId: params.providerJobId,
      sourceType: SourceType.PROVIDER_GENERATION,
      assetType: params.assetType,
      displayName: params.displayName,
      publicUrl: params.outputUrl,
      previewUrl: params.outputUrl,
      thumbnailUrl: params.outputUrl,
      modelProvider: params.modelProvider,
      modelName: params.modelName,
      checksumAlgorithm: ChecksumAlgorithm.PROVIDER_ETAG,
      checksum: `etag-${params.providerJobId}`,
      lifecycleStatus: LifecycleStatus.PENDING,
      processingStatus: ProcessingStatus.NOT_STARTED,
      tags: [`provider-job:${params.providerJobId}`],
    });

    // 3. Mock Ingestion Lifecycle
    await this.runMockPipeline(record.id);

    // Reload and return updated record
    const updated = this.getRecords().find((r) => r.id === record.id);
    return updated || record;
  }

  /**
   * Imports a remote URL.
   */
  public async importRemoteUrl(params: {
    url: string;
    displayName: string;
    workspaceId: string;
    campaignId?: string;
    assetType?: AssetType;
  }): Promise<CloudAssetRecord> {
    // Validate that URL uses an accepted HTTP or HTTPS scheme
    let parsed: URL;
    try {
      parsed = new URL(params.url);
    } catch {
      throw new Error('INVALID_URL: The remote URL is malformed.');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('INVALID_SCHEME: Only HTTP and HTTPS URL schemes are accepted.');
    }

    const current = this.getRecords();
    
    // Idempotency: same URL and workspace
    const existing = current.find(
      (r) =>
        r.publicUrl === params.url &&
        r.workspaceId === params.workspaceId &&
        r.lifecycleStatus !== LifecycleStatus.DELETED,
    );
    if (existing) {
      return existing;
    }

    // Do not pass a URL string into a MIME-type parser. Use safe extension inference.
    let detectedType = params.assetType;
    if (!detectedType) {
      const pathname = parsed.pathname.toLowerCase();
      if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg') || pathname.endsWith('.png') || pathname.endsWith('.webp')) {
        detectedType = AssetType.IMAGE;
      } else if (pathname.endsWith('.mp4') || pathname.endsWith('.webm')) {
        detectedType = AssetType.VIDEO;
      } else if (pathname.endsWith('.mp3') || pathname.endsWith('.wav') || pathname.endsWith('.mpeg') || pathname.endsWith('.webm')) {
        detectedType = AssetType.AUDIO;
      } else if (pathname.endsWith('.pdf')) {
        detectedType = AssetType.DOCUMENT;
      } else {
        detectedType = AssetType.OTHER;
      }
    }

    const record = this.createAssetRecord({
      workspaceId: params.workspaceId,
      campaignId: params.campaignId,
      sourceType: SourceType.IMPORTED_URL,
      assetType: detectedType,
      displayName: params.displayName || 'Remote Asset',
      publicUrl: params.url,
      previewUrl: params.url,
      checksumAlgorithm: undefined, // "Remote URL imports must not generate fake SHA-256 values."
      checksum: undefined,
      lifecycleStatus: LifecycleStatus.PENDING,
      processingStatus: ProcessingStatus.NOT_STARTED,
    });

    await this.runMockPipeline(record.id);

    const updated = this.getRecords().find((r) => r.id === record.id);
    return updated || record;
  }

  /**
   * Registers a user-selected file.
   * Duplicate detection checks workspaceId, checksum, byteSize, mimeType.
   */
  public async registerUserSelectedFile(params: {
    filename: string;
    mimeType: string;
    byteSize: number;
    workspaceId: string;
    campaignId?: string;
    checksum?: string;
    uploadSessionId?: string;
  }): Promise<CloudAssetRecord> {
    const ALLOWED_MIMES = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
      'video/webm',
      'audio/mpeg',
      'audio/wav',
      'audio/webm',
      'application/pdf',
    ];

    if (!ALLOWED_MIMES.includes(params.mimeType)) {
      throw new Error(`UNSUPPORTED_MIME_TYPE: The MIME type ${params.mimeType} is not supported by the Asset Pipeline.`);
    }

    // Reusable pure filename sanitizer to prevent path traversal
    const sanitizedFilename = sanitizeFilename(params.filename);
    const safeDisplayName = deriveDisplayName(sanitizedFilename);

    const current = this.getRecords();
    const checksum = params.checksum;

    // Same upload-session completion must not duplicate
    if (params.uploadSessionId) {
      const activeSession = current.find(
        (r) => r.metadata?.uploadSessionId === params.uploadSessionId && r.lifecycleStatus !== LifecycleStatus.DELETED,
      );
      if (activeSession) {
        return activeSession;
      }
    }

    // Duplicate detection: same checksum, workspace, size, type
    if (checksum) {
      const duplicate = current.find(
        (r) =>
          r.workspaceId === params.workspaceId &&
          r.checksum === checksum &&
          r.byteSize === params.byteSize &&
          r.mimeType === params.mimeType &&
          r.lifecycleStatus !== LifecycleStatus.DELETED,
      );

      if (duplicate) {
        return duplicate;
      }
    }

    const detectedType = detectAssetType(params.mimeType);

    const record = this.createAssetRecord({
      workspaceId: params.workspaceId,
      campaignId: params.campaignId,
      sourceType: SourceType.USER_UPLOAD,
      assetType: detectedType,
      displayName: safeDisplayName,
      originalFilename: sanitizedFilename,
      mimeType: params.mimeType,
      byteSize: params.byteSize,
      checksum,
      checksumAlgorithm: checksum ? ChecksumAlgorithm.SHA256 : undefined,
      lifecycleStatus: LifecycleStatus.PENDING,
      processingStatus: ProcessingStatus.NOT_STARTED,
      metadata: {
        uploadSessionId: params.uploadSessionId,
      },
    });

    return record;
  }

  /**
   * Performs an asset lifecycle state transition.
   */
  public applyLifecycleTransition(
    recordId: string,
    targetStatus: LifecycleStatus,
    options?: {
      failureCode?: string;
      failureMessage?: string;
      processingStatus?: ProcessingStatus;
    },
  ): CloudAssetRecord {
    const records = this.getRecords();
    const index = records.findIndex((r) => r.id === recordId);
    if (index < 0) {
      throw new Error(`Asset record ${recordId} not found.`);
    }

    const currentRecord = records[index];
    const updated = transitionAsset(currentRecord, targetStatus, options);

    records[index] = updated;
    const saved = this.saveRecords(records);
    if (!saved) {
      throw new Error('FAILED_TO_PERSIST: Could not persist asset transition.');
    }

    // Event routing
    const payload = {
      assetId: updated.id,
      workspaceId: updated.workspaceId,
      campaignId: updated.campaignId,
    };
    switch (targetStatus) {
      case LifecycleStatus.INGESTING:
        publishAssetIngestionStarted(payload);
        break;
      case LifecycleStatus.PROCESSING:
        publishAssetProcessingStarted(payload);
        break;
      case LifecycleStatus.READY:
        publishAssetReady({ ...payload, publicUrl: updated.publicUrl });
        this.syncWithCreativeLibrary(updated);
        break;
      case LifecycleStatus.FAILED:
        publishAssetFailed({
          ...payload,
          failureCode: updated.failureCode || 'ERROR',
          failureMessage: updated.failureMessage || 'Unknown error',
        });
        break;
      case LifecycleStatus.ARCHIVED:
        publishAssetArchived(payload);
        break;
      case LifecycleStatus.DELETED:
        publishAssetDeleted(payload);
        break;
    }

    return updated;
  }

  /**
   * Run Mock Pipeline with proper cancellation mechanics.
   */
  public async runMockPipeline(recordId: string): Promise<void> {
    const existing = this.activeControllers.get(recordId);
    if (existing) {
      existing.abort();
    }
    const controller = new AbortController();
    this.activeControllers.set(recordId, controller);
    const signal = controller.signal;

    try {
      if (signal.aborted) return;
      this.applyLifecycleTransition(recordId, LifecycleStatus.INGESTING, {
        processingStatus: ProcessingStatus.VALIDATING,
      });

      // Simulating validation step
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, 50);
        signal.addEventListener('abort', () => {
          clearTimeout(t);
          reject(new Error('ABORTED'));
        });
      });
      if (signal.aborted) return;

      this.applyLifecycleTransition(recordId, LifecycleStatus.INGESTING, {
        processingStatus: ProcessingStatus.HASHING,
      });

      // Simulating hashing step
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, 50);
        signal.addEventListener('abort', () => {
          clearTimeout(t);
          reject(new Error('ABORTED'));
        });
      });
      if (signal.aborted) return;

      const records = this.getRecords();
      const current = records.find((r) => r.id === recordId);
      if (!current) return;

      this.applyLifecycleTransition(recordId, LifecycleStatus.PROCESSING, {
        processingStatus: ProcessingStatus.UPLOADING,
      });

      // Simulating upload/metadata extraction
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, 50);
        signal.addEventListener('abort', () => {
          clearTimeout(t);
          reject(new Error('ABORTED'));
        });
      });
      if (signal.aborted) return;

      this.applyLifecycleTransition(recordId, LifecycleStatus.PROCESSING, {
        processingStatus: ProcessingStatus.EXTRACTING_METADATA,
      });

      // Determine deterministic metadata
      const mockMeta = generateDeterministicMetadata(current.assetType, current.displayName, current.checksum);
      const withMetaRecords = this.getRecords();
      const index = withMetaRecords.findIndex((r) => r.id === recordId);
      if (index >= 0) {
        withMetaRecords[index] = {
          ...withMetaRecords[index],
          width: mockMeta.width || withMetaRecords[index].width,
          height: mockMeta.height || withMetaRecords[index].height,
          durationSeconds: mockMeta.duration || withMetaRecords[index].durationSeconds,
          thumbnailUrl: mockMeta.thumbnail || withMetaRecords[index].thumbnailUrl,
          previewUrl: mockMeta.preview || withMetaRecords[index].previewUrl,
          metadata: {
            ...withMetaRecords[index].metadata,
            ...mockMeta,
          },
        };
        const saved = this.saveRecords(withMetaRecords);
        if (!saved) {
          throw new Error('FAILED_TO_PERSIST: Could not persist asset metadata.');
        }
      }

      this.applyLifecycleTransition(recordId, LifecycleStatus.PROCESSING, {
        processingStatus: ProcessingStatus.GENERATING_PREVIEW,
      });

      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, 50);
        signal.addEventListener('abort', () => {
          clearTimeout(t);
          reject(new Error('ABORTED'));
        });
      });
      if (signal.aborted) return;

      this.applyLifecycleTransition(recordId, LifecycleStatus.READY, {
        processingStatus: ProcessingStatus.COMPLETED,
      });
      this.activeControllers.delete(recordId);
    } catch (err: any) {
      if (err.message === 'ABORTED' || signal.aborted) {
        // Halt gracefully; cancelled status is already terminal/failed
        return;
      }
      this.recordFailure(recordId, 'PIPELINE_ERROR', err.message || 'Pipeline failed during mock execution');
      this.activeControllers.delete(recordId);
    }
  }

  /**
   * Records failure.
   */
  public recordFailure(recordId: string, code: string, message: string): CloudAssetRecord {
    return this.applyLifecycleTransition(recordId, LifecycleStatus.FAILED, {
      failureCode: code,
      failureMessage: message,
    });
  }

  /**
   * Retries a failed asset. Creates a brand new controlled pipeline attempt.
   */
  public async retryFailedIngestion(recordId: string): Promise<CloudAssetRecord> {
    publishAssetRetryRequested({ assetId: recordId });
    const records = this.getRecords();
    const rec = records.find((r) => r.id === recordId);
    if (!rec || rec.lifecycleStatus !== LifecycleStatus.FAILED) {
      throw new Error('Only failed assets can be retried.');
    }

    // Transit to ingesting (increments attemptCount exactly once)
    const updated = this.applyLifecycleTransition(recordId, LifecycleStatus.INGESTING, {
      processingStatus: ProcessingStatus.VALIDATING,
    });

    this.runMockPipeline(recordId);
    return updated;
  }

  /**
   * Cancels active ingestion immediately.
   */
  public async cancelActiveIngestion(recordId: string): Promise<CloudAssetRecord> {
    const controller = this.activeControllers.get(recordId);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(recordId);
    }
    publishAssetCancelled({ assetId: recordId });
    const updated = this.applyLifecycleTransition(recordId, LifecycleStatus.FAILED, {
      failureCode: 'USER_CANCELLED',
      failureMessage: 'Ingestion cancelled by the user.',
    });
    return updated;
  }

  /**
   * Archive an asset.
   */
  public async archiveAsset(recordId: string): Promise<CloudAssetRecord> {
    const updated = this.applyLifecycleTransition(recordId, LifecycleStatus.ARCHIVED);
    return updated;
  }

  /**
   * Restore an archived asset.
   */
  public async restoreArchivedAsset(recordId: string): Promise<CloudAssetRecord> {
    publishAssetRestored({ assetId: recordId });
    const updated = this.applyLifecycleTransition(recordId, LifecycleStatus.READY);
    return updated;
  }

  /**
   * Requests deletion of an asset. Soft deletion tombstone.
   */
  public async markAssetDeleted(recordId: string): Promise<CloudAssetRecord> {
    const records = this.getRecords();
    const index = records.findIndex((r) => r.id === recordId);
    if (index < 0) {
      throw new Error(`Asset ${recordId} not found.`);
    }

    const rec = records[index];

    // Legal hold must always block deletion — no force override
    if (rec.legalHold) {
      throw new Error('Asset cannot be deleted while under a legal hold.');
    }

    // Active retention must always block deletion — no force override
    if (rec.retentionUntil && new Date(rec.retentionUntil) > new Date()) {
      throw new Error('Asset cannot be deleted during active retention period.');
    }

    if (rec.lifecycleStatus === LifecycleStatus.INGESTING || rec.lifecycleStatus === LifecycleStatus.PROCESSING) {
      throw new Error('Active processing blocks deletion.');
    }

    // Store the timestamp of the deletion request in deletionRequestedAt
    rec.deletionRequestedAt = new Date().toISOString();
    records[index] = rec;
    const saved = this.saveRecords(records);
    if (!saved) {
      throw new Error('FAILED_TO_PERSIST: Could not persist deletion requested timestamp.');
    }

    publishAssetDeletionRequested({ assetId: recordId, workspaceId: rec.workspaceId });

    const updated = this.applyLifecycleTransition(recordId, LifecycleStatus.DELETED);

    // Synchronize to Creative Library
    const creativeAssets = loadCreativeAssets();
    const itemIdx = creativeAssets.findIndex((c) => c.cloudAssetId === recordId || c.id === rec.creativeLibraryAssetId);
    if (itemIdx >= 0) {
      creativeAssets[itemIdx].processingStatus = 'deleted';
      saveCreativeAssets(creativeAssets);
    }

    return updated;
  }

  /**
   * Creates a derivative asset.
   */
  public async createDerivativeAsset(
    parentAssetId: string,
    params: Partial<CloudAssetRecord>,
  ): Promise<CloudAssetRecord> {
    const records = this.getRecords();
    const parent = records.find((r) => r.id === parentAssetId);
    if (!parent) {
      throw new Error(`Parent asset ${parentAssetId} not found.`);
    }

    const clean: Partial<CloudAssetRecord> = {
      ...params,
      parentAssetId,
      workspaceId: parent.workspaceId,
      campaignId: parent.campaignId,
      sourceType: SourceType.DERIVED_ASSET,
    };

    const record = this.createAssetRecord(clean);
    publishAssetDerivativeCreated({ assetId: record.id, parentAssetId });
    return record;
  }

  /**
   * Generates a signed read URL simulation.
   */
  public async requestSignedUrl(recordId: string, expiresInSeconds = 3600): Promise<string> {
    const records = this.getRecords();
    const rec = records.find((r) => r.id === recordId);
    if (!rec) {
      throw new Error(`Asset ${recordId} not found.`);
    }

    publishAssetSignedUrlRequested({ assetId: recordId });
    const key = rec.storageKey || `mock-assets/key-${recordId}`;
    const res = await mockAdapter.createSignedReadUrl({ storageKey: key, expiresInSeconds });

    // Ephemeral signed URL handling: Return the URL directly to the caller without writing it through saveAssetRecords().
    return res.signedUrl;
  }

  /**
   * Synchronizes READY Cloud Asset to Creative Library.
   * Ensures idempotency: does not create duplicate entries.
   */
  private syncWithCreativeLibrary(record: CloudAssetRecord): void {
    if (record.lifecycleStatus !== LifecycleStatus.READY) return;

    const creativeAssets = loadCreativeAssets();
    
    // Idempotency: match by cloudAssetId or providerJobId, or same storage key
    let existing = creativeAssets.find(
      (c) =>
        c.cloudAssetId === record.id ||
        (record.providerJobId && c.tags.includes(`provider-job:${record.providerJobId}`)) ||
        (record.storageKey && c.storageKey === record.storageKey),
    );

    const assetTypeMap: Record<AssetType, CreativeAsset['type']> = {
      [AssetType.IMAGE]: 'image',
      [AssetType.VIDEO]: 'video',
      [AssetType.AUDIO]: 'audio',
      [AssetType.THUMBNAIL]: 'thumbnail',
      [AssetType.DOCUMENT]: 'document',
      [AssetType.OTHER]: 'image', // Fallback
    };

    const type = assetTypeMap[record.assetType] || 'image';

    const libraryAsset: CreativeAsset = {
      id: existing?.id || createId('asset'),
      name: record.displayName,
      type,
      sourceUrl: record.publicUrl || '',
      campaignId: record.campaignId,
      cloudAssetId: record.id,
      storageProvider: record.storageProvider || 'Mock Storage',
      storageKey: record.storageKey || `mock-key-${record.id}`,
      thumbnailUrl: record.thumbnailUrl || record.publicUrl,
      previewUrl: record.previewUrl || record.publicUrl,
      byteSize: record.byteSize,
      mimeType: record.mimeType,
      checksum: record.checksum,
      processingStatus: 'ready',
      promptUsed: record.metadata?.promptUsed as string || 'Ingested via Asset Pipeline',
      model: record.modelName || record.modelProvider || 'Unknown',
      tags: record.tags || [],
      createdAt: record.createdAt,
    };

    if (existing) {
      const idx = creativeAssets.findIndex((c) => c.id === existing!.id);
      creativeAssets[idx] = libraryAsset;
    } else {
      creativeAssets.unshift(libraryAsset);
    }
    saveCreativeAssets(creativeAssets);

    // Update cloud record mapping
    if (!record.creativeLibraryAssetId || record.creativeLibraryAssetId !== libraryAsset.id) {
      const allCloud = this.getRecords();
      const cIdx = allCloud.findIndex((r) => r.id === record.id);
      if (cIdx >= 0) {
        allCloud[cIdx].creativeLibraryAssetId = libraryAsset.id;
        this.saveRecords(allCloud);
      }
    }

    // Link output in active Execution Task / Execution Run
    if (record.executionTaskId && record.executionId) {
      const runs = loadExecutionRuns();
      const runIdx = runs.findIndex((r) => r.id === record.executionId);
      if (runIdx >= 0) {
        const run = runs[runIdx];
        const taskIdx = run.tasks.findIndex((t) => t.id === record.executionTaskId);
        if (taskIdx >= 0) {
          const task = run.tasks[taskIdx];
          
          // Update output keys & creativeAssetId
          run.tasks[taskIdx] = {
            ...task,
            status: 'completed',
            creativeAssetId: libraryAsset.id,
            outputUrl: record.publicUrl,
            notes: [task.notes, `Linked Cloud Asset ID: ${record.id}`].filter(Boolean).join('\n'),
          };

          saveExecutionRuns(runs);
          syncCampaignWorkflowFromExecution(run);
        }
      }
    }
  }

  /**
   * Event consumer subscription handler
   */
  public handleConsumedEvent(name: string, payload: any): void {
    if (name === 'provider.job.succeeded') {
      const { jobId, outputUrl, mimeType, executionTaskId, campaignId, workspaceId } = payload;
      const detected = detectAssetType(mimeType);
      this.ingestProviderResult({
        providerJobId: jobId,
        outputUrl,
        assetType: detected,
        displayName: `Provider Output ${jobId}`,
        campaignId,
        executionTaskId,
        workspaceId: workspaceId || 'default-workspace',
      });
    } else if (name === 'provider.job.failed') {
      const { jobId, errorMessage } = payload;
      const records = this.getRecords();
      const related = records.find((r) => r.providerJobId === jobId);
      if (related) {
        this.recordFailure(related.id, 'PROVIDER_JOB_FAILED', errorMessage || 'The upstream job failed');
      }
    } else if (name === 'campaign.archived') {
      const { campaignId } = payload;
      const records = this.getRecords();
      records.forEach((r) => {
        if (r.campaignId === campaignId && r.lifecycleStatus === LifecycleStatus.READY) {
          this.archiveAsset(r.id);
        }
      });
    } else if (name === 'workspace.cleared') {
      this.saveRecords([]);
    }
  }
}

export const assetPipelineService = new AssetPipelineService();

let assetPipelineEventUnsubscribe: (() => void) | null = null;

/**
 * Initializes the Asset Pipeline's Creative Event Bus consumer exactly once.
 * The returned cleanup is safe for React StrictMode remounts and tests.
 */
export function initializeAssetPipelineEventConsumer(): () => void {
  if (!assetPipelineEventUnsubscribe) {
    assetPipelineEventUnsubscribe = subscribeToCreativeEvents((event) => {
      assetPipelineService.handleConsumedEvent(event.name, event.payload);
    });
  }

  return shutdownAssetPipelineEventConsumer;
}

export function shutdownAssetPipelineEventConsumer(): void {
  assetPipelineEventUnsubscribe?.();
  assetPipelineEventUnsubscribe = null;
}
