import type { CreativeAsset } from '@/features/creative-library/types';
import type {
  PublicationDraft,
  PublicationValidationIssue,
  PublicationValidationResult,
  PublishingPlatform,
} from '../types';

export const PUBLISHING_POLICY_VERSION = 'cos-publishing-policy-2026.1';

export interface PublishingPlatformPolicy {
  platform: PublishingPlatform;
  titleRequired: boolean;
  titleMaxLength: number;
  captionMaxLength: number;
  hashtagLimit: number;
  allowedAssetTypes: CreativeAsset['type'][];
}

export const PUBLISHING_PLATFORM_POLICIES: Record<PublishingPlatform, PublishingPlatformPolicy> = {
  tiktok: { platform: 'tiktok', titleRequired: false, titleMaxLength: 100, captionMaxLength: 2200, hashtagLimit: 30, allowedAssetTypes: ['video'] },
  'tiktok-shop': { platform: 'tiktok-shop', titleRequired: false, titleMaxLength: 100, captionMaxLength: 2200, hashtagLimit: 30, allowedAssetTypes: ['video'] },
  youtube: { platform: 'youtube', titleRequired: true, titleMaxLength: 100, captionMaxLength: 5000, hashtagLimit: 15, allowedAssetTypes: ['video'] },
  instagram: { platform: 'instagram', titleRequired: false, titleMaxLength: 100, captionMaxLength: 2200, hashtagLimit: 30, allowedAssetTypes: ['image', 'video'] },
  pinterest: { platform: 'pinterest', titleRequired: true, titleMaxLength: 100, captionMaxLength: 500, hashtagLimit: 20, allowedAssetTypes: ['image', 'video'] },
  generic: { platform: 'generic', titleRequired: false, titleMaxLength: 200, captionMaxLength: 10000, hashtagLimit: 50, allowedAssetTypes: ['image', 'video', 'audio', 'thumbnail', 'document'] },
};

function issue(code: string, field: string, message: string, severity: 'error' | 'warning' = 'error'): PublicationValidationIssue {
  return { code, field, message, severity };
}

export function normalizeHashtag(value: string): string {
  const normalized = value.trim().replace(/^#+/, '').replace(/\s+/g, '');
  return normalized ? `#${normalized}` : '';
}

export function validatePublicationDraft(
  draft: Pick<PublicationDraft, 'platform' | 'title' | 'caption' | 'hashtags' | 'scheduledAt' | 'timezone' | 'creativeAssetId'>,
  asset?: CreativeAsset,
  now = new Date().toISOString(),
): PublicationValidationResult {
  const policy = PUBLISHING_PLATFORM_POLICIES[draft.platform];
  const issues: PublicationValidationIssue[] = [];
  const title = draft.title.trim();
  const caption = draft.caption.trim();
  const hashtags = draft.hashtags.map(normalizeHashtag).filter(Boolean);

  if (policy.titleRequired && !title) issues.push(issue('TITLE_REQUIRED', 'title', 'A title is required for this platform.'));
  if (title.length > policy.titleMaxLength) issues.push(issue('TITLE_TOO_LONG', 'title', `Title exceeds the configured ${policy.titleMaxLength}-character policy.`));
  if (!caption) issues.push(issue('CAPTION_REQUIRED', 'caption', 'A caption or description is required.'));
  if (caption.length > policy.captionMaxLength) issues.push(issue('CAPTION_TOO_LONG', 'caption', `Caption exceeds the configured ${policy.captionMaxLength}-character policy.`));
  if (hashtags.length > policy.hashtagLimit) issues.push(issue('TOO_MANY_HASHTAGS', 'hashtags', `Hashtags exceed the configured limit of ${policy.hashtagLimit}.`));
  if (new Set(hashtags.map((tag) => tag.toLowerCase())).size !== hashtags.length) issues.push(issue('DUPLICATE_HASHTAGS', 'hashtags', 'Remove duplicate hashtags.', 'warning'));
  if (!draft.timezone.trim()) issues.push(issue('TIMEZONE_REQUIRED', 'timezone', 'A timezone is required for scheduling.'));
  if (draft.scheduledAt && new Date(draft.scheduledAt).getTime() <= new Date(now).getTime()) issues.push(issue('SCHEDULE_IN_PAST', 'scheduledAt', 'Scheduled time must be in the future.'));
  if (!draft.creativeAssetId) issues.push(issue('ASSET_REQUIRED', 'creativeAssetId', 'Select a Creative Library asset before publishing.'));
  if (asset && !policy.allowedAssetTypes.includes(asset.type)) {
    issues.push(issue('ASSET_TYPE_NOT_ALLOWED', 'creativeAssetId', `${asset.type} assets are not allowed by the configured ${draft.platform} policy.`));
  }
  if (asset && !asset.sourceUrl.trim() && !asset.previewUrl?.trim()) issues.push(issue('ASSET_URL_REQUIRED', 'creativeAssetId', 'The selected asset has no usable source or preview URL.'));

  return {
    valid: issues.every((item) => item.severity !== 'error'),
    issues,
    checkedAt: now,
    policyVersion: PUBLISHING_POLICY_VERSION,
  };
}
