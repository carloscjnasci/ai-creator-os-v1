import { 
  PerformanceSnapshot, 
  PerformanceScorecard, 
  OutlierResult, 
  AnalyticsInsight, 
  InsightCategory, 
  InsightSeverity, 
  InsightStatus 
} from './types';

/**
 * Deterministically analyzes performance data to produce actionable, evidence-based AnalyticsInsight records.
 */
export function generateInsights(
  snapshot: PerformanceSnapshot,
  scorecard?: PerformanceScorecard,
  outliers: OutlierResult[] = []
): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = [];
  const workspaceId = snapshot.workspaceId;
  const snapshotId = snapshot.id;

  const relatedEntityIds: Record<string, string> = {};
  if (snapshot.campaignId) relatedEntityIds['campaign'] = snapshot.campaignId;
  if (snapshot.digitalHumanId) relatedEntityIds['digitalHuman'] = snapshot.digitalHumanId;
  if (snapshot.productId) relatedEntityIds['product'] = snapshot.productId;
  if (snapshot.cloudAssetId) relatedEntityIds['cloudAsset'] = snapshot.cloudAssetId;
  if (snapshot.promptHistoryId) relatedEntityIds['promptHistory'] = snapshot.promptHistoryId;
  if (snapshot.sceneId) relatedEntityIds['scene'] = snapshot.sceneId;

  // Process Outliers first as they are high-evidence indicators
  for (const outlier of outliers) {
    const isPositive = outlier.isPositiveOutlier;
    const severity = isPositive ? InsightSeverity.HIGH : InsightSeverity.CRITICAL;
    const title = isPositive
      ? `Performance Breakthrough: High Lift in ${outlier.comparisonGroup}`
      : `Performance Drop: Significant Anomaly in ${outlier.comparisonGroup}`;
    
    insights.push({
      id: `insight-outlier-${snapshotId}-${outlier.comparisonGroup}`,
      workspaceId,
      category: InsightCategory.OUTLIER,
      severity,
      title,
      summary: outlier.explanation,
      evidence: {
        metric: 'relativeLift',
        value: Number(outlier.relativeLift.toFixed(2)),
        baseline: Number(outlier.baselineValue.toFixed(2)),
        description: `Observed value of ${outlier.observedValue} compared to historical baseline of ${outlier.baselineValue.toFixed(2)}.`
      },
      relatedSnapshotIds: [snapshotId],
      relatedEntityIds,
      confidence: outlier.confidence,
      status: InsightStatus.NEW,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  // Hook Insight
  const views = snapshot.views || 0;
  const threeSec = snapshot.threeSecondViews || 0;
  if (views > 100 && threeSec > 0) {
    const hookRatio = threeSec / views;
    if (hookRatio < 0.25) {
      insights.push({
        id: `insight-hook-low-${snapshotId}`,
        workspaceId,
        category: InsightCategory.HOOK,
        severity: InsightSeverity.HIGH,
        title: 'Weak Audience Hook Phase',
        summary: 'A substantial portion of the audience is dropping off in the first three seconds. The video hook is failing to engage viewers early.',
        evidence: {
          metric: 'hookRatio',
          value: Number(hookRatio.toFixed(3)),
          baseline: 0.40,
          description: `Only ${Math.round(hookRatio * 100)}% of viewers stayed past 3 seconds, compared to our standard target baseline of 40%.`
        },
        relatedSnapshotIds: [snapshotId],
        relatedEntityIds,
        confidence: 0.9,
        status: InsightStatus.NEW,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } else if (hookRatio > 0.55) {
      insights.push({
        id: `insight-hook-high-${snapshotId}`,
        workspaceId,
        category: InsightCategory.HOOK,
        severity: InsightSeverity.MEDIUM,
        title: 'Outstanding Video Hook Performance',
        summary: 'Exceptional retention in the first three seconds indicates the opening hook is highly relevant and appealing to the target audience.',
        evidence: {
          metric: 'hookRatio',
          value: Number(hookRatio.toFixed(3)),
          baseline: 0.40,
          description: `${Math.round(hookRatio * 100)}% of viewers remained after 3 seconds, exceeding standard baseline of 40%.`
        },
        relatedSnapshotIds: [snapshotId],
        relatedEntityIds,
        confidence: 0.95,
        status: InsightStatus.NEW,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // Retention Insight
  if (snapshot.completionRate !== undefined) {
    if (snapshot.completionRate < 0.15) {
      insights.push({
        id: `insight-retention-low-${snapshotId}`,
        workspaceId,
        category: InsightCategory.RETENTION,
        severity: InsightSeverity.MEDIUM,
        title: 'Steep Mid-Video Dropoff',
        summary: 'Overall completion rate is low, indicating that interest is not sustained through the middle of the narrative timeline.',
        evidence: {
          metric: 'completionRate',
          value: Number(snapshot.completionRate.toFixed(3)),
          baseline: 0.25,
          description: `Completion rate of ${Math.round(snapshot.completionRate * 100)}% is below the healthy campaign standard of 25%.`
        },
        relatedSnapshotIds: [snapshotId],
        relatedEntityIds,
        confidence: 0.85,
        status: InsightStatus.NEW,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // Conversion Insight (ROAS, CVR, Purchases)
  if (snapshot.roas !== undefined) {
    if (snapshot.roas < 0.8) {
      insights.push({
        id: `insight-roas-low-${snapshotId}`,
        workspaceId,
        category: InsightCategory.CONVERSION,
        severity: InsightSeverity.HIGH,
        title: 'Sub-Optimal Ad Return (ROAS)',
        summary: 'The return on ad spend is currently unprofitable. Cost of distribution is outweighing generated purchase conversions.',
        evidence: {
          metric: 'roas',
          value: Number(snapshot.roas.toFixed(2)),
          baseline: 1.5,
          description: `ROAS of ${snapshot.roas.toFixed(2)}x is below the sustainable break-even model of 1.5x.`
        },
        relatedSnapshotIds: [snapshotId],
        relatedEntityIds,
        confidence: 1.0,
        status: InsightStatus.NEW,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } else if (snapshot.roas > 2.5) {
      insights.push({
        id: `insight-roas-high-${snapshotId}`,
        workspaceId,
        category: InsightCategory.CONVERSION,
        severity: InsightSeverity.HIGH,
        title: 'Highly Profitable Ad Run',
        summary: 'Ad spend is driving efficient revenue conversions. This campaign is in a premium scaling window.',
        evidence: {
          metric: 'roas',
          value: Number(snapshot.roas.toFixed(2)),
          baseline: 1.5,
          description: `ROAS of ${snapshot.roas.toFixed(2)}x greatly exceeds the target scaling benchmark of 1.5x.`
        },
        relatedSnapshotIds: [snapshotId],
        relatedEntityIds,
        confidence: 1.0,
        status: InsightStatus.NEW,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // Product Fit Insight
  const clicksVal = snapshot.clicks || 0;
  if (clicksVal > 0 && views > 0) {
    const clickRatio = clicksVal / views;
    if (clickRatio < 0.01) {
      insights.push({
        id: `insight-product-fit-low-${snapshotId}`,
        workspaceId,
        category: InsightCategory.PRODUCT_FIT,
        severity: InsightSeverity.MEDIUM,
        title: 'Weak Product Link Call-To-Action (CTA)',
        summary: 'Very few viewers are clicking the product link relative to total view counts, which suggests a weak visual CTA or poor audience product fit.',
        evidence: {
          metric: 'clickRatio',
          value: Number(clickRatio.toFixed(3)),
          baseline: 0.03,
          description: `Click-to-view ratio is ${Number((clickRatio * 100).toFixed(2))}% against an expected baseline of 3%.`
        },
        relatedSnapshotIds: [snapshotId],
        relatedEntityIds,
        confidence: 0.8,
        status: InsightStatus.NEW,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return insights;
}
