import type { PublishingAdapter, PublishingAdapterPublishRequest, PublishingAdapterPublishResult } from '../types';

function stableToken(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export const mockPublishingAdapter: PublishingAdapter = {
  mode: 'mock',
  async publish(request: PublishingAdapterPublishRequest): Promise<PublishingAdapterPublishResult> {
    const publishedAt = request.now ?? new Date().toISOString();
    const token = stableToken(`${request.publication.id}:${request.publication.platform}:${request.assetUrl}`);
    return {
      remotePostId: `mock-post-${token}`,
      permalink: `https://mock.publisher.invalid/${request.publication.platform}/${token}`,
      publishedAt,
    };
  },
  async cancel() {
    return undefined;
  },
};
