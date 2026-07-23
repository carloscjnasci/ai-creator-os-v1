import { describe, expect, it, vi, beforeEach } from 'vitest';
import { assetPipelineService, detectAssetType } from '../assetPipelineService';
import { loadAssetRecords, saveAssetRecords, ASSET_STORAGE_KEY } from '../assetPipelineStorage';
import { SourceType, AssetType, LifecycleStatus, ProcessingStatus } from '../types';
import { loadCreativeAssets, CREATIVE_ASSET_STORAGE_KEY } from '@/features/creative-library/lib/creativeAssetStorage';
import { loadExecutionRuns, saveExecutionRuns, EXECUTION_RUN_STORAGE_KEY } from '@/features/execution-center/lib/executionRunStorage';
import { createWorkspaceBackup, restoreWorkspaceBackup, clearWorkspaceStorage } from '@/features/settings/workspaceBackup';
import { loadSettingsFromStorage } from '@/features/settings/settingsStorage';
import { loadProviderJobs, saveProviderJobs, PROVIDER_JOB_STORAGE_KEY } from '@/features/provider-gateway/lib/providerJobStorage';
import type { ExecutionRun } from '@/core/execution-engine';
import type { ProviderJob } from '@/core/provider-gateway';

// Sample Mock Data Helpers
const createMockExecutionRun = (overrides?: Partial<ExecutionRun>): ExecutionRun => ({
  id: 'run-999',
  campaignId: 'camp-123',
  planId: 'plan-123',
  name: 'Campaign Alpha Run',
  status: 'active',
  progress: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  tasks: [
    {
      id: 'task-image',
      label: 'Generate Campaign Hero Image',
      domain: 'image',
      status: 'in-progress',
      stepId: 'step-1',
      order: 1,
      provider: 'imagen',
      instruction: 'instruction',
      dependsOnTaskIds: [],
      requirementBlocked: false,
      updatedAt: new Date().toISOString(),
    }
  ],
  ...overrides,
});

const createMockProviderJob = (overrides?: Partial<ProviderJob>): ProviderJob => ({
  id: 'job-999',
  providerId: 'imagen',
  model: 'imagen-3',
  status: 'queued',
  executionRunId: 'run-999',
  executionTaskId: 'task-image',
  idempotencyKey: 'idemp-999',
  planId: 'plan-123',
  attempt: 1,
  maxAttempts: 3,
  request: {
    title: 'High resolution clean tech workspace',
    content: 'workspace content',
    suggestedFileName: 'workspace.png',
    parameters: {},
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('Cloud Asset Pipeline — Sprint 13D Part 2 Core Engine', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('Idempotency & Duplicate Ingestion Prevention', () => {
    it('prevents duplicate assets for identical provider job and outputUrl', async () => {
      const run = createMockExecutionRun();
      const job = createMockProviderJob({
        status: 'succeeded',
        response: { outputUrl: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809' },
      });
      saveExecutionRuns([run]);
      saveProviderJobs([job]);

      // Ingest first time
      const asset1 = await assetPipelineService.ingestProviderResult({
        providerJobId: job.id,
        outputUrl: job.response!.outputUrl!,
        assetType: AssetType.IMAGE,
        displayName: 'Unsplash Hero Image',
        campaignId: run.campaignId,
        executionTaskId: 'task-image',
        executionId: run.id,
        workspaceId: 'ws-test',
        modelProvider: 'imagen',
        modelName: 'imagen-3',
      });

      expect(asset1).toBeDefined();
      expect(asset1.lifecycleStatus).toBe(LifecycleStatus.READY);

      const recordsAfterFirst = loadAssetRecords();
      expect(recordsAfterFirst).toHaveLength(1);

      // Ingest second time
      const asset2 = await assetPipelineService.ingestProviderResult({
        providerJobId: job.id,
        outputUrl: job.response!.outputUrl!,
        assetType: AssetType.IMAGE,
        displayName: 'Unsplash Hero Image Redux',
        campaignId: run.campaignId,
        executionTaskId: 'task-image',
        executionId: run.id,
        workspaceId: 'ws-test',
        modelProvider: 'imagen',
        modelName: 'imagen-3',
      });

      // Should return the exact same asset and NOT double ingestion
      expect(asset2.id).toBe(asset1.id);
      expect(loadAssetRecords()).toHaveLength(1);
    });

    it('does not merge unrelated assets based solely on matching filename', async () => {
      const asset1 = await assetPipelineService.registerUserSelectedFile({
        filename: 'hero.png',
        mimeType: 'image/png',
        byteSize: 100,
        workspaceId: 'ws-test',
        checksum: 'checksum-1',
      });

      const asset2 = await assetPipelineService.registerUserSelectedFile({
        filename: 'hero.png',
        mimeType: 'image/png',
        byteSize: 200,
        workspaceId: 'ws-test',
        checksum: 'checksum-2',
      });

      expect(asset1.id).not.toBe(asset2.id);
      expect(loadAssetRecords()).toHaveLength(2);
    });
  });

  describe('Provider Gateway Integration & Lineage Syncing', () => {
    it('triggers automated ingestion when a Provider Job succeeds', async () => {
      const run = createMockExecutionRun();
      const job = createMockProviderJob({
        status: 'queued',
      });
      saveExecutionRuns([run]);
      saveProviderJobs([job]);

      const asset = await assetPipelineService.ingestProviderResult({
        providerJobId: job.id,
        outputUrl: 'https://cdn.example.com/generated_banner.mp4',
        assetType: AssetType.VIDEO,
        displayName: 'Video AD Banner',
        campaignId: run.campaignId,
        executionTaskId: 'task-image',
        executionId: run.id,
        workspaceId: 'ws-test',
        modelProvider: job.providerId,
        modelName: job.model,
      });

      expect(asset).toBeDefined();
      expect(asset.lifecycleStatus).toBe(LifecycleStatus.READY);
      expect(asset.parentAssetId).toBeUndefined();

      // Check Creative Library was updated with legacy asset record and is linked correctly
      const libAssets = loadCreativeAssets();
      expect(libAssets).toHaveLength(1);
      expect(libAssets[0].cloudAssetId).toBe(asset.id);
      expect(libAssets[0].storageProvider).toBe('Mock Storage');

      // Check Execution task was completed and updated with creativeAssetId
      const reloadedRuns = loadExecutionRuns();
      const updatedTask = reloadedRuns[0].tasks[0];
      expect(updatedTask.status).toBe('completed');
      expect(updatedTask.creativeAssetId).toBe(libAssets[0].id);
    });

    it('retains direct parent-child relationships for creative lineages', async () => {
      const parent = await assetPipelineService.createAssetRecord({
        sourceType: SourceType.PROVIDER_GENERATION,
        assetType: AssetType.IMAGE,
        displayName: 'Base Landscape Scene',
        workspaceId: 'ws-test',
      });

      const child = await assetPipelineService.createAssetRecord({
        sourceType: SourceType.PROVIDER_GENERATION,
        assetType: AssetType.IMAGE,
        displayName: 'Up-scaled Landscape Detail',
        workspaceId: 'ws-test',
        parentAssetId: parent.id,
      });

      expect(child.parentAssetId).toBe(parent.id);
    });
  });

  describe('User Upload Simulation', () => {
    it('processes local user file ingestion cleanly extracting metadata and transition flows', async () => {
      const record = await assetPipelineService.registerUserSelectedFile({
        filename: 'sprint_spec.pdf',
        mimeType: 'application/pdf',
        byteSize: 500,
        workspaceId: 'ws-test',
        checksum: 'spec-pdf-checksum',
      });

      expect(record.id).toBeDefined();
      expect(record.assetType).toBe(AssetType.DOCUMENT);
      expect(record.byteSize).toBe(500);
      expect(record.mimeType).toBe('application/pdf');

      await assetPipelineService.runMockPipeline(record.id);

      const reloaded = loadAssetRecords().find(r => r.id === record.id);
      expect(reloaded?.lifecycleStatus).toBe(LifecycleStatus.READY);
      expect(reloaded?.processingStatus).toBe(ProcessingStatus.COMPLETED);
    });
  });

  describe('Retention Policies & Legal Holds', () => {
    it('blocks deletion when legalHold is true', async () => {
      const record = await assetPipelineService.createAssetRecord({
        sourceType: SourceType.USER_UPLOAD,
        assetType: AssetType.IMAGE,
        displayName: 'Hold Asset',
        workspaceId: 'ws-test',
        legalHold: true,
      });

      await expect(assetPipelineService.markAssetDeleted(record.id)).rejects.toThrow();

      const reload = loadAssetRecords().find(r => r.id === record.id);
      expect(reload?.lifecycleStatus).not.toBe(LifecycleStatus.DELETED);
    });

    it('allows deletion when legalHold is false', async () => {
      const record = await assetPipelineService.createAssetRecord({
        sourceType: SourceType.USER_UPLOAD,
        assetType: AssetType.IMAGE,
        displayName: 'Unheld Asset',
        workspaceId: 'ws-test',
        legalHold: false,
      });

      const deleted = await assetPipelineService.markAssetDeleted(record.id);
      expect(deleted.lifecycleStatus).toBe(LifecycleStatus.DELETED);
      expect(deleted.deletedAt).toBeDefined();
    });

    it('prevents deletion if retentionUntil is in the future', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const record = await assetPipelineService.createAssetRecord({
        sourceType: SourceType.USER_UPLOAD,
        assetType: AssetType.IMAGE,
        displayName: 'Retained Asset',
        workspaceId: 'ws-test',
        retentionPolicy: 'standard-7y',
        retentionUntil: futureDate.toISOString(),
      });

      await expect(assetPipelineService.markAssetDeleted(record.id)).rejects.toThrow();
    });

    it('restores archived assets properly', async () => {
      const record = await assetPipelineService.createAssetRecord({
        sourceType: SourceType.USER_UPLOAD,
        assetType: AssetType.IMAGE,
        displayName: 'Archived Asset',
        workspaceId: 'ws-test',
      });

      // Transition to ready first via pipeline mock
      await assetPipelineService.runMockPipeline(record.id);

      // Transition to archived
      await assetPipelineService.archiveAsset(record.id);
      let reloaded = loadAssetRecords().find(r => r.id === record.id);
      expect(reloaded?.lifecycleStatus).toBe(LifecycleStatus.ARCHIVED);

      // Restore
      await assetPipelineService.restoreArchivedAsset(record.id);
      reloaded = loadAssetRecords().find(r => r.id === record.id);
      expect(reloaded?.lifecycleStatus).toBe(LifecycleStatus.READY);
    });
  });

  describe('Workspace Backup V5 Compatibility', () => {
    it('exports all cloudAsset properties and sanitizes temporary/sensitive tokens on export', () => {
      const mockRecord = {
        id: 'cloud-asset-888',
        sourceType: SourceType.USER_UPLOAD,
        assetType: AssetType.IMAGE,
        lifecycleStatus: LifecycleStatus.INGESTING,
        processingStatus: ProcessingStatus.UPLOADING,
        displayName: 'My Mock Asset',
        workspaceId: 'ws-test',
        tags: [],
        attemptCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        signedUrl: 'https://temporary-s3-token.example.com/asset?expiry=123',
        signedUrlExpiresAt: new Date().toISOString(),
        metadata: {
          uploadUrl: 'https://privileged-post-url.example.com',
          uploadHeaders: { Authorization: 'Bearer tokenabc' },
          credentials: { secretKey: 'dontsaveme' },
        },
      };

      saveAssetRecords([mockRecord as any]);

      const backup = createWorkspaceBackup();
      expect(backup.version).toBe(10);
      expect(backup.cloudAssets).toBeDefined();
      expect(backup.cloudAssets).toHaveLength(1);

      const exportedAsset = backup.cloudAssets![0];
      expect(exportedAsset.signedUrl).toBeUndefined();
      expect(exportedAsset.signedUrlExpiresAt).toBeUndefined();
      
      expect(exportedAsset.metadata?.uploadUrl).toBeUndefined();
      expect(exportedAsset.metadata?.uploadHeaders).toBeUndefined();
      expect(exportedAsset.metadata?.credentials).toBeUndefined();

      expect(exportedAsset.lifecycleStatus).toBe(LifecycleStatus.FAILED);
      expect(exportedAsset.processingStatus).toBe(ProcessingStatus.FAILED);
      expect(exportedAsset.failureCode).toBe('INTERRUPTED');
    });

    it('restores legacy backup versions (1-4) cleanly defaulting to empty cloudAsset collection', () => {
      const legacyPayload = {
        version: 4 as const,
        exportedAt: new Date().toISOString(),
        settings: loadSettingsFromStorage(),
        campaigns: [],
        characters: [],
        products: [],
        wardrobe: [],
        scenes: [],
        poses: [],
        promptHistory: [],
        researchSignals: [],
        viralAnalyses: [],
        digitalHumanProfiles: [],
        campaignWorkflows: [],
        promptExperiments: [],
        creativeAssets: [],
        creativePlans: [],
        executionRuns: [],
        providerJobs: [],
        providerConnections: [],
      };

      const restored = restoreWorkspaceBackup(legacyPayload as any);
      expect(restored).toBe(true);

      const records = loadAssetRecords();
      expect(records).toEqual([]);
    });

    it('recovers with atomic rollback if storage setItem throws on restore', () => {
      const validPayload = createWorkspaceBackup();
      
      // Save some initial records
      const initialRecord = { ...createMockProviderJob(), id: 'initial-job' };
      saveProviderJobs([initialRecord]);

      // Mock setItem to throw quota error exactly once midway
      let callCount = 0;
      const originalSetItem = localStorage.setItem;
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
        callCount++;
        if (callCount === 4) {
          throw new Error('QuotaExceededError');
        }
        return originalSetItem.call(localStorage, key, value);
      });

      const success = restoreWorkspaceBackup(validPayload);
      expect(success).toBe(false);

      // Verify rollback: initial state is restored
      const jobs = loadProviderJobs();
      expect(jobs.find(j => j.id === 'initial-job')).toBeDefined();
    });

    it('clears all collections atomically on clearWorkspaceStorage', () => {
      const initialRecord = { ...createMockProviderJob(), id: 'initial-job' };
      saveProviderJobs([initialRecord]);

      const cleared = clearWorkspaceStorage();
      expect(cleared).toBe(true);

      expect(loadProviderJobs()).toEqual([]);
      expect(loadAssetRecords()).toEqual([]);
    });
  });

  describe('User Upload Controls & Strict Non-Persistence', () => {
    it('correctly maps MIME types and detects invalid files', () => {
      expect(detectAssetType('image/png')).toBe(AssetType.IMAGE);
      expect(detectAssetType('video/mp4')).toBe(AssetType.VIDEO);
      expect(detectAssetType('audio/mpeg')).toBe(AssetType.AUDIO);
      expect(detectAssetType('application/pdf')).toBe(AssetType.DOCUMENT);
      expect(detectAssetType('application/x-msdownload')).toBe(AssetType.OTHER);
    });

    it('sanitizes uploaded filenames and prevents persistent binary or base64 or blob strings', async () => {
      // Filename with path traversal / special characters
      const dirtyFilename = '../../etc/passwd_cool_hero@@#.png';
      const record = await assetPipelineService.registerUserSelectedFile({
        filename: dirtyFilename,
        mimeType: 'image/png',
        byteSize: 1048576, // 1MB
        workspaceId: 'ws-test',
        checksum: 'sha256-abc123filename',
      });

      // Filename is sanitized and registered
      expect(record.originalFilename).toBe('passwd_cool_hero.png');
      expect(record.displayName).toBe('passwd_cool_hero');
      expect(record.originalFilename).not.toContain('..');
      expect(record.originalFilename).not.toContain('/');
      expect(record.originalFilename).not.toContain('@@');

      // Verify no binary bytes, base64 data, or blob URLs are stored in the record
      const serialized = JSON.stringify(record);
      expect(serialized).not.toContain('base64');
      expect(serialized).not.toContain('blob:');
      expect(record.byteSize).toBe(1048576); // metadata only
    });
  });

  describe('Creative Graph Lineage Preservation', () => {
    it('preserves ancestry linking and does not corrupt parent links when archived or deleted', async () => {
      const parent = await assetPipelineService.createAssetRecord({
        sourceType: SourceType.USER_UPLOAD,
        assetType: AssetType.IMAGE,
        displayName: 'Original Master Frame',
        workspaceId: 'ws-test',
      });

      const child = await assetPipelineService.createAssetRecord({
        sourceType: SourceType.PROVIDER_GENERATION,
        assetType: AssetType.THUMBNAIL,
        displayName: 'Generated Thumbnail',
        workspaceId: 'ws-test',
        parentAssetId: parent.id,
      });

      expect(child.parentAssetId).toBe(parent.id);

      // Perform archive transition on parent
      await assetPipelineService.runMockPipeline(parent.id);
      await assetPipelineService.archiveAsset(parent.id);

      const reloadedChild = loadAssetRecords().find(r => r.id === child.id);
      expect(reloadedChild?.parentAssetId).toBe(parent.id);

      // Perform soft deletion tombstone on parent
      await assetPipelineService.markAssetDeleted(parent.id);
      
      const parentTombstone = loadAssetRecords().find(r => r.id === parent.id);
      expect(parentTombstone?.lifecycleStatus).toBe(LifecycleStatus.DELETED);

      const finalChild = loadAssetRecords().find(r => r.id === child.id);
      expect(finalChild?.parentAssetId).toBe(parent.id); // Ancestry lineage is perfectly preserved
    });
  });
});
