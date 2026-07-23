import { PerformanceSnapshot, AnalyticsPlatform, AnalyticsSourceType, MetricWindow, SnapshotStatus } from '../types';
import { performanceSnapshotSchema } from '../analyticsFeedbackSchemas';
import { normalizeAndDeriveMetrics } from '../metricNormalizer';

/**
 * Manual Analytics Adapter.
 * Validates manual aggregate entries, cleans inputs, derives ratios, and outputs normalized snapshots.
 */
export class ManualAnalyticsAdapter {
  /**
   * Transforms and validates manual user inputs into a canonical validated performance snapshot.
   * Throws validation errors on negative metrics, non-finite values, or malformed data.
   */
  static processManualEntry(input: {
    id: string;
    workspaceId: string;
    platform: AnalyticsPlatform;
    metricWindow: MetricWindow;
    periodStart: string;
    periodEnd: string;
    currency: string;
    
    // Core optional metrics
    impressions?: number;
    reach?: number;
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
    clicks?: number;
    purchases?: number;
    revenue?: number;
    spend?: number;

    // Lineage keys
    campaignId?: string;
    creativeIntentId?: string;
    creativePlanId?: string;
    digitalHumanId?: string;
    productId?: string;
    metadata?: Record<string, any>;
  }): PerformanceSnapshot {
    // 1. Build initial PerformanceSnapshot object with DRAFT status
    const now = new Date().toISOString();
    const rawSnapshot: PerformanceSnapshot = {
      id: input.id,
      workspaceId: input.workspaceId,
      platform: input.platform,
      sourceType: AnalyticsSourceType.MANUAL_ENTRY,
      status: SnapshotStatus.DRAFT,
      
      metricWindow: input.metricWindow,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      capturedAt: now,
      currency: input.currency.toUpperCase(),

      impressions: input.impressions,
      reach: input.reach,
      views: input.views,
      likes: input.likes,
      comments: input.comments,
      shares: input.shares,
      saves: input.saves,
      clicks: input.clicks,
      purchases: input.purchases,
      revenue: input.revenue,
      spend: input.spend,

      campaignId: input.campaignId,
      creativeIntentId: input.creativeIntentId,
      creativePlanId: input.creativePlanId,
      digitalHumanId: input.digitalHumanId,
      productId: input.productId,
      
      metadata: input.metadata || {},
      createdAt: now,
      updatedAt: now,
    };

    // 2. Validate input aggregate numbers using Zod schema to enforce correctness (finite, non-negative, currency format, etc.)
    const parsed = performanceSnapshotSchema.parse(rawSnapshot);

    // 3. Normalize and derive missing rate metrics (CTR, CVR, ROAS, engagement rate, etc.)
    const { normalized } = normalizeAndDeriveMetrics(parsed);

    // 4. Set final status as VALIDATED (or metricsNormalizer will already set it as NORMALIZED)
    normalized.status = SnapshotStatus.VALIDATED;
    normalized.updatedAt = new Date().toISOString();

    return normalized;
  }
}
