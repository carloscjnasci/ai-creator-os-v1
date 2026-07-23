import { publishCreativeEvent } from '@/core/events/creativeEventBus';

export interface AssetEventPayload {
  assetId: string;
  workspaceId?: string;
  campaignId?: string;
  [key: string]: unknown;
}

export function publishAssetIngestionCreated(payload: AssetEventPayload): void {
  publishCreativeEvent('asset.ingestion.created', payload);
}

export function publishAssetIngestionStarted(payload: AssetEventPayload): void {
  publishCreativeEvent('asset.ingestion.started', payload);
}

export function publishAssetProcessingStarted(payload: AssetEventPayload): void {
  publishCreativeEvent('asset.processing.started', payload);
}

export function publishAssetReady(payload: AssetEventPayload & { publicUrl?: string }): void {
  publishCreativeEvent('asset.ready', payload);
}

export function publishAssetFailed(
  payload: AssetEventPayload & { failureCode: string; failureMessage: string },
): void {
  publishCreativeEvent('asset.failed', payload);
}

export function publishAssetRetryRequested(payload: AssetEventPayload): void {
  publishCreativeEvent('asset.retry.requested', payload);
}

export function publishAssetCancelled(payload: AssetEventPayload): void {
  publishCreativeEvent('asset.cancelled', payload);
}

export function publishAssetArchived(payload: AssetEventPayload): void {
  publishCreativeEvent('asset.archived', payload);
}

export function publishAssetRestored(payload: AssetEventPayload): void {
  publishCreativeEvent('asset.restored', payload);
}

export function publishAssetDeletionRequested(payload: AssetEventPayload): void {
  publishCreativeEvent('asset.deletion.requested', payload);
}

export function publishAssetDeleted(payload: AssetEventPayload): void {
  publishCreativeEvent('asset.deleted', payload);
}

export function publishAssetDerivativeCreated(
  payload: AssetEventPayload & { parentAssetId: string },
): void {
  publishCreativeEvent('asset.derivative.created', payload);
}

export function publishAssetSignedUrlRequested(payload: AssetEventPayload): void {
  publishCreativeEvent('asset.signed_url.requested', payload);
}
