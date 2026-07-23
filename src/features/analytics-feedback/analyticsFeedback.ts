import { SnapshotStatus, PerformanceSnapshot } from './types';

const VALID_TRANSITIONS: Record<SnapshotStatus, SnapshotStatus[]> = {
  [SnapshotStatus.DRAFT]: [SnapshotStatus.VALIDATED, SnapshotStatus.FAILED],
  [SnapshotStatus.VALIDATED]: [SnapshotStatus.NORMALIZED, SnapshotStatus.FAILED],
  [SnapshotStatus.NORMALIZED]: [SnapshotStatus.ATTRIBUTED, SnapshotStatus.FAILED],
  [SnapshotStatus.ATTRIBUTED]: [SnapshotStatus.ANALYZED, SnapshotStatus.FAILED],
  [SnapshotStatus.ANALYZED]: [SnapshotStatus.ARCHIVED, SnapshotStatus.FAILED],
  [SnapshotStatus.FAILED]: [SnapshotStatus.DRAFT, SnapshotStatus.ARCHIVED],
  [SnapshotStatus.ARCHIVED]: [SnapshotStatus.ANALYZED],
};

/**
 * Validates whether a state transition for a PerformanceSnapshot is valid.
 */
export function isValidTransition(from: SnapshotStatus, to: SnapshotStatus): boolean {
  if (from === to) return true;
  const allowed = VALID_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Transitions a PerformanceSnapshot to a new status if the transition is allowed.
 * Throws an error if the transition is invalid.
 */
export function transitionSnapshot(
  snapshot: PerformanceSnapshot,
  newStatus: SnapshotStatus,
  error?: string
): PerformanceSnapshot {
  if (!isValidTransition(snapshot.status, newStatus)) {
    throw new Error(`Invalid transition from ${snapshot.status} to ${newStatus}`);
  }

  return {
    ...snapshot,
    status: newStatus,
    errorMessage: error || snapshot.errorMessage,
    updatedAt: new Date().toISOString(),
  };
}
