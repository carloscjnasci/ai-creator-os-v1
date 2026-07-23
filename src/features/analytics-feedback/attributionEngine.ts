import { PerformanceSnapshot, AttributionResult, SnapshotStatus } from './types';

const ENTITY_MAPPING = [
  { key: 'publicationDraftId', name: 'publicationDraft' },
  { key: 'publicationJobId', name: 'publicationJob' },
  { key: 'campaignId', name: 'campaign' },
  { key: 'creativeIntentId', name: 'creativeIntent' },
  { key: 'creativePlanId', name: 'creativePlan' },
  { key: 'executionId', name: 'execution' },
  { key: 'executionTaskId', name: 'executionTask' },
  { key: 'providerJobId', name: 'providerJob' },
  { key: 'cloudAssetId', name: 'cloudAsset' },
  { key: 'creativeLibraryAssetId', name: 'creativeLibraryAsset' },
  { key: 'promptHistoryId', name: 'promptHistory' },
  { key: 'digitalHumanId', name: 'digitalHuman' },
  { key: 'productId', name: 'product' },
  { key: 'wardrobeItemId', name: 'wardrobeItem' },
  { key: 'sceneId', name: 'scene' },
] as const;

/**
 * Attributes a performance snapshot to all linked workspace entities.
 * Never guesses IDs; only relies on stable explicitly defined fields.
 */
export function attributeSnapshot(snapshot: PerformanceSnapshot): AttributionResult {
  const resolvedEntities: Record<string, boolean> = {};
  const unresolvedEntities: string[] = [];
  const lineagePath: Record<string, string> = {};
  const warnings: string[] = [];

  let resolvedCount = 0;

  for (const item of ENTITY_MAPPING) {
    const value = (snapshot as any)[item.key];
    if (value && typeof value === 'string' && value.trim() !== '') {
      resolvedEntities[item.name] = true;
      lineagePath[item.name] = value;
      resolvedCount++;
    } else {
      resolvedEntities[item.name] = false;
      unresolvedEntities.push(item.name);
      warnings.push(`Missing link: ${item.name} could not be resolved in snapshot lineage.`);
    }
  }

  // Calculate confidence based on the fraction of links resolved.
  const totalSteps = ENTITY_MAPPING.length;
  const confidence = resolvedCount / totalSteps;

  return {
    snapshotId: snapshot.id,
    resolvedEntities,
    unresolvedEntities,
    confidence: Number(confidence.toFixed(2)),
    warnings,
    lineagePath,
  };
}

/**
 * Transitions the snapshot status to ATTRIBUTED after resolving lineage relationships.
 */
export function executeAttribution(snapshot: PerformanceSnapshot): {
  attributedSnapshot: PerformanceSnapshot;
  result: AttributionResult;
} {
  const result = attributeSnapshot(snapshot);
  
  const currentStatus = snapshot.status;
  let newStatus = currentStatus;
  if (currentStatus === SnapshotStatus.NORMALIZED || currentStatus === SnapshotStatus.VALIDATED || currentStatus === SnapshotStatus.DRAFT) {
    newStatus = SnapshotStatus.ATTRIBUTED;
  }

  const attributedSnapshot = {
    ...snapshot,
    status: newStatus,
    updatedAt: new Date().toISOString(),
  };

  return {
    attributedSnapshot,
    result,
  };
}
