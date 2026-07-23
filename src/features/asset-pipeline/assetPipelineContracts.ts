export interface InitializeUploadRequest {
  filename: string;
  mimeType: string;
  byteSize: number;
  assetType: string;
  workspaceId?: string;
  campaignId?: string;
  executionTaskId?: string;
  idempotencyKey?: string;
}

export interface InitializeUploadResponse {
  uploadSessionId: string;
  storageKey: string;
  uploadMethod: 'PUT' | 'POST' | 'MULTIPART';
  uploadUrl: string;
  uploadHeaders?: Record<string, string>;
  expiresAt: string;
}

export interface UploadPartRequest {
  uploadSessionId: string;
  storageKey: string;
  chunk: Blob | ArrayBuffer | File;
  uploadUrl?: string;
  uploadHeaders?: Record<string, string>;
  partNumber?: number;
  onProgress?: (progress: number) => void;
  abortSignal?: AbortSignal;
}

export interface UploadPartResponse {
  partIdentifier?: string;
  success: boolean;
}

export interface CompleteUploadRequest {
  uploadSessionId: string;
  storageKey: string;
  parts?: Array<{ partNumber: number; partIdentifier: string }>;
}

export interface CompleteUploadResponse {
  success: boolean;
  publicUrl?: string;
  byteSize: number;
  checksum?: string;
}

export interface AbortUploadRequest {
  uploadSessionId: string;
  storageKey: string;
}

export interface AbortUploadResponse {
  success: boolean;
}

export interface GetObjectMetadataRequest {
  storageKey: string;
  bucket?: string;
}

export interface AssetObjectMetadata {
  storageKey: string;
  byteSize: number;
  mimeType: string;
  checksum?: string;
  updatedAt: string;
  customMetadata?: Record<string, string>;
}

export interface CreateSignedReadUrlRequest {
  storageKey: string;
  expiresInSeconds?: number;
}

export interface CreateSignedReadUrlResponse {
  signedUrl: string;
  expiresAt: string;
}

export interface DeleteObjectRequest {
  storageKey: string;
}

export interface DeleteObjectResponse {
  success: boolean;
}

export interface ObjectExistsRequest {
  storageKey: string;
}

export interface ObjectExistsResponse {
  exists: boolean;
}

export interface AssetStorageError {
  code: string;
  message: string;
  statusCode?: number;
  retryable: boolean;
}

/**
 * Provider-agnostic AssetStorageAdapter interface.
 * Implemented by both simulation (mock) and real cloud-backed transports.
 * The frontend client consumes this adapter without needing any cloud credentials.
 */
export interface AssetStorageAdapter {
  initializeUpload(request: InitializeUploadRequest): Promise<InitializeUploadResponse>;
  upload(request: UploadPartRequest): Promise<UploadPartResponse>;
  completeUpload(request: CompleteUploadRequest): Promise<CompleteUploadResponse>;
  abortUpload(request: AbortUploadRequest): Promise<AbortUploadResponse>;
  getObjectMetadata(request: GetObjectMetadataRequest): Promise<AssetObjectMetadata>;
  createSignedReadUrl(request: CreateSignedReadUrlRequest): Promise<CreateSignedReadUrlResponse>;
  deleteObject(request: DeleteObjectRequest): Promise<DeleteObjectResponse>;
  objectExists(request: ObjectExistsRequest): Promise<ObjectExistsResponse>;
}

/**
 * ============================================================================
 * SECURE BACKEND API CONTRACTS (DOCUMENTATION & IMPLEMENTATION REFERENCE)
 * ============================================================================
 *
 * This section documents the design boundaries and type signatures of the backend
 * micro-services that fulfill the Cloud Asset Pipeline.
 *
 * Backend Responsibilities:
 *  1. Credentialed Cloud Operations: Securely interact with Cloud Storage (AWS, GCP, etc.)
 *     using IAM roles, service accounts, or credential keys hidden from the public.
 *  2. Ownership Verification: Ensure the calling user/workspace owns the referenced
 *     workspace, campaign, or asset before executing reads or modifications.
 *  3. Input Enforcement: Reject file types and sizes that exceed campaign rules.
 *  4. Checksum Verification: Compute/Verify MD5/SHA256 of uploaded blobs to ensure integrity.
 *  5. Malware-Scanning: Integration point for automatic virus scanner webhooks.
 *  6. Signed Read URL generation with strict TTL limits.
 *  7. Secure object deletion and enforcing legal/retention hold policies.
 *
 * Frontend Responsibilities:
 *  1. Gathering asset metadata (MIME type, size, extension) before starting upload.
 *  2. Prompting progress reporting to users.
 *  3. Dispatching authorized uploads using credentials-free presigned URLs.
 *  4. Persisting non-sensitive metadata (such as asset records, tags, timestamps) in the UI.
 */

/**
 * POST /asset-uploads
 * Initializes a new secure upload session.
 */
export interface PostAssetUploadsContract {
  path: '/asset-uploads';
  method: 'POST';
  requestBody: {
    filename: string;
    mimeType: string;
    byteSize: number;
    checksum?: string;
    assetType: string;
    workspaceId: string;
    campaignId?: string;
    executionTaskId?: string;
  };
  responseBody: {
    uploadSessionId: string;
    storageKey: string;
    uploadMethod: 'PUT' | 'POST' | 'MULTIPART';
    uploadUrl: string;
    uploadHeaders?: Record<string, string>;
    expiresAt: string;
  };
}

/**
 * POST /asset-uploads/:id/complete
 * Confirms that all chunks have been uploaded and requests final assembly, verification, and transition to ready.
 */
export interface PostAssetUploadCompleteContract {
  path: '/asset-uploads/:id/complete';
  method: 'POST';
  requestParams: {
    id: string; // uploadSessionId
  };
  requestBody: {
    storageKey: string;
    parts?: Array<{ partNumber: number; partIdentifier: string }>;
  };
  responseBody: {
    success: boolean;
    assetId: string;
    publicUrl?: string;
    byteSize: number;
    checksum: string;
  };
}

/**
 * DELETE /asset-uploads/:id
 * Aborts an active, uncompleted upload session and garbage collects any partial chunks.
 */
export interface DeleteAssetUploadContract {
  path: '/asset-uploads/:id';
  method: 'DELETE';
  requestParams: {
    id: string; // uploadSessionId
  };
  responseBody: {
    success: boolean;
  };
}

/**
 * GET /assets/:id
 * Returns current metadata and processing status of a registered Cloud Asset.
 */
export interface GetAssetMetadataContract {
  path: '/assets/:id';
  method: 'GET';
  requestParams: {
    id: string; // storageKey or assetId
  };
  responseBody: {
    id: string;
    storageKey: string;
    byteSize: number;
    mimeType: string;
    lifecycleStatus: string;
    processingStatus: string;
    checksum?: string;
    updatedAt: string;
    metadata?: Record<string, unknown>;
  };
}

/**
 * POST /assets/:id/signed-url
 * Generates an ephemeral, secure read URL for an asset.
 */
export interface PostAssetSignedUrlContract {
  path: '/assets/:id/signed-url';
  method: 'POST';
  requestParams: {
    id: string; // storageKey or assetId
  };
  requestBody: {
    expiresInSeconds?: number;
  };
  responseBody: {
    signedUrl: string;
    expiresAt: string;
  };
}

/**
 * DELETE /assets/:id
 * Initiates soft or hard deletion of an asset. Respects legal hold configurations.
 */
export interface DeleteAssetContract {
  path: '/assets/:id';
  method: 'DELETE';
  requestParams: {
    id: string; // assetId
  };
  requestBody?: {
    forceHardDelete?: boolean;
  };
  responseBody: {
    success: boolean;
    deletionRequestedAt: string;
  };
}

/**
 * POST /assets/ingest-provider-result
 * Automates background ingestion of assets produced by AI providers.
 */
export interface PostAssetIngestProviderResultContract {
  path: '/assets/ingest-provider-result';
  method: 'POST';
  requestBody: {
    providerJobId: string;
    providerName: string;
    outputUrl: string; // Temporary remote url from provider (e.g. Midjourney, Imagen, etc.)
    assetType: string;
    displayName: string;
    campaignId?: string;
    workspaceId: string;
  };
  responseBody: {
    success: boolean;
    assetId: string;
    storageKey: string;
    lifecycleStatus: string;
  };
}
