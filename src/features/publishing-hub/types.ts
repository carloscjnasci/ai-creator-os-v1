import type { CreativePlatform } from '@/core/types';

export const PUBLISHING_PLATFORMS = [
  'tiktok',
  'tiktok-shop',
  'youtube',
  'instagram',
  'pinterest',
  'generic',
] as const satisfies readonly CreativePlatform[];

export type PublishingPlatform = (typeof PUBLISHING_PLATFORMS)[number];

export const PUBLICATION_STATUSES = [
  'draft',
  'in-review',
  'approved',
  'scheduled',
  'publishing',
  'published',
  'failed',
  'cancelled',
  'archived',
] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export const PUBLISHING_JOB_STATUSES = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
] as const;
export type PublishingJobStatus = (typeof PUBLISHING_JOB_STATUSES)[number];

export const PUBLISHING_ADAPTER_MODES = ['mock', 'manual', 'secure-backend'] as const;
export type PublishingAdapterMode = (typeof PUBLISHING_ADAPTER_MODES)[number];

export const PUBLISHING_CONNECTION_STATUSES = ['disconnected', 'mock-ready', 'connected', 'error'] as const;
export type PublishingConnectionStatus = (typeof PUBLISHING_CONNECTION_STATUSES)[number];

export type PublicationValidationSeverity = 'error' | 'warning';

export interface PublicationValidationIssue {
  code: string;
  field: string;
  message: string;
  severity: PublicationValidationSeverity;
}

export interface PublicationValidationResult {
  valid: boolean;
  issues: PublicationValidationIssue[];
  checkedAt: string;
  policyVersion: string;
}

export interface PublicationDraft {
  id: string;
  workspaceId: string;
  campaignId?: string;
  workflowId?: string;
  creativePlanId?: string;
  executionRunId?: string;
  executionTaskId?: string;
  creativeAssetId?: string;
  cloudAssetId?: string;
  digitalHumanId?: string;
  productId?: string;
  experimentId?: string;
  variantId?: string;
  platform: PublishingPlatform;
  connectionId?: string;
  title: string;
  caption: string;
  hashtags: string[];
  mentions: string[];
  destinationUrl?: string;
  thumbnailAssetId?: string;
  status: PublicationStatus;
  approvalRequired: boolean;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  scheduledAt?: string;
  timezone: string;
  adapterMode: PublishingAdapterMode;
  validation: PublicationValidationResult;
  idempotencyKey: string;
  activeJobId?: string;
  remotePostId?: string;
  permalink?: string;
  publishedAt?: string;
  failureCode?: string;
  failureMessage?: string;
  attemptCount: number;
  metricsStatus: 'not-requested' | 'waiting' | 'collecting' | 'complete' | 'failed';
  metadata?: Record<string, any>;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublishingJob {
  id: string;
  publicationId: string;
  platform: PublishingPlatform;
  adapterMode: PublishingAdapterMode;
  status: PublishingJobStatus;
  idempotencyKey: string;
  attempt: number;
  maxAttempts: number;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  remotePostId?: string;
  permalink?: string;
  failureCode?: string;
  failureMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublishingConnectionPreference {
  id: string;
  platform: PublishingPlatform;
  displayName: string;
  accountLabel: string;
  status: PublishingConnectionStatus;
  adapterMode: PublishingAdapterMode;
  enabled: boolean;
  lastVerifiedAt?: string;
  updatedAt: string;
}

export interface PublishingAdapterPublishRequest {
  publication: PublicationDraft;
  assetUrl: string;
  now?: string;
}

export interface PublishingAdapterPublishResult {
  remotePostId: string;
  permalink: string;
  publishedAt: string;
}

export interface PublishingAdapter {
  readonly mode: PublishingAdapterMode;
  publish(request: PublishingAdapterPublishRequest): Promise<PublishingAdapterPublishResult>;
  cancel?(job: PublishingJob): Promise<void>;
}
