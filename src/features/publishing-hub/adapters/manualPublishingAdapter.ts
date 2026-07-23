import type { PublishingAdapter, PublishingAdapterPublishRequest, PublishingAdapterPublishResult } from '../types';

export const manualPublishingAdapter: PublishingAdapter = {
  mode: 'manual',
  async publish(request: PublishingAdapterPublishRequest): Promise<PublishingAdapterPublishResult> {
    const publishedAt = request.now ?? new Date().toISOString();
    return {
      remotePostId: `manual-${request.publication.id}`,
      permalink: request.assetUrl,
      publishedAt,
    };
  },
};
