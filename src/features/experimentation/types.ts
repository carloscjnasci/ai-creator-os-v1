import { MetricWindow } from '../analytics-feedback/types';

export enum ExperimentType {
  AB_TEST = 'ab_test',
  MULTIVARIATE = 'multivariate',
  SEQUENTIAL = 'sequential',
  HOLDOUT = 'holdout',
  CREATIVE_COMPARISON = 'creative_comparison',
  PROMPT_COMPARISON = 'prompt_comparison',
  PUBLICATION_TIME_TEST = 'publication_time_test',
}

export enum ExperimentStatus {
  DRAFT = 'draft',
  READY = 'ready',
  RUNNING = 'running',
  PAUSED = 'paused',
  EVALUATING = 'evaluating',
  COMPLETED = 'completed',
  INCONCLUSIVE = 'inconclusive',
  STOPPED = 'stopped',
  FAILED = 'failed',
  ARCHIVED = 'archived',
}

export enum MetricType {
  COUNT = 'count',
  RATE = 'rate',
  DURATION = 'duration',
  CURRENCY = 'currency',
  SCORE = 'score',
}

export enum AnalysisResultStatus {
  WINNER = 'winner',
  NO_DIFFERENCE = 'no_difference',
  INCONCLUSIVE = 'inconclusive',
  INSUFFICIENT_SAMPLE = 'insufficient_sample',
  GUARDRAIL_VIOLATION = 'guardrail_violation',
  INVALID_DATA = 'invalid_data',
  DESCRIPTIVE_ONLY = 'descriptive_only',
}

export enum RecommendationStatus {
  PROPOSED = 'proposed',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  APPLIED = 'applied',
  ARCHIVED = 'archived',
}

export interface Experiment {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  hypothesis: string;
  objective: string;
  experimentType: ExperimentType;
  status: ExperimentStatus;
  primaryMetric: string;
  secondaryMetrics: string[];
  guardrailMetrics: string[];
  minimumSampleSize: number;
  minimumRuntimeHours: number;
  maximumRuntimeHours: number;
  confidenceLevel: number; // e.g. 0.95
  minimumDetectableEffect: number; // e.g. 0.05
  allocationStrategy: string; // e.g. 'even' or 'custom'
  startAt?: string;
  endAt?: string;
  stoppedAt?: string;
  completedAt?: string;
  campaignId?: string;
  creativeIntentId?: string;
  creativePlanId?: string;
  platform?: string;
  targetAudienceDescription?: string;
  tags: string[];
  owner: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  failureCode?: string;
  failureMessage?: string;
}

export interface ExperimentVariant {
  id: string;
  experimentId: string;
  name: string;
  description: string;
  variantKey: string; // Unique within experiment
  isControl: boolean;
  allocationWeight: number; // positive weight, e.g., 50
  promptHistoryId?: string;
  campaignId?: string;
  publicationDraftId?: string;
  executionId?: string;
  executionTaskId?: string;
  providerJobId?: string;
  cloudAssetId?: string;
  creativeLibraryAssetId?: string;
  digitalHumanId?: string;
  productId?: string;
  wardrobeItemId?: string;
  sceneId?: string;
  poseId?: string;
  hook?: string;
  CTA?: string;
  title?: string;
  caption?: string;
  scheduledAt?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ExperimentObservation {
  id: string;
  experimentId: string;
  variantId: string;
  performanceSnapshotId?: string;
  metricName: string;
  metricType: MetricType;
  value: number;
  numerator?: number;
  denominator?: number;
  sampleSize: number;
  capturedAt: string;
  metricWindow: MetricWindow | string;
  source: string;
  isEstimated: boolean;
  confidence?: number;
  metadata?: Record<string, any>;
}

export interface ExperimentAnalysisResult {
  experimentId: string;
  primaryMetric: string;
  controlVariantId: string;
  evaluatedVariantIds: string[];
  sampleSizes: Record<string, number>; // variantId -> sampleSize
  observedValues: Record<string, number>; // variantId -> mean/rate value
  absoluteLift: Record<string, number>; // variantId -> lift value
  relativeLift: Record<string, number>; // variantId -> relative % lift
  standardError: Record<string, number>;
  confidenceInterval: Record<string, [number, number]>; // variantId -> [lower, upper]
  confidenceLevel: number;
  pValue?: Record<string, number>; // variantId -> p-value
  effectSize?: Record<string, number>;
  minimumDetectableEffect: number;
  statisticalSignificance: Record<string, boolean>; // variantId -> isSignificant
  practicalSignificance: Record<string, boolean>; // variantId -> isPracticallySignificant
  winnerVariantId?: string;
  resultStatus: AnalysisResultStatus;
  warnings: string[];
  limitations: string[];
  analyzedAt: string;

  // UI / Custom Properties
  id?: string;
  evaluatedAt?: string;
  confidenceScore?: number;
  pVal?: number;
  lift?: number;
  observationsCount?: number;
  sampleSize?: number;
}

export interface ExperimentRecommendation {
  id: string;
  experimentId: string;
  recommendationType: string;
  text: string;
  evidence: string[];
  confidence: number;
  risk: string;
  expectedEffect: string;
  userDecisionRequired: boolean;
  targetEntities: Record<string, string>;
  status: RecommendationStatus;
  createdAt: string;
  updatedAt: string;

  // UI / Custom Properties
  analysisId?: string;
  recommendationText?: string;
  suggestedAction?: string;
}

export interface GuardrailResult {
  violated: boolean;
  violatedGuardrails: string[];
  supportingEvidence: Record<string, string>;
  severity: 'low' | 'medium' | 'high';
  resultImpact: string;
}

export type DecisionAction =
  | 'accept_winner'
  | 'reject_winner'
  | 'continue_experiment'
  | 'stop_experiment'
  | 'create_follow_up'
  | 'archive_without_action';

export interface ExperimentDecision {
  id: string;
  experimentId: string;
  analysisId?: string;
  recommendationId: string;
  decision: DecisionAction;
  rationale: string;
  selectedVariantId?: string;
  appliedEntityType?: string;
  appliedEntityId?: string;
  createdBy: string;
  createdAt: string;
  undoneAt?: string;
  metadata?: Record<string, any>;
}
