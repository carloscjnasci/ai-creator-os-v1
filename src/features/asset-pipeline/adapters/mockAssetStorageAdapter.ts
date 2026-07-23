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
 * A fully executable, browser-safe mock adapter for cloud asset storage operations.
 * This simulates upload progress, cancellation, configured failures, and key/metadata generation.
 * All operations clearly specify they are simulations and do not persist real file bytes.
 */
export class MockAssetStorageAdapter implements AssetStorageAdapter {
  private simulateFailure = false;
  private failureCode = 'MOCK_STORAGE_FAILED';
  private failureMessage = 'Simulated storage failure configured in Mock Adapter';
  private existingObjects = new Set<string>();
  
  // Deterministic state
  private sessionCounter = 0;
  private timeOffset = 0;
  private mockClock: () => number = () => Date.now() + this.timeOffset;

  /**
   * Configures the adapter to simulate failure on its active methods.
   */
  public setSimulateFailure(fail: boolean, code?: string, message?: string): void {
    this.simulateFailure = fail;
    if (code) this.failureCode = code;
    if (message) this.failureMessage = message;
  }

  /**
   * Sets an injectable clock function or static timestamp.
   */
  public setMockClock(clock: () => number): void {
    this.mockClock = clock;
  }

  /**
   * Resets the deterministic internal counters.
   */
  public resetCounter(): void {
    this.sessionCounter = 0;
    this.existingObjects.clear();
  }

  public async initializeUpload(request: InitializeUploadRequest): Promise<InitializeUploadResponse> {
    if (this.simulateFailure) {
      throw {
        code: this.failureCode,
        message: this.failureMessage,
        retryable: true,
      };
    }

    this.sessionCounter++;
    const sessionId = `mock-session-${this.sessionCounter}`;
    // Generate deterministic storage key
    const sanitizedFilename = request.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const timestamp = this.mockClock();
    const storageKey = `mock-assets/${request.workspaceId || 'default-workspace'}/${request.campaignId || 'unassigned'}/${timestamp}-${sanitizedFilename}`;

    return {
      uploadSessionId: sessionId,
      storageKey,
      uploadMethod: 'PUT',
      uploadUrl: `https://mock-storage.local/upload/${sessionId}`,
      expiresAt: new Date(timestamp + 3600000).toISOString(), // 1 hour expiration
    };
  }

  public async upload(request: UploadPartRequest): Promise<UploadPartResponse> {
    if (this.simulateFailure) {
      throw {
        code: this.failureCode,
        message: this.failureMessage,
        retryable: true,
      };
    }

    const totalSteps = 4;
    for (let step = 1; step <= totalSteps; step++) {
      if (request.abortSignal?.aborted) {
        throw {
          code: 'UPLOAD_CANCELLED',
          message: 'The asset upload was aborted by the client signal.',
          retryable: false,
        };
      }

      if (request.onProgress) {
        request.onProgress((step / totalSteps) * 100);
      }

      // Simulate network slice latency
      await new Promise((resolve) => setTimeout(resolve, 30));
    }

    const timestamp = this.mockClock();
    return {
      success: true,
      partIdentifier: `mock-part-etag-${timestamp}`,
    };
  }

  public async completeUpload(request: CompleteUploadRequest): Promise<CompleteUploadResponse> {
    if (this.simulateFailure) {
      throw {
        code: this.failureCode,
        message: this.failureMessage,
        retryable: true,
      };
    }

    this.existingObjects.add(request.storageKey);

    return {
      success: true,
      publicUrl: `https://mock-storage.local/view/${request.storageKey}`,
      byteSize: 2048,
      checksum: `mock-sha256-verification-checksum-value-${this.sessionCounter}`,
    };
  }

  public async abortUpload(request: AbortUploadRequest): Promise<AbortUploadResponse> {
    if (this.simulateFailure) {
      throw {
        code: this.failureCode,
        message: this.failureMessage,
        retryable: true,
      };
    }
    return { success: true };
  }

  public async getObjectMetadata(request: GetObjectMetadataRequest): Promise<AssetObjectMetadata> {
    if (this.simulateFailure) {
      throw {
        code: this.failureCode,
        message: this.failureMessage,
        retryable: true,
      };
    }

    if (!this.existingObjects.has(request.storageKey)) {
      throw {
        code: 'NOT_FOUND',
        message: `Object with storage key ${request.storageKey} does not exist in mock storage catalog.`,
        retryable: false,
      };
    }

    const timestamp = this.mockClock();
    return {
      storageKey: request.storageKey,
      byteSize: 2048,
      mimeType: 'application/octet-stream',
      checksum: `mock-sha256-verification-checksum-value-${this.sessionCounter}`,
      updatedAt: new Date(timestamp).toISOString(),
      customMetadata: {
        isMock: 'true',
        environment: 'browser-simulation',
        traceabilityId: `mock-trace-${this.sessionCounter}`,
      },
    };
  }

  public async createSignedReadUrl(request: CreateSignedReadUrlRequest): Promise<CreateSignedReadUrlResponse> {
    if (this.simulateFailure) {
      throw {
        code: this.failureCode,
        message: this.failureMessage,
        retryable: true,
      };
    }

    const ttl = request.expiresInSeconds || 3600;
    const timestamp = this.mockClock();
    const expiresAt = new Date(timestamp + ttl * 1000).toISOString();

    return {
      signedUrl: `https://mock-storage.local/read/${request.storageKey}?signature=mock-token-${ttl}&expires=${encodeURIComponent(expiresAt)}`,
      expiresAt,
    };
  }

  public async deleteObject(request: DeleteObjectRequest): Promise<DeleteObjectResponse> {
    if (this.simulateFailure) {
      throw {
        code: this.failureCode,
        message: this.failureMessage,
        retryable: true,
      };
    }

    const deleted = this.existingObjects.delete(request.storageKey);
    return { success: deleted };
  }

  public async objectExists(request: ObjectExistsRequest): Promise<ObjectExistsResponse> {
    if (this.simulateFailure) {
      throw {
        code: this.failureCode,
        message: this.failureMessage,
        retryable: true,
      };
    }

    return { exists: this.existingObjects.has(request.storageKey) };
  }
}
