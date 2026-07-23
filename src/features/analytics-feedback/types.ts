export enum AnalyticsPlatform {
  TIKTOK = 'tiktok',
  TIKTOK_SHOP = 'tiktok_shop',
  YOUTUBE = 'youtube',
  YOUTUBE_SHORTS = 'youtube_shorts',
  INSTAGRAM = 'instagram',
  INSTAGRAM_REELS = 'instagram_reels',
  FACEBOOK = 'facebook',
  PINTEREST = 'pinterest',
  MANUAL = 'manual',
  OTHER = 'other',
}

export enum AnalyticsSourceType {
  MANUAL_ENTRY = 'manual_entry',
  MOCK_CONNECTOR = 'mock_connector',
  SECURE_CONNECTOR = 'secure_connector',
  PUBLISHING_RESULT = 'publishing_result',
  IMPORTED_DATASET = 'imported_dataset',
}

export enum MetricWindow {
  FIRST_HOUR = 'first_hour',
  FIRST_24_HOURS = 'first_24_hours',
  FIRST_7_DAYS = 'first_7_days',
  FIRST_30_DAYS = 'first_30_days',
  LIFETIME = 'lifetime',
  CUSTOM = 'custom',
}

export enum SnapshotStatus {
  DRAFT = 'draft',
  VALIDATED = 'validated',
  NORMALIZED = 'normalized',
  ATTRIBUTED = 'attributed',
  ANALYZED = 'analyzed',
  FAILED = 'failed',
  ARCHIVED = 'archived',
}

/**
 * PerformanceSnapshot Contract
 *
 * NOTE ON PERCENTAGES & RATES:
 * All rate and percentage metrics (ctr, cvr, completionRate, engagementRate, roas, viewVelocity, etc.)
 * are represented as numbers from 0.0 to 1.0 (e.g., 0.05 for 5% CTR).
 * ROAS is represented as a direct multiplier (e.g., 2.5 for 250% return).
 */
export interface PerformanceSnapshot {
  id: string;
  workspaceId: string;
  platform: AnalyticsPlatform;
  sourceType: AnalyticsSourceType;
  status: SnapshotStatus;
  
  // Lineage / Attribution IDs
  publicationDraftId?: string;
  publicationJobId?: string;
  externalPublicationId?: string;
  externalChannelId?: string;
  campaignId?: string;
  creativeIntentId?: string;
  creativePlanId?: string;
  executionId?: string;
  executionTaskId?: string;
  providerJobId?: string;
  cloudAssetId?: string;
  creativeLibraryAssetId?: string;
  promptHistoryId?: string;
  digitalHumanId?: string;
  productId?: string;
  wardrobeItemId?: string;
  sceneId?: string;

  // Window & Capture Timestamps
  metricWindow: MetricWindow;
  periodStart: string;
  periodEnd: string;
  capturedAt: string;
  currency: string;

  // Core Platform Metrics
  impressions?: number;
  reach?: number;
  views?: number;
  uniqueViewers?: number;
  threeSecondViews?: number;
  watchTimeSeconds?: number;
  averageWatchTimeSeconds?: number;
  completionRate?: number; // 0.0 to 1.0

  // Engagement Metrics
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;

  // Interaction / Conversion Metrics
  clicks?: number;
  profileVisits?: number;
  follows?: number;
  addToCart?: number;
  checkoutInitiated?: number;
  purchases?: number;
  revenue?: number;
  spend?: number;

  // Calculated Metrics (stored 0.0 to 1.0)
  ctr?: number;
  cvr?: number;
  cpm?: number;
  cpc?: number;
  roas?: number;
  engagementRate?: number;
  viewVelocity?: number;
  shareRate?: number;
  saveRate?: number;
  followConversion?: number;

  metadata?: Record<string, any>;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MetricFormula {
  id: string;
  name: string;
  requiredInputs: string[];
  isExact: boolean;
  confidence: number; // 0.0 to 1.0
}

export interface DerivedMetricValue {
  value: number;
  formulaId: string;
  isExact: boolean;
  confidence: number;
}

export interface AttributionResult {
  snapshotId: string;
  resolvedEntities: {
    publicationDraft?: boolean;
    publicationJob?: boolean;
    campaign?: boolean;
    creativeIntent?: boolean;
    creativePlan?: boolean;
    execution?: boolean;
    executionTask?: boolean;
    providerJob?: boolean;
    cloudAsset?: boolean;
    creativeLibraryAsset?: boolean;
    promptHistory?: boolean;
    digitalHuman?: boolean;
    product?: boolean;
    wardrobeItem?: boolean;
    scene?: boolean;
  };
  unresolvedEntities: string[];
  confidence: number; // 0.0 to 1.0
  warnings: string[];
  lineagePath: Record<string, string>;
}

export interface ScoreDimension {
  dimension: string;
  value: number; // 0 to 100
  explanation: string;
  supportingMetrics: string[];
  confidence: number; // 0.0 to 1.0
  limitations: string[];
}

export interface PerformanceScorecard {
  id: string;
  snapshotId: string;
  workspaceId: string;
  overallScore: number; // 0 to 100
  dimensions: ScoreDimension[];
  
  // Predicted vs Observed
  predictedViralScore?: number; // Pre-production score
  observedPerformanceScore?: number; // Calculated after performance
  predictionGap?: number; // Absolute difference
  overprediction?: boolean; // true if predicted > observed
  underprediction?: boolean; // true if predicted < observed

  createdAt: string;
}

export interface OutlierResult {
  comparisonGroup: string; // e.g. 'campaign_baseline', 'platform_baseline'
  baselineValue: number;
  observedValue: number;
  difference: number;
  relativeLift: number; // e.g. 1.5 for +150%
  confidence: number; // 0.0 to 1.0
  explanation: string;
  sampleSize: number;
  isPositiveOutlier: boolean;
  isNegativeOutlier: boolean;
}

export enum InsightCategory {
  HOOK = 'hook',
  RETENTION = 'retention',
  STORYTELLING = 'storytelling',
  CTA = 'CTA',
  EMOTION = 'emotion',
  PRODUCT_FIT = 'product fit',
  DIGITAL_HUMAN = 'Digital Human',
  WARDROBE = 'wardrobe',
  SCENE = 'scene',
  PROMPT_STRUCTURE = 'prompt structure',
  PLATFORM = 'platform',
  TIMING = 'timing',
  CONVERSION = 'conversion',
  PUBLISHING_CADENCE = 'publishing cadence',
  AUDIENCE_RESPONSE = 'audience response',
  ANOMALY = 'anomaly',
  OUTLIER = 'outlier',
}

export enum InsightSeverity {
  INFO = 'info',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum InsightStatus {
  NEW = 'new',
  REVIEWED = 'reviewed',
  ACCEPTED = 'accepted',
  DISMISSED = 'dismissed',
  ARCHIVED = 'archived',
}

export interface AnalyticsInsight {
  id: string;
  workspaceId: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  summary: string;
  evidence: {
    metric: string;
    value: string | number;
    baseline?: string | number;
    description: string;
  };
  relatedSnapshotIds: string[];
  relatedEntityIds: Record<string, string>; // entity type -> entity ID
  confidence: number; // 0.0 to 1.0
  status: InsightStatus;
  createdAt: string;
  updatedAt: string;
}

export enum RecommendationType {
  IMPROVE_HOOK = 'improve_hook',
  SHORTEN_INTRO = 'shorten_intro',
  STRENGTHEN_CTA = 'strengthen_cta',
  REUSE_PROMPT_STRUCTURE = 'reuse_prompt_structure',
  TEST_OTHER_DIGITAL_HUMAN = 'test_other_digital_human',
  PRESERVE_WARDROBE_COMBINATION = 'preserve_wardrobe_combination',
  TEST_NEW_SCENE = 'test_new_scene',
  ADJUST_PUBLISHING_TIME = 'adjust_publishing_time',
  ADAPT_FOR_PLATFORM = 'adapt_for_platform',
  CREATE_AB_VARIATION = 'create_ab_variation',
  STOP_REPEATING_WEAK_STRUCTURE = 'stop_repeating_weak_structure',
}

export enum RecommendationStatus {
  PROPOSED = 'proposed',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  APPLIED = 'applied',
  SUPERSEDED = 'superseded',
  ARCHIVED = 'archived',
}

export interface AnalyticsRecommendation {
  id: string;
  workspaceId: string;
  recommendationType: RecommendationType;
  evidence: string[];
  expectedEffect: string;
  confidence: number; // 0.0 to 1.0
  targetEntities: Record<string, string>; // entity type -> entity ID
  proposedChange: string;
  risk: string;
  status: RecommendationStatus;
  userDecision?: {
    action: 'accept' | 'reject';
    timestamp: string;
    reason?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackDecision {
  id: string;
  recommendationId: string;
  workspaceId: string;
  targetEntityType: string;
  targetEntityId: string;
  action: 'accept' | 'reject';
  appliedAt?: string;
  createdAt: string;
  user?: string;
  rationale?: string;
}

export interface CalibrationRecord {
  id: string;
  predictionId: string;
  predictedScore: number;
  observedScore: number;
  predictionGap: number;
  platform: string;
  campaign?: string;
  sampleSize: number;
  confidence: number;
  createdAt: string;
}

export interface LearningPattern {
  pattern: string;
  type: string; // 'prompt' | 'digital-human' | 'wardrobe' | 'scene' | 'product' | 'platform'
  score: number;
  confidence: number;
}

export interface LearningContext {
  acceptedRecommendationIds: string[];
  rejectedRecommendationIds: string[];
  highPerformingPatterns: LearningPattern[];
  weakPatterns: LearningPattern[];
  platformPreferences: Record<string, number>;
  productPerformancePatterns: Record<string, number>;
  digitalHumanPerformancePatterns: Record<string, number>;
  promptPerformancePatterns: Record<string, number>;
  disabledSignals: string[];
  updatedAt: string;
}

