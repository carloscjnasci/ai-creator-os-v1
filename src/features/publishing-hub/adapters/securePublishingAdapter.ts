import type { PublishingAdapter, PublishingAdapterPublishRequest, PublishingAdapterPublishResult } from '../types';
import type { PublishingBackendTransport } from '../lib/publishingContracts';
import { toPublishingSessionRequest } from '../lib/publishingContracts';

export function createSecurePublishingAdapter(transport: PublishingBackendTransport): PublishingAdapter {
  return {
    mode: 'secure-backend',
    async publish(request: PublishingAdapterPublishRequest): Promise<PublishingAdapterPublishResult> {
      const session = await transport.createSession(toPublishingSessionRequest(request.publication));
      const result = await transport.getJob(session.jobId);
      if (result.status !== 'succeeded' || !result.remotePostId || !result.permalink || !result.publishedAt) {
        throw new Error(result.failureMessage ?? 'Secure publishing job has not completed successfully.');
      }
      return { remotePostId: result.remotePostId, permalink: result.permalink, publishedAt: result.publishedAt };
    },
  };
}
