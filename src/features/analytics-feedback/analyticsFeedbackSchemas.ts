import { z } from 'zod';
import { AnalyticsPlatform, AnalyticsSourceType, MetricWindow, SnapshotStatus, InsightCategory, InsightSeverity, InsightStatus, RecommendationType, RecommendationStatus } from './types';

// Helper to validate finite non-negative numbers
const nonNegativeFinite = z.number()
  .refine(val => Number.isFinite(val), { message: 'Must be a finite number' })
  .refine(val => val >= 0, { message: 'Must be non-negative' });

// Helper for rates / percentages: 0.0 to 1.0 inclusive
const rateRange = z.number()
  .refine(val => Number.isFinite(val), { message: 'Must be a finite number' })
  .refine(val => val >= 0 && val <= 1, { message: 'Must be between 0.0 and 1.0' });

// Currency format (3 uppercase letters, e.g. USD, EUR, BRL)
const currencySchema = z.string()
  .regex(/^[A-Z]{3}$/, { message: 'Must be a 3-letter uppercase currency code' });

// Identifier format
const idSchema = z.string()
  .min(1, { message: 'Identifier cannot be empty' })
  .regex(/^[a-zA-Z0-9_\-]+$/, { message: 'Malformed identifier format' });

export const performanceSnapshotSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  platform: z.nativeEnum(AnalyticsPlatform),
  sourceType: z.nativeEnum(AnalyticsSourceType),
  status: z.nativeEnum(SnapshotStatus),

  publicationDraftId: idSchema.optional(),
  publicationJobId: idSchema.optional(),
  externalPublicationId: z.string().min(1).optional(),
  externalChannelId: z.string().min(1).optional(),
  campaignId: idSchema.optional(),
  creativeIntentId: idSchema.optional(),
  creativePlanId: idSchema.optional(),
  executionId: idSchema.optional(),
  executionTaskId: idSchema.optional(),
  providerJobId: idSchema.optional(),
  cloudAssetId: idSchema.optional(),
  creativeLibraryAssetId: idSchema.optional(),
  promptHistoryId: idSchema.optional(),
  digitalHumanId: idSchema.optional(),
  productId: idSchema.optional(),
  wardrobeItemId: idSchema.optional(),
  sceneId: idSchema.optional(),

  metricWindow: z.nativeEnum(MetricWindow),
  periodStart: z.string().datetime({ message: 'Must be a valid ISO datetime' }),
  periodEnd: z.string().datetime({ message: 'Must be a valid ISO datetime' }),
  capturedAt: z.string().datetime({ message: 'Must be a valid ISO datetime' }),
  currency: currencySchema,

  // Core metrics
  impressions: nonNegativeFinite.optional(),
  reach: nonNegativeFinite.optional(),
  views: nonNegativeFinite.optional(),
  uniqueViewers: nonNegativeFinite.optional(),
  threeSecondViews: nonNegativeFinite.optional(),
  watchTimeSeconds: nonNegativeFinite.optional(),
  averageWatchTimeSeconds: nonNegativeFinite.optional(),
  completionRate: rateRange.optional(),

  // Engagement
  likes: nonNegativeFinite.optional(),
  comments: nonNegativeFinite.optional(),
  shares: nonNegativeFinite.optional(),
  saves: nonNegativeFinite.optional(),

  // Actions
  clicks: nonNegativeFinite.optional(),
  profileVisits: nonNegativeFinite.optional(),
  follows: nonNegativeFinite.optional(),
  addToCart: nonNegativeFinite.optional(),
  checkoutInitiated: nonNegativeFinite.optional(),
  purchases: nonNegativeFinite.optional(),
  revenue: nonNegativeFinite.optional(),
  spend: nonNegativeFinite.optional(),

  // Rates / Ratios
  ctr: rateRange.optional(),
  cvr: rateRange.optional(),
  cpm: nonNegativeFinite.optional(),
  cpc: nonNegativeFinite.optional(),
  roas: nonNegativeFinite.optional(), // ROAS can be > 1.0, but must be finite non-negative
  engagementRate: rateRange.optional(),
  viewVelocity: nonNegativeFinite.optional(),
  shareRate: rateRange.optional(),
  saveRate: rateRange.optional(),
  followConversion: rateRange.optional(),

  metadata: z.record(z.any()).optional(),
  errorMessage: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).refine(data => {
  const start = new Date(data.periodStart).getTime();
  const end = new Date(data.periodEnd).getTime();
  return end >= start;
}, {
  message: 'periodEnd must be greater than or equal to periodStart',
  path: ['periodEnd'],
});

export const scorecardDimensionSchema = z.object({
  dimension: z.string().min(1),
  value: z.number().min(0).max(100),
  explanation: z.string().min(1),
  supportingMetrics: z.array(z.string()),
  confidence: rateRange,
  limitations: z.array(z.string()),
});

export const performanceScorecardSchema = z.object({
  id: idSchema,
  snapshotId: idSchema,
  workspaceId: idSchema,
  overallScore: z.number().min(0).max(100),
  dimensions: z.array(scorecardDimensionSchema),
  predictedViralScore: z.number().min(0).max(100).optional(),
  observedPerformanceScore: z.number().min(0).max(100).optional(),
  predictionGap: z.number().min(0).max(100).optional(),
  overprediction: z.boolean().optional(),
  underprediction: z.boolean().optional(),
  createdAt: z.string().datetime(),
});

export const analyticsInsightSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  category: z.nativeEnum(InsightCategory),
  severity: z.nativeEnum(InsightSeverity),
  title: z.string().min(1),
  summary: z.string().min(1),
  evidence: z.object({
    metric: z.string().min(1),
    value: z.union([z.string(), z.number()]),
    baseline: z.union([z.string(), z.number()]).optional(),
    description: z.string().min(1),
  }),
  relatedSnapshotIds: z.array(idSchema),
  relatedEntityIds: z.record(idSchema),
  confidence: rateRange,
  status: z.nativeEnum(InsightStatus),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const analyticsRecommendationSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  recommendationType: z.nativeEnum(RecommendationType),
  evidence: z.array(z.string()),
  expectedEffect: z.string().min(1),
  confidence: rateRange,
  targetEntities: z.record(idSchema),
  proposedChange: z.string().min(1),
  risk: z.string().min(1),
  status: z.nativeEnum(RecommendationStatus),
  userDecision: z.object({
    action: z.enum(['accept', 'reject']),
    timestamp: z.string().datetime(),
    reason: z.string().optional(),
  }).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
