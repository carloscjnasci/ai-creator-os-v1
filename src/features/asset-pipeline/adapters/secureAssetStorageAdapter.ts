import {
  AssetStorageAdapter,
  InitializeUploadRequest,
  InitializeUploadResponse,
  UploadPartRequest,
  UploadPartResponse,
  CompleteUploadRequest,
  CompleteUploadResponse,
  AbortUploadRequest,
  AbortUploadResponse,
  GetObjectMetadataRequest,
  AssetObjectMetadata,
  CreateSignedReadUrlRequest,
  CreateSignedReadUrlResponse,
  DeleteObjectRequest,
  DeleteObjectResponse,
  ObjectExistsRequest,
  ObjectExistsResponse,
} from '../assetPipelineContracts';

/**
 * A contract-based secure asset storage adapter designed to interact with a secure backend.
 * All cloud provider credentials, IAM scopes, and signature keys are kept strictly server-side.
 * The client communicates with the backend via authorized endpoints or temporary, ephemeral URLs.
 */
export class SecureAssetStorageAdapter implements AssetStorageAdapter {
  private baseUrl: string;
  private fetchFn: typeof fetch;

  constructor(options?: { baseUrl?: string; fetchFn?: typeof fetch }) {
    this.baseUrl = options?.baseUrl || '/api';
    this.fetchFn = options?.fetchFn || (typeof window !== 'undefined' ? window.fetch.bind(window) : undefined) as any;
  }

  /**
   * Request the backend to issue a new upload session, generating a temporary presigned URL.
   */
  public async initializeUpload(request: InitializeUploadRequest): Promise<InitializeUploadResponse> {
    const res = await this.fetchFn(`${this.baseUrl}/asset-uploads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw {
        code: err.code || 'INITIALIZE_UPLOAD_FAILED',
        message: err.message || 'Failed to initialize secure upload session.',
        statusCode: res.status,
        retryable: res.status >= 500,
      };
    }

    return res.json();
  }

  /**
   * Uploads a chunk of data directly to the authorized cloud storage presigned URL.
   * This is done without passing any master cloud credentials through the frontend.
   */
  public async upload(request: UploadPartRequest): Promise<UploadPartResponse> {
    const uploadUrl = request.uploadUrl || `${this.baseUrl}/asset-uploads/${request.uploadSessionId}/chunk`;
    const headers = { ...request.uploadHeaders };

    // Standard behavior: perform PUT or POST with binary payload directly
    const res = await this.fetchFn(uploadUrl, {
      method: 'PUT',
      headers,
      body: request.chunk,
      signal: request.abortSignal,
    });

    if (!res.ok) {
      throw {
        code: 'UPLOAD_CHUNK_FAILED',
        message: `Upload chunk failed with status ${res.status}`,
        statusCode: res.status,
        retryable: res.status >= 500 || res.status === 408,
      };
    }

    // Capture the ETag or other header part identifier if available
    const partIdentifier = res.headers.get('ETag') || undefined;

    return {
      success: true,
      partIdentifier,
    };
  }

  /**
   * Signals upload completion so the backend can verify integrity and finalize the asset.
   */
  public async completeUpload(request: CompleteUploadRequest): Promise<CompleteUploadResponse> {
    const res = await this.fetchFn(`${this.baseUrl}/asset-uploads/${request.uploadSessionId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storageKey: request.storageKey,
        parts: request.parts,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw {
        code: err.code || 'COMPLETE_UPLOAD_FAILED',
        message: err.message || 'Failed to finalize asset upload.',
        statusCode: res.status,
        retryable: res.status >= 500,
      };
    }

    return res.json();
  }

  /**
   * Aborts an incomplete upload session and garbage collects any uploaded parts.
   */
  public async abortUpload(request: AbortUploadRequest): Promise<AbortUploadResponse> {
    const res = await this.fetchFn(`${this.baseUrl}/asset-uploads/${request.uploadSessionId}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw {
        code: err.code || 'ABORT_UPLOAD_FAILED',
        message: err.message || 'Failed to abort upload session.',
        statusCode: res.status,
        retryable: res.status >= 500,
      };
    }

    return res.json();
  }

  /**
   * Retrieves read-only metadata of the storage object.
   */
  public async getObjectMetadata(request: GetObjectMetadataRequest): Promise<AssetObjectMetadata> {
    const encodedKey = encodeURIComponent(request.storageKey);
    const res = await this.fetchFn(`${this.baseUrl}/assets/${encodedKey}`, {
      method: 'GET',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw {
        code: err.code || 'METADATA_FETCH_FAILED',
        message: err.message || 'Failed to retrieve asset metadata.',
        statusCode: res.status,
        retryable: res.status !== 404,
      };
    }

    return res.json();
  }

  /**
   * Requests a short-lived read URL for the given asset storage key from the secure backend.
   */
  public async createSignedReadUrl(request: CreateSignedReadUrlRequest): Promise<CreateSignedReadUrlResponse> {
    const encodedKey = encodeURIComponent(request.storageKey);
    const res = await this.fetchFn(`${this.baseUrl}/assets/${encodedKey}/signed-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expiresInSeconds: request.expiresInSeconds,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw {
        code: err.code || 'SIGNED_URL_FAILED',
        message: err.message || 'Failed to generate signed read URL.',
        statusCode: res.status,
        retryable: res.status >= 500,
      };
    }

    return res.json();
  }

  /**
   * Securely requests object deletion on the backend.
   */
  public async deleteObject(request: DeleteObjectRequest): Promise<DeleteObjectResponse> {
    const encodedKey = encodeURIComponent(request.storageKey);
    const res = await this.fetchFn(`${this.baseUrl}/assets/${encodedKey}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw {
        code: err.code || 'DELETE_OBJECT_FAILED',
        message: err.message || 'Failed to delete storage asset.',
        statusCode: res.status,
        retryable: res.status >= 500,
      };
    }

    return res.json();
  }

  /**
   * Checks if an object exists by checking its metadata on the backend.
   */
  public async objectExists(request: ObjectExistsRequest): Promise<ObjectExistsResponse> {
    try {
      await this.getObjectMetadata({ storageKey: request.storageKey });
      return { exists: true };
    } catch (err: any) {
      if (err.statusCode === 404 || err.code === 'NOT_FOUND') {
        return { exists: false };
      }
      throw err;
    }
  }
}
