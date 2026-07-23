import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWorkspaceBackup, restoreWorkspaceBackup, validateWorkspaceBackup } from '../workspaceBackup';
import { RESEARCH_SIGNAL_STORAGE_KEY } from '@/features/research-hub/lib/researchStorage';
import { CREATIVE_ASSET_STORAGE_KEY } from '@/features/creative-library/lib/creativeAssetStorage';
import { EXECUTION_RUN_STORAGE_KEY } from '@/features/execution-center/lib/executionRunStorage';
import { PROVIDER_JOB_STORAGE_KEY } from '@/features/provider-gateway/lib/providerJobStorage';
import { PROVIDER_CONNECTION_STORAGE_KEY } from '@/features/provider-gateway/lib/providerConnectionStorage';
import { ASSET_STORAGE_KEY } from '@/features/asset-pipeline/assetPipelineStorage';
import {
  PUBLICATION_DRAFT_STORAGE_KEY,
  PUBLISHING_JOB_STORAGE_KEY,
  PUBLISHING_CONNECTION_STORAGE_KEY,
  loadPublicationDrafts,
  loadPublishingConnections,
  loadPublishingJobs,
  savePublicationDrafts,
  savePublishingConnections,
  savePublishingJobs,
} from '@/features/publishing-hub/lib/publishingStorage';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => vi.restoreAllMocks());

describe('Workspace backup v7', () => {
  it('exports all COS, execution and provider collections and validates the result', () => {
    const backup = createWorkspaceBackup();
    expect(backup.version).toBe(10);
    expect(backup.researchSignals).toEqual([]);
    expect(backup.creativeAssets).toEqual([]);
    expect(backup.executionRuns).toEqual([]);
    expect(backup.providerJobs).toEqual([]);
    expect(backup.providerConnections?.length).toBeGreaterThan(0);
    expect(backup.publicationDrafts).toEqual([]);
    expect(backup.publishingJobs).toEqual([]);
    expect(backup.publishingConnections).toEqual([]);
    expect(backup.performanceSnapshots).toEqual([]);
    expect(backup.scorecards).toEqual([]);
    expect(backup.insights).toEqual([]);
    expect(backup.recommendations).toEqual([]);
    expect(backup.feedbackDecisions).toEqual([]);
    expect(backup.calibrationRecords).toEqual([]);
    expect(validateWorkspaceBackup(backup)).toBe(true);
  });


  it('exports and restores Publishing Hub metadata in backup v7', () => {
    const now = '2026-07-17T12:00:00.000Z';
    savePublicationDrafts([{
      id: 'publication-backup', workspaceId: 'workspace', platform: 'instagram', title: 'Title', caption: 'Caption', hashtags: ['#tag'], mentions: [],
      status: 'published', approvalRequired: true, approvedAt: now, approvedBy: 'Owner', timezone: 'UTC', adapterMode: 'mock',
      validation: { valid: true, issues: [], checkedAt: now, policyVersion: 'test' }, idempotencyKey: 'backup-key', remotePostId: 'remote-1',
      permalink: 'https://social.test/post/1', publishedAt: now, attemptCount: 1, metricsStatus: 'waiting', createdAt: now, updatedAt: now,
    }]);
    savePublishingJobs([{
      id: 'publishing-job-backup', publicationId: 'publication-backup', platform: 'instagram', adapterMode: 'mock', status: 'succeeded',
      idempotencyKey: 'backup-key', attempt: 1, maxAttempts: 3, remotePostId: 'remote-1', permalink: 'https://social.test/post/1', completedAt: now,
      createdAt: now, updatedAt: now,
    }]);
    savePublishingConnections([{
      id: 'connection-instagram', platform: 'instagram', displayName: 'Instagram', accountLabel: '@brand', status: 'mock-ready', adapterMode: 'mock', enabled: true, updatedAt: now,
    }]);

    const backup = createWorkspaceBackup();
    expect(backup.version).toBe(10);
    expect(backup.publicationDrafts).toHaveLength(1);
    expect(backup.publishingJobs).toHaveLength(1);
    expect(backup.publishingConnections).toHaveLength(1);

    window.localStorage.clear();
    expect(restoreWorkspaceBackup(backup)).toBe(true);
    expect(loadPublicationDrafts()[0].remotePostId).toBe('remote-1');
    expect(loadPublishingJobs()[0].status).toBe('succeeded');
    expect(loadPublishingConnections()[0].accountLabel).toBe('@brand');
  });

  it('restores Sprint 13E v6 backups with empty analytics-feedback collections', () => {
    const current = createWorkspaceBackup();
    const sprint13E = { ...current, version: 6 as const };
    delete sprint13E.performanceSnapshots;
    delete sprint13E.scorecards;
    delete sprint13E.insights;
    delete sprint13E.recommendations;
    delete sprint13E.feedbackDecisions;
    delete sprint13E.calibrationRecords;
    expect(validateWorkspaceBackup(sprint13E)).toBe(true);
    expect(restoreWorkspaceBackup(sprint13E)).toBe(true);
    expect(window.localStorage.getItem('ai_creator_os:performance_snapshots')).toBe('[]');
    expect(window.localStorage.getItem('ai_creator_os:scorecards')).toBe('[]');
    expect(window.localStorage.getItem('ai_creator_os:insights')).toBe('[]');
    expect(window.localStorage.getItem('ai_creator_os:recommendations')).toBe('[]');
    expect(window.localStorage.getItem('ai_creator_os:feedback_decisions')).toBe('[]');
    expect(window.localStorage.getItem('ai_creator_os:calibration_records')).toBe('[]');
  });

  it('restores Sprint 13D v5 backups with empty Publishing Hub collections', () => {
    const current = createWorkspaceBackup();
    const sprint13D = { ...current, version: 5 as const };
    delete sprint13D.publicationDrafts;
    delete sprint13D.publishingJobs;
    delete sprint13D.publishingConnections;
    delete sprint13D.performanceSnapshots;
    delete sprint13D.scorecards;
    delete sprint13D.insights;
    delete sprint13D.recommendations;
    delete sprint13D.feedbackDecisions;
    delete sprint13D.calibrationRecords;
    expect(validateWorkspaceBackup(sprint13D)).toBe(true);
    expect(restoreWorkspaceBackup(sprint13D)).toBe(true);
    expect(window.localStorage.getItem(PUBLICATION_DRAFT_STORAGE_KEY)).toBe('[]');
    expect(window.localStorage.getItem(PUBLISHING_JOB_STORAGE_KEY)).toBe('[]');
    expect(window.localStorage.getItem(PUBLISHING_CONNECTION_STORAGE_KEY)).toBe('[]');
  });

  it('rolls back every collection when a Publishing Hub write fails', () => {
    window.localStorage.setItem(PUBLICATION_DRAFT_STORAGE_KEY, JSON.stringify([{ legacy: true }]));
    const backup = createWorkspaceBackup();
    const original = window.localStorage.getItem(PUBLICATION_DRAFT_STORAGE_KEY);
    const nativeSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === PUBLISHING_JOB_STORAGE_KEY) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return nativeSetItem.call(this, key, value);
    });
    expect(restoreWorkspaceBackup(backup)).toBe(false);
    expect(window.localStorage.getItem(PUBLICATION_DRAFT_STORAGE_KEY)).toBe(original);
  });

  it('restores Sprint 13C v4 backups with empty cloud assets', () => {
    const current = createWorkspaceBackup();
    const sprint13C = { ...current, version: 4 as const };
    delete sprint13C.cloudAssets;
    delete sprint13C.publicationDrafts;
    delete sprint13C.publishingJobs;
    delete sprint13C.publishingConnections;
    expect(validateWorkspaceBackup(sprint13C)).toBe(true);
    expect(restoreWorkspaceBackup(sprint13C)).toBe(true);
    expect(window.localStorage.getItem(ASSET_STORAGE_KEY)).toBe('[]');
    expect(window.localStorage.getItem(PUBLICATION_DRAFT_STORAGE_KEY)).toBe('[]');
    expect(window.localStorage.getItem(PUBLISHING_JOB_STORAGE_KEY)).toBe('[]');
    expect(window.localStorage.getItem(PUBLISHING_CONNECTION_STORAGE_KEY)).toBe('[]');
  });

  it('restores legacy v1 backups with empty COS and execution collections', () => {
    const current = createWorkspaceBackup();
    const legacy = { ...current, version: 1 as const };
    delete legacy.researchSignals;
    delete legacy.viralAnalyses;
    delete legacy.digitalHumanProfiles;
    delete legacy.campaignWorkflows;
    delete legacy.promptExperiments;
    delete legacy.creativeAssets;
    delete legacy.creativePlans;
    delete legacy.executionRuns;
    delete legacy.providerJobs;
    delete legacy.providerConnections;
    delete legacy.publicationDrafts;
    delete legacy.publishingJobs;
    delete legacy.publishingConnections;
    expect(validateWorkspaceBackup(legacy)).toBe(true);
    expect(restoreWorkspaceBackup(legacy)).toBe(true);
    expect(window.localStorage.getItem(RESEARCH_SIGNAL_STORAGE_KEY)).toBe('[]');
    expect(window.localStorage.getItem(CREATIVE_ASSET_STORAGE_KEY)).toBe('[]');
    expect(window.localStorage.getItem(EXECUTION_RUN_STORAGE_KEY)).toBe('[]');
    expect(window.localStorage.getItem(PROVIDER_JOB_STORAGE_KEY)).toBe('[]');
    expect(window.localStorage.getItem(PROVIDER_CONNECTION_STORAGE_KEY)).toBe('[]');
  });

  it('restores Sprint 13A v2 backups with an empty execution collection', () => {
    const current = createWorkspaceBackup();
    const sprint13A = { ...current, version: 2 as const };
    delete sprint13A.executionRuns;
    delete sprint13A.providerJobs;
    delete sprint13A.providerConnections;
    delete sprint13A.publicationDrafts;
    delete sprint13A.publishingJobs;
    delete sprint13A.publishingConnections;
    expect(validateWorkspaceBackup(sprint13A)).toBe(true);
    expect(restoreWorkspaceBackup(sprint13A)).toBe(true);
    expect(window.localStorage.getItem(EXECUTION_RUN_STORAGE_KEY)).toBe('[]');
    expect(window.localStorage.getItem(PROVIDER_JOB_STORAGE_KEY)).toBe('[]');
  });

  it('restores Sprint 13B v3 backups with empty provider collections', () => {
    const current = createWorkspaceBackup();
    const sprint13B = { ...current, version: 3 as const };
    delete sprint13B.providerJobs;
    delete sprint13B.providerConnections;
    delete sprint13B.publicationDrafts;
    delete sprint13B.publishingJobs;
    delete sprint13B.publishingConnections;
    expect(validateWorkspaceBackup(sprint13B)).toBe(true);
    expect(restoreWorkspaceBackup(sprint13B)).toBe(true);
    expect(window.localStorage.getItem(PROVIDER_JOB_STORAGE_KEY)).toBe('[]');
    expect(window.localStorage.getItem(PROVIDER_CONNECTION_STORAGE_KEY)).toBe('[]');
  });

  describe('Workspace backup v10 specifications', () => {
    it('preserves user settings and locale exactly on backup and restore', () => {
      const originalSettings = {
        theme: 'dark' as const,
        promptDefaults: {
          outputType: 'image' as const,
          platform: 'veo-3' as const,
          aspectRatio: '16:9' as const,
          durationSeconds: 15,
        },
        analyticsDefaultRange: '7-days' as const,
        locale: 'pt-BR' as const,
      };

      const settingsKey = 'ai-creator-os.settings.v1';
      window.localStorage.setItem(settingsKey, JSON.stringify(originalSettings));
      
      const backup = createWorkspaceBackup();
      expect(backup.version).toBe(10);
      expect(backup.settings.locale).toBe('pt-BR');
      expect(backup.settings.theme).toBe('dark');

      // Clear storage
      window.localStorage.clear();

      // Restore backup and verify
      const success = restoreWorkspaceBackup(backup);
      expect(success).toBe(true);
      
      const restoredSettingsRaw = window.localStorage.getItem(settingsKey);
      expect(restoredSettingsRaw).toBeDefined();
      const restoredSettings = JSON.parse(restoredSettingsRaw!);
      expect(restoredSettings.locale).toBe('pt-BR');
      expect(restoredSettings.theme).toBe('dark');
    });

    it('sanitizes personal secrets, access tokens, and authorization headers', () => {
      const baseBackup = createWorkspaceBackup();
      const now = '2026-07-17T12:00:00.000Z';
      const backupWithSecrets: any = {
        ...baseBackup,
        publicationDrafts: [
          {
            id: 'draft-1',
            workspaceId: 'workspace',
            platform: 'instagram',
            title: 'Secret Draft',
            caption: 'Caption',
            hashtags: ['#tag'],
            mentions: [],
            status: 'published',
            approvalRequired: true,
            approvedAt: now,
            approvedBy: 'Owner',
            timezone: 'UTC',
            adapterMode: 'mock',
            validation: { valid: true, issues: [], checkedAt: now, policyVersion: 'test' },
            idempotencyKey: 'backup-key',
            remotePostId: 'remote-1',
            permalink: 'https://social.test/post/1',
            publishedAt: now,
            attemptCount: 1,
            metricsStatus: 'waiting',
            createdAt: now,
            updatedAt: now,
            authorization: 'Bearer super-secret-token-value',
            client_secret: '123456',
            publicInfo: 'safe-to-keep',
          }
        ]
      };

      expect(validateWorkspaceBackup(backupWithSecrets)).toBe(true);
      
      const restoredOk = restoreWorkspaceBackup(backupWithSecrets);
      expect(restoredOk).toBe(true);

      const restoredDrafts = JSON.parse(window.localStorage.getItem(PUBLICATION_DRAFT_STORAGE_KEY) || '[]');
      expect(restoredDrafts).toHaveLength(1);
      expect(restoredDrafts[0].publicInfo).toBe('safe-to-keep');
      expect(restoredDrafts[0].authorization).toBeUndefined();
      expect(restoredDrafts[0].client_secret).toBeUndefined();
    });

    it('performs atomic rollback of all collections if local storage setItem throws QuotaExceededError', () => {
      const campaignsKey = 'ai-creator-os.campaigns.v1';
      const charactersKey = 'ai-creator-os.characters.v1';

      // Setup some pre-existing data
      const initialCampaigns = [{ id: 'campaign-1', name: 'Initial Campaign', createdAt: '2026-07-18T20:11:27-07:00', status: 'draft' }];
      window.localStorage.setItem(campaignsKey, JSON.stringify(initialCampaigns));

      const backupToRestore = createWorkspaceBackup();
      // Verify initial state is in localStorage
      expect(window.localStorage.getItem(campaignsKey)).toContain('Initial Campaign');

      // Setup a spy on setItem that throws on a subsequent storage operation
      const nativeSetItem = Storage.prototype.setItem;
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
        if (key === charactersKey) {
          throw new DOMException('Mock Quota Exceeded Exception', 'QuotaExceededError');
        }
        return nativeSetItem.call(this, key, value);
      });

      // Attempt to restore must return false (rollback triggered)
      const restoreSuccess = restoreWorkspaceBackup(backupToRestore);
      expect(restoreSuccess).toBe(false);

      // Verify that the initial data remains unchanged after rollback
      const campaignsAfterFailedRestore = JSON.parse(window.localStorage.getItem(campaignsKey) || '[]');
      expect(campaignsAfterFailedRestore).toHaveLength(1);
      expect(campaignsAfterFailedRestore[0].name).toBe('Initial Campaign');
    });
  });
});
