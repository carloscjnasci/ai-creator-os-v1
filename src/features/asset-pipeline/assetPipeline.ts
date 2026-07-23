import { CloudAssetRecord, LifecycleStatus, ProcessingStatus } from './types';

/**
 * Pure transition validator for the Asset Lifecycle.
 * Enforces valid state pathways and terminal states.
 */
export function isValidTransition(current: LifecycleStatus, target: LifecycleStatus): boolean {
  if (current === target) return true;

  // A deleted asset is terminal and can never transition back to any active state
  if (current === LifecycleStatus.DELETED) {
    return false;
  }

  switch (current) {
    case LifecycleStatus.PENDING:
      return (
        target === LifecycleStatus.INGESTING ||
        target === LifecycleStatus.FAILED ||
        target === LifecycleStatus.DELETED
      );

    case LifecycleStatus.INGESTING:
      return (
        target === LifecycleStatus.PROCESSING ||
        target === LifecycleStatus.FAILED ||
        target === LifecycleStatus.DELETED
      );

    case LifecycleStatus.PROCESSING:
      return (
        target === LifecycleStatus.READY ||
        target === LifecycleStatus.FAILED ||
        target === LifecycleStatus.DELETED
      );

    case LifecycleStatus.FAILED:
      // A failed asset can restart ingestion (retry) or be deleted
      return target === LifecycleStatus.INGESTING || target === LifecycleStatus.DELETED;

    case LifecycleStatus.READY:
      return target === LifecycleStatus.ARCHIVED || target === LifecycleStatus.DELETED;

    case LifecycleStatus.ARCHIVED:
      // Restoring from archive returns it to ready, or it can be deleted
      return target === LifecycleStatus.READY || target === LifecycleStatus.DELETED;

    default:
      return false;
  }
}

/**
 * Executes a pure transition on a CloudAssetRecord, returning a new updated record.
 * Throws an error if the transition is invalid.
 */
export function transitionAsset(
  record: CloudAssetRecord,
  targetStatus: LifecycleStatus,
  options?: {
    failureCode?: string;
    failureMessage?: string;
    processingStatus?: ProcessingStatus;
  },
): CloudAssetRecord {
  if (!isValidTransition(record.lifecycleStatus, targetStatus)) {
    throw new Error(
      `Invalid lifecycle transition from '${record.lifecycleStatus}' to '${targetStatus}'`,
    );
  }

  const now = new Date().toISOString();
  
  // Clone record with basic transition updates
  const updated: CloudAssetRecord = {
    ...record,
    lifecycleStatus: targetStatus,
    updatedAt: now,
  };

  // Keep lineage/ancestry intact when archiving and restoring
  // Parent/derived attributes are naturally preserved in record.parentAssetId

  if (options?.processingStatus) {
    updated.processingStatus = options.processingStatus;
  }

  // Handle retry (failed -> ingesting)
  if (record.lifecycleStatus === LifecycleStatus.FAILED && targetStatus === LifecycleStatus.INGESTING) {
    updated.attemptCount = record.attemptCount + 1;
    // Clear failure logs when starting retry
    delete updated.failureCode;
    delete updated.failureMessage;
    updated.processingStatus = ProcessingStatus.VALIDATING;
  }

  // Handle failure record keeping
  if (targetStatus === LifecycleStatus.FAILED) {
    updated.failureCode = options?.failureCode || 'PROCESSING_ERROR';
    updated.failureMessage = options?.failureMessage || 'An unexpected processing issue occurred.';
    updated.processingStatus = ProcessingStatus.FAILED;
  }

  // Maintain explicit lifecycle status timestamps
  if (targetStatus === LifecycleStatus.INGESTING) {
    updated.uploadedAt = now;
  } else if (targetStatus === LifecycleStatus.READY) {
    updated.processedAt = now;
    updated.processingStatus = ProcessingStatus.COMPLETED;
  } else if (targetStatus === LifecycleStatus.ARCHIVED) {
    updated.archivedAt = now;
  } else if (targetStatus === LifecycleStatus.DELETED) {
    updated.deletedAt = now;
    updated.processingStatus = ProcessingStatus.NOT_STARTED;
  }

  return updated;
}
