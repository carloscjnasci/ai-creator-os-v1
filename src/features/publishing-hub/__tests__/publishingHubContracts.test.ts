import { beforeEach, describe, expect, it, vi } from 'vitest';
import { publishCreativeEvent } from '@/core/events/creativeEventBus';
import { buildCreativeGraph } from '@/core/knowledge-graph/creativeGraph';
import { mockPublishingAdapter } from '../adapters/mockPublishingAdapter';
import { createSecurePublishingAdapter } from '../adapters/securePublishingAdapter';
import type { PublicationDraft } from '../types';
import type { PublishingBackendTransport } from '../lib/publishingContracts';
import { initializePublishingEventConsumer } from '../lib/publishingService';
import {
  loadPublicationDrafts,
  loadPublishingConnections,
  parseStoredPublicationDrafts,
  savePublicationDrafts,
  savePublishingConnections,
  subscribeToPublicationDrafts,
} from '../lib/publishingStorage';

const NOW = '2026-07-17T12:00:00.000Z';

function draft(overrides: Partial<PublicationDraft> = {}): PublicationDraft {
  return {
    id: 'publication-1', workspaceId: 'workspace', campaignId: 'campaign-1', creativeAssetId: 'asset-1', platform: 'instagram',
    title: 'Title', caption: 'Caption', hashtags: ['#tag'], mentions: [], status: 'approved', approvalRequired: true, approvedAt: NOW, approvedBy: 'Owner',
    timezone: 'UTC', adapterMode: 'mock', validation: { valid: true, issues: [], checkedAt: NOW, policyVersion: 'test' }, idempotencyKey: 'key-1',
    attemptCount: 0, metricsStatus: 'not-requested', createdAt: NOW, updatedAt: NOW, ...overrides,
  };
}

beforeEach(() => window.localStorage.clear());

describe('Publishing Hub contracts', () => {
  it('filters invalid stored drafts while preserving valid entries', () => {
    const parsed = parseStoredPublicationDrafts(JSON.stringify([draft(), { ...draft(), id: '', status: 'unknown' }]));
    expect(parsed).toHaveLength(1);
  });

  it('returns an empty collection for malformed or non-array JSON', () => {
    expect(parseStoredPublicationDrafts('{broken')).toEqual([]);
    expect(parseStoredPublicationDrafts(JSON.stringify({ id: 'x' }))).toEqual([]);
  });

  it('publishing storage subscription ignores unrelated keys and cleans up', () => {
    const listener = vi.fn();
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const cleanup = subscribeToPublicationDrafts(listener);
    window.dispatchEvent(new StorageEvent('storage', { key: 'other', newValue: '[]', storageArea: window.localStorage }));
    expect(listener).not.toHaveBeenCalled();
    window.dispatchEvent(new StorageEvent('storage', { key: 'ai-creator-os.publication-drafts.v1', newValue: JSON.stringify([draft()]), storageArea: window.localStorage }));
    expect(listener).toHaveBeenCalledWith([draft()]);
    cleanup();
    expect(removeSpy).toHaveBeenCalled();
  });


  it('notifies same-tab subscribers after a successful save', () => {
    const listener = vi.fn();
    const cleanup = subscribeToPublicationDrafts(listener);
    savePublicationDrafts([draft()]);
    expect(listener).toHaveBeenCalledWith([draft()]);
    cleanup();
  });

  it('strips unknown credential-like fields from saved connection preferences', () => {
    savePublishingConnections([{
      id: 'connection-instagram',
      platform: 'instagram',
      displayName: 'Instagram channel',
      accountLabel: '@brand',
      status: 'mock-ready',
      adapterMode: 'mock',
      enabled: true,
      updatedAt: NOW,
      accessToken: 'must-not-persist',
      clientSecret: 'must-not-persist',
    } as any]);
    const serialized = window.localStorage.getItem('ai-creator-os.publishing-connections.v1') ?? '';
    expect(serialized).not.toContain('must-not-persist');
    expect(loadPublishingConnections()).toHaveLength(1);
  });

  it('mock publishing output is deterministic', async () => {
    const publication = draft();
    const first = await mockPublishingAdapter.publish({ publication, assetUrl: 'https://cdn.test/a.mp4', now: NOW });
    const second = await mockPublishingAdapter.publish({ publication, assetUrl: 'https://cdn.test/a.mp4', now: NOW });
    expect(second).toEqual(first);
  });

  it('secure adapter sends typed requests without credential fields', async () => {
    const createSession = vi.fn(async (request) => ({ jobId: 'job-1', status: 'queued' as const, acceptedAt: NOW }));
    const transport: PublishingBackendTransport = {
      createSession,
      getJob: vi.fn(async () => ({ jobId: 'job-1', status: 'succeeded' as const, remotePostId: 'remote-1', permalink: 'https://social.test/post/1', publishedAt: NOW })),
      cancelJob: vi.fn(async () => undefined),
    };
    const result = await createSecurePublishingAdapter(transport).publish({ publication: draft(), assetUrl: 'https://cdn.test/a.mp4', now: NOW });
    expect(result.remotePostId).toBe('remote-1');
    const request = createSession.mock.calls[0][0] as unknown as Record<string, unknown>;
    expect(JSON.stringify(request).toLowerCase()).not.toContain('token');
    expect(JSON.stringify(request).toLowerCase()).not.toContain('secret');
    expect(JSON.stringify(request).toLowerCase()).not.toContain('authorization');
  });

  it('archives campaign publications and clears publishing metadata through Event Bus events', () => {
    const cleanup = initializePublishingEventConsumer();
    savePublicationDrafts([draft()]);
    publishCreativeEvent('campaign.archived', { campaignId: 'campaign-1' });
    expect(loadPublicationDrafts()[0].status).toBe('archived');
    publishCreativeEvent('workspace.cleared', { workspaceId: 'workspace' });
    expect(loadPublicationDrafts()).toEqual([]);
    cleanup();
  });

  it('Creative Graph publishing relationships are idempotent', () => {
    const publication = draft();
    const job = { id: 'job-1', publicationId: publication.id, platform: publication.platform, adapterMode: 'mock' as const, status: 'succeeded' as const, idempotencyKey: 'key', attempt: 1, maxAttempts: 3, createdAt: NOW, updatedAt: NOW };
    const graph = buildCreativeGraph({ campaigns: [], promptHistory: [], assets: [], workflows: [], publications: [publication, publication], publishingJobs: [job, job] });
    expect(graph.nodes.filter((node) => node.type === 'publication')).toHaveLength(1);
    expect(graph.edges.filter((edge) => edge.relation === 'executes-publication')).toHaveLength(1);
  });
});
