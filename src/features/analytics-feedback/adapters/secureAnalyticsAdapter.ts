import { 
  ConnectionRecord, 
  SyncJobRecord, 
  CreateConnectionRequest, 
  CreateSyncJobRequest, 
  GetSnapshotsQuery 
} from '../analyticsFeedbackContracts';
import { PerformanceSnapshot, AnalyticsPlatform } from '../types';

/**
 * Secure Analytics Adapter.
 * Frontend interface acting as a bridge to secure cloud endpoints.
 * This adapter is contract-only and does NOT receive, handle, or persist OAuth tokens or raw secrets.
 */
export class SecureAnalyticsAdapter {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || '/api/analytics';
  }

  /**
   * Triggers secure OAuth connection on backend.
   * Handled backend-side: OAuth exchange, token encryption, storage.
   */
  async createConnectionRequest(req: CreateConnectionRequest): Promise<ConnectionRecord> {
    const response = await fetch(`${this.baseUrl}/connections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });

    if (!response.ok) {
      throw new Error(`Failed to initiate secure connection request: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Requests asynchronous metrics synchronisation on backend.
   * Handled backend-side: Rate-limiting, queue execution.
   */
  async requestMetricsSync(req: CreateSyncJobRequest): Promise<SyncJobRecord> {
    const response = await fetch(`${this.baseUrl}/sync-jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });

    if (!response.ok) {
      throw new Error(`Failed to request metrics sync job: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Polls status of a running backend synchronization task.
   */
  async getSyncStatus(jobId: string): Promise<SyncJobRecord> {
    const response = await fetch(`${this.baseUrl}/sync-jobs/${jobId}`);

    if (!response.ok) {
      throw new Error(`Failed to retrieve sync status for job ${jobId}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Retrieves secure aggregated snapshots compiled by the backend.
   */
  async fetchSnapshots(query: GetSnapshotsQuery): Promise<PerformanceSnapshot[]> {
    const params = new URLSearchParams();
    params.append('workspaceId', query.workspaceId);
    if (query.platform) params.append('platform', query.platform);
    if (query.campaignId) params.append('campaignId', query.campaignId);
    if (query.status) params.append('status', query.status);

    const response = await fetch(`${this.baseUrl}/snapshots?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Failed to retrieve snapshots: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Revokes connected platform access and clears tokens from cloud database.
   */
  async disconnectChannel(connectionId: string, workspaceId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${this.baseUrl}/connections/${connectionId}?workspaceId=${workspaceId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to disconnect secure channel connection ${connectionId}: ${response.statusText}`);
    }

    return response.json();
  }
}
