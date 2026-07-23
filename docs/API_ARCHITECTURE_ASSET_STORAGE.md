# API Architecture & Asset Storage Design

This document details the interface contracts and API surface of the Cloud Asset Pipeline and its integrated storage adapter mechanics.

## 1. Storage Adapter Contract

All cloud integrations implement the standard interface defined in `/src/features/asset-pipeline/types.ts`:

```typescript
export interface CloudStorageAdapter {
  stageUpload(params: {
    recordId: string;
    filename: string;
    mimeType: string;
    byteSize: number;
  }): Promise<{
    uploadUrl: string;
    uploadHeaders: Record<string, string>;
    storageKey: string;
    bucket: string;
  }>;

  verifyChecksum(params: {
    storageKey: string;
    algorithm: ChecksumAlgorithm;
  }): Promise<{
    checksum: string;
    verified: boolean;
  }>;

  createSignedReadUrl(params: {
    storageKey: string;
    expiresInSeconds: number;
  }): Promise<{
    signedUrl: string;
    expiresAt: string;
  }>;
}
```

## 2. Ingestion Signatures

The `AssetPipelineService` offers clean entry points for all ingestion vectors:

- `registerUserSelectedFile(params)`: Initializes upload handshake for local files.
- `importRemoteUrl(params)`: Triggers automated cloud fetch and hash extraction.
- `ingestProviderResult(params)`: Processes results dispatched from AI Provider Gateway.

## 3. Physical Layout Conventions

Storage paths are designed to prevent resource collisions across workspaces:

```
workspaces/{workspaceId}/assets/{assetId}/original
workspaces/{workspaceId}/assets/{assetId}/derivatives/{derivativeType}
```
This guarantees physical separation of original media and generated variants under high-concurrency campaigns.
