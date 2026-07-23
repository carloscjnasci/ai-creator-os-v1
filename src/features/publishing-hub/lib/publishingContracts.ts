import type { PublicationDraft, PublishingPlatform } from '../types';

export interface CreatePublishingSessionRequest {
  publicationId: string;
  platform: PublishingPlatform;
  connectionId?: string;
  idempotencyKey: string;
  scheduledAt?: string;
  payload: {
    title: string;
    caption: string;
    hashtags: string[];
    mentions: string[];
    destinationUrl?: string;
    assetId: string;
  };
}

export interface CreatePublishingSessionResponse {
  jobId: string;
  status: 'queued' | 'running';
  acceptedAt: string;
}

export interface PublishingJobResponse {
  jobId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  remotePostId?: string;
  permalink?: string;
  publishedAt?: string;
  failureCode?: string;
  failureMessage?: string;
}

export interface PublishingBackendTransport {
  createSession(request: CreatePublishingSessionRequest): Promise<CreatePublishingSessionResponse>;
  getJob(jobId: string): Promise<PublishingJobResponse>;
  cancelJob(jobId: string): Promise<void>;
}

export function toPublishingSessionRequest(publication: PublicationDraft): CreatePublishingSessionRequest {
  if (!publication.creativeAssetId) throw new Error('Publication requires a Creative Library asset.');
  return {
    publicationId: publication.id,
    platform: publication.platform,
    connectionId: publication.connectionId,
    idempotencyKey: publication.idempotencyKey,
    scheduledAt: publication.scheduledAt,
    payload: {
      title: publication.title,
      caption: publication.caption,
      hashtags: publication.hashtags,
      mentions: publication.mentions,
      destinationUrl: publication.destinationUrl,
      assetId: publication.creativeAssetId,
    },
  };
}
