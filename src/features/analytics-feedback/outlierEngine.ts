import { PerformanceSnapshot, OutlierResult } from './types';

export interface OutlierOptions {
  thresholdMultiplier?: number; // e.g., 1.5 means > 150% or < 66% is an outlier
  minSampleSize?: number; // minimum matching history length to detect outliers, default 3
}

/**
 * Deterministically analyzes a PerformanceSnapshot against a collection of historical snapshots
 * to detect positive or negative outliers across various baselines.
 */
export function detectOutliers(
  snapshot: PerformanceSnapshot,
  history: PerformanceSnapshot[],
  metricKey: keyof PerformanceSnapshot,
  options: OutlierOptions = {}
): OutlierResult[] {
  const threshold = options.thresholdMultiplier ?? 1.5;
  const minSampleSize = options.minSampleSize ?? 3;

  const observedValue = snapshot[metricKey];
  if (typeof observedValue !== 'number' || !Number.isFinite(observedValue)) {
    return [];
  }

  // Define the baseline groups to check
  const groups = [
    {
      name: 'campaign_baseline',
      filter: (s: PerformanceSnapshot) => s.campaignId === snapshot.campaignId && s.campaignId !== undefined,
      description: 'same Campaign ID',
    },
    {
      name: 'platform_baseline',
      filter: (s: PerformanceSnapshot) => s.platform === snapshot.platform,
      description: 'same Platform',
    },
    {
      name: 'digital_human_baseline',
      filter: (s: PerformanceSnapshot) => s.digitalHumanId === snapshot.digitalHumanId && s.digitalHumanId !== undefined,
      description: 'same Digital Human',
    },
    {
      name: 'product_baseline',
      filter: (s: PerformanceSnapshot) => s.productId === snapshot.productId && s.productId !== undefined,
      description: 'same Product',
    },
    {
      name: 'asset_type_baseline',
      filter: (s: PerformanceSnapshot) => {
        const t1 = s.metadata?.assetType;
        const t2 = snapshot.metadata?.assetType;
        return t1 && t2 && t1 === t2;
      },
      description: 'same Asset Type',
    },
    {
      name: 'prompt_structure_baseline',
      filter: (s: PerformanceSnapshot) => s.promptHistoryId === snapshot.promptHistoryId && s.promptHistoryId !== undefined,
      description: 'same Prompt Structure',
    },
  ];

  const results: OutlierResult[] = [];

  for (const group of groups) {
    // Filter out the current snapshot from the baseline calculation
    const matchingHistory = history.filter(s => s.id !== snapshot.id && group.filter(s));
    const sampleSize = matchingHistory.length;

    if (sampleSize < minSampleSize) {
      // Insufficient history: no outlier claim
      continue;
    }

    // Extract metric values
    const values = matchingHistory
      .map(s => s[metricKey])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

    if (values.length < minSampleSize) {
      continue;
    }

    const sum = values.reduce((acc, v) => acc + v, 0);
    const baselineValue = sum / values.length;

    if (baselineValue === 0 && observedValue === 0) {
      continue; // No variation
    }

    const difference = observedValue - baselineValue;
    const relativeLift = baselineValue > 0 ? observedValue / baselineValue : (observedValue > 0 ? 999 : 1.0);

    const isPositiveOutlier = relativeLift >= threshold;
    const isNegativeOutlier = relativeLift <= (1 / threshold);

    if (isPositiveOutlier || isNegativeOutlier) {
      const confidence = Math.min(1.0, Number((sampleSize / 10).toFixed(2))); // confidence scales up to sample size 10
      const direction = isPositiveOutlier ? 'positive' : 'negative';
      const percentDiff = Math.abs(Math.round((relativeLift - 1) * 100));
      const explainText = isPositiveOutlier
        ? `This metric is a strong positive outlier! It is performing ${percentDiff}% above the average of the ${group.description} group.`
        : `This metric is a significant negative outlier, performing ${percentDiff}% below the average of the ${group.description} group.`;

      results.push({
        comparisonGroup: group.name,
        baselineValue,
        observedValue,
        difference,
        relativeLift,
        confidence,
        explanation: explainText,
        sampleSize,
        isPositiveOutlier,
        isNegativeOutlier,
      });
    }
  }

  return results;
}
