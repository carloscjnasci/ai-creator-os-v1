import { AnalyticsPlatform, PerformanceSnapshot, SnapshotStatus } from './types';

/**
 * IMPLEMENTATION-READY BACKEND CONTRACTS
 * 
 * Endpoints:
 * 1. POST /analytics/connections
 *    - Initiates or registers a new platform connection.
 * 2. POST /analytics/sync-jobs
 *    - Requests asynchronous synchronization of metrics from connected channels.
 * 3. GET /analytics/sync-jobs/:id
 *    - Checks status of a synchronization job.
 * 4. GET /analytics/snapshots
 *    - Retrieves normalized historical performance snapshots.
 * 5. POST /analytics/manual-snapshots
 *    - Allows posting validated manually aggregated metrics.
 * 6. DELETE /analytics/connections/:id
 *    - Revokes a connection and destroys all stored credentials.
 */

export interface CreateConnectionRequest {
  platform: AnalyticsPlatform;
  workspaceId: string;
  authorizationCode?: string; // Standard OAuth auth code from redirect flow
  redirectUri?: string;
  externalChannelId?: string;
  channelName?: string;
}

export interface ConnectionRecord {
  id: string;
  workspaceId: string;
  platform: AnalyticsPlatform;
  externalChannelId: string;
  channelName: string;
  connectionStatus: 'active' | 'suspended' | 'expired';
  connectedAt: string;
  expiresAt?: string;
}

export interface CreateSyncJobRequest {
  connectionId: string;
  workspaceId: string;
  metricWindow: string; // e.g., 'first_24_hours', 'lifetime'
  periodStart?: string;
  periodEnd?: string;
}

export interface SyncJobRecord {
  id: string;
  connectionId: string;
  workspaceId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  snapshotsCreatedCount: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

export interface GetSnapshotsQuery {
  workspaceId: string;
  platform?: AnalyticsPlatform;
  campaignId?: string;
  status?: SnapshotStatus;
}

export interface CreateManualSnapshotRequest {
  workspaceId: string;
  platform: AnalyticsPlatform;
  periodStart: string;
  periodEnd: string;
  currency: string;
  metricWindow: string;
  
  // Linage mappings
  campaignId?: string;
  creativeIntentId?: string;
  creativePlanId?: string;
  digitalHumanId?: string;
  productId?: string;

  // Manual metrics entered
  impressions?: number;
  reach?: number;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  clicks?: number;
  purchases?: number;
  revenue?: number;
  spend?: number;
}

/**
 * CLIENT PROXY INTERFACE FOR FRONTEND
 * 
 * Implements clean frontend responsibility boundaries:
 * - Requests connections and syncs.
 * - Displays aggregate outputs.
 * - Stores returned stable database IDs.
 * - NEVER handles client secrets or access/refresh tokens.
 */
export interface SecureAnalyticsBackendClient {
  /**
   * POST /analytics/connections
   * Handled backend-side: OAuth token exchanges, encrypted credential storage, audit log registration.
   */
  createConnection(req: CreateConnectionRequest): Promise<ConnectionRecord>;

  /**
   * DELETE /analytics/connections/:id
   * Handled backend-side: Access token revocation, remote hook teardowns, secure token erasure.
   */
  deleteConnection(connectionId: string, workspaceId: string): Promise<{ success: boolean }>;

  /**
   * POST /analytics/sync-jobs
   * Handled backend-side: Rate-limiting, API communication, audience PII scrubbing, snapshot creation.
   */
  startSyncJob(req: CreateSyncJobRequest): Promise<SyncJobRecord>;

  /**
   * GET /analytics/sync-jobs/:id
   */
  getSyncJobStatus(jobId: string): Promise<SyncJobRecord>;

  /**
   * GET /analytics/snapshots
   */
  fetchSnapshots(query: GetSnapshotsQuery): Promise<PerformanceSnapshot[]>;

  /**
   * POST /analytics/manual-snapshots
   * Handled backend-side: Validation of aggregates, calculation of baseline derivatives, normalized storage.
   */
  createManualSnapshot(req: CreateManualSnapshotRequest): Promise<PerformanceSnapshot>;
}
