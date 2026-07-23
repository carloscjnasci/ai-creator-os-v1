export enum SourceType {
  PROVIDER_GENERATION = 'provider_generation',
  USER_UPLOAD = 'user_upload',
  IMPORTED_URL = 'imported_url',
  DERIVED_ASSET = 'derived_asset',
  LEGACY_LIBRARY_ASSET = 'legacy_library_asset',
}

export enum AssetType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  THUMBNAIL = 'thumbnail',
  OTHER = 'other',
}

export enum LifecycleStatus {
  PENDING = 'pending',
  INGESTING = 'ingesting',
  PROCESSING = 'processing',
  READY = 'ready',
  FAILED = 'failed',
  ARCHIVED = 'archived',
  DELETED = 'deleted',
}

export enum ProcessingStatus {
  NOT_STARTED = 'not_started',
  VALIDATING = 'validating',
  HASHING = 'hashing',
  UPLOADING = 'uploading',
  EXTRACTING_METADATA = 'extracting_metadata',
  GENERATING_PREVIEW = 'generating_preview',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum ChecksumAlgorithm {
  SHA256 = 'sha256',
  PROVIDER_ETAG = 'provider_etag',
}

export interface CloudAssetRecord {
  id: string;
  workspaceId?: string;
  campaignId?: string;
  executionId?: string;
  executionTaskId?: string;
  providerJobId?: string;
  creativeLibraryAssetId?: string;
  parentAssetId?: string;
  sourceType: SourceType;
  assetType: AssetType;
  lifecycleStatus: LifecycleStatus;
  processingStatus: ProcessingStatus;
  originalFilename?: string;
  displayName: string;
  mimeType?: string;
  extension?: string;
  byteSize?: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  checksum?: string;
  checksumAlgorithm?: ChecksumAlgorithm;
  storageProvider?: string;
  storageKey?: string;
  bucket?: string;
  region?: string;
  publicUrl?: string;
  signedUrl?: string;
  signedUrlExpiresAt?: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  metadata?: Record<string, unknown>;
  tags: string[];
  modelProvider?: string;
  modelName?: string;
  promptHistoryId?: string;
  digitalHumanId?: string;
  productId?: string;
  wardrobeItemId?: string;
  sceneId?: string;
  retentionPolicy?: string;
  retentionUntil?: string;
  legalHold?: boolean;
  deletionRequestedAt?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
  uploadedAt?: string;
  processedAt?: string;
  archivedAt?: string;
  failureCode?: string;
  failureMessage?: string;
  attemptCount: number;
}
