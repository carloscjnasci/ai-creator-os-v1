import { ExperimentVariant } from './types';

/**
 * A standard, simple, high-performance DJB2 string hashing algorithm.
 * It is completely deterministic and stable across reloads.
 */
export function getDeterministicHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

/**
 * Assigns an assignment unit (e.g. impression bucket, slot ID) deterministically to a variant.
 * 
 * @param experimentId The unique ID of the experiment.
 * @param assignmentUnitId The stable ID representing the assignment unit.
 * @param variants The variants of the experiment.
 * @param salt Optional workspace or tenant-level salt (must not be a secret key).
 * @returns The assigned ExperimentVariant, or null if invalid inputs.
 */
export function assignVariantDeterministically(
  experimentId: string,
  assignmentUnitId: string,
  variants: ExperimentVariant[],
  salt: string = ''
): ExperimentVariant | null {
  if (!experimentId || !assignmentUnitId || !variants || variants.length === 0) {
    return null;
  }

  // 1. Filter out variants with non-positive or non-finite weights
  const validVariants = variants.filter(v => v.allocationWeight > 0 && Number.isFinite(v.allocationWeight));
  if (validVariants.length === 0) {
    return null;
  }

  // 2. Sort variants alphabetically by ID to guarantee stable accumulation order
  const sortedVariants = [...validVariants].sort((a, b) => a.id.localeCompare(b.id));

  // 3. Compute total weight
  const totalWeight = sortedVariants.reduce((sum, v) => sum + v.allocationWeight, 0);
  if (totalWeight <= 0) {
    return null;
  }

  // 4. Generate stable hash
  const compositeKey = `${experimentId}:${assignmentUnitId}:${salt}`;
  const hash = getDeterministicHash(compositeKey);

  // 5. Map hash value to weight range [0, totalWeight - 1]
  const targetWeight = hash % totalWeight;

  // 6. Accumulate weights to select the variant
  let cumulativeWeight = 0;
  for (const variant of sortedVariants) {
    cumulativeWeight += variant.allocationWeight;
    if (targetWeight < cumulativeWeight) {
      return variant;
    }
  }

  // Fallback to control or first variant (should never be reached if totalWeight math is sound)
  return sortedVariants[0];
}
