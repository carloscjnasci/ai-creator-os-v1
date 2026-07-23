import { z } from 'zod';
import { 
  ExperimentType, 
  ExperimentStatus, 
  MetricType, 
  AnalysisResultStatus, 
  RecommendationStatus 
} from './types';
import { MetricWindow } from '../analytics-feedback/types';

// Helper for finite non-negative numbers
const nonNegativeFinite = z.number()
  .refine(val => Number.isFinite(val), { message: 'Must be a finite number' })
  .refine(val => val >= 0, { message: 'Must be non-negative' });

// Helper for positive finite numbers
const positiveFinite = z.number()
  .refine(val => Number.isFinite(val), { message: 'Must be a finite number' })
  .refine(val => val > 0, { message: 'Must be positive' });

// Helper for rates / percentages: 0.0 to 1.0 inclusive
const rateRange = z.number()
  .refine(val => Number.isFinite(val), { message: 'Must be a finite number' })
  .refine(val => val >= 0 && val <= 1, { message: 'Must be between 0.0 and 1.0' });

// Identifier validation
const idSchema = z.string()
  .min(1, { message: 'Identifier cannot be empty' })
  .regex(/^[a-zA-Z0-9_\-]+$/, { message: 'Malformed identifier format' });

// Timestamp validation (either ISO date or valid datetime)
const isoDatetime = z.string().datetime({ message: 'Must be a valid ISO datetime' });

export const experimentSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  name: z.string().min(1, { message: 'Name is required' }),
  description: z.string().default(''),
  hypothesis: z.string().min(1, { message: 'Hypothesis is required' }),
  objective: z.string().min(1, { message: 'Objective is required' }),
  experimentType: z.nativeEnum(ExperimentType),
  status: z.nativeEnum(ExperimentStatus),
  primaryMetric: z.string().min(1, { message: 'Primary metric is required' }),
  secondaryMetrics: z.array(z.string()).default([]),
  guardrailMetrics: z.array(z.string()).default([]),
  minimumSampleSize: z.number().int().positive({ message: 'Minimum sample size must be positive' }),
  minimumRuntimeHours: z.number().positive({ message: 'Minimum runtime hours must be positive' }),
  maximumRuntimeHours: z.number().positive({ message: 'Maximum runtime hours must be positive' }),
  confidenceLevel: rateRange.refine(val => val > 0, { message: 'Confidence level must be positive' }),
  minimumDetectableEffect: rateRange,
  allocationStrategy: z.string().min(1).default('even'),
  startAt: isoDatetime.optional(),
  endAt: isoDatetime.optional(),
  stoppedAt: isoDatetime.optional(),
  completedAt: isoDatetime.optional(),
  campaignId: idSchema.optional(),
  creativeIntentId: idSchema.optional(),
  creativePlanId: idSchema.optional(),
  platform: z.string().optional(),
  targetAudienceDescription: z.string().optional(),
  tags: z.array(z.string()).default([]),
  owner: z.string().min(1),
  createdAt: isoDatetime,
  updatedAt: isoDatetime,
  archivedAt: isoDatetime.optional(),
  failureCode: z.string().optional(),
  failureMessage: z.string().optional(),
}).refine(data => {
  if (data.startAt && data.endAt) {
    const start = new Date(data.startAt).getTime();
    const end = new Date(data.endAt).getTime();
    return end >= start;
  }
  return true;
}, {
  message: 'End date cannot be before start date',
  path: ['endAt']
}).refine(data => {
  return data.maximumRuntimeHours >= data.minimumRuntimeHours;
}, {
  message: 'Maximum runtime hours cannot be less than minimum runtime hours',
  path: ['maximumRuntimeHours']
});

export const experimentVariantSchema = z.object({
  id: idSchema,
  experimentId: idSchema,
  name: z.string().min(1, { message: 'Variant name is required' }),
  description: z.string().default(''),
  variantKey: z.string().min(1, { message: 'Variant key is required' }).regex(/^[a-zA-Z0-9_\-]+$/, { message: 'Invalid variant key format' }),
  isControl: z.boolean(),
  allocationWeight: positiveFinite,
  promptHistoryId: idSchema.optional(),
  campaignId: idSchema.optional(),
  publicationDraftId: idSchema.optional(),
  executionId: idSchema.optional(),
  executionTaskId: idSchema.optional(),
  providerJobId: idSchema.optional(),
  cloudAssetId: idSchema.optional(),
  creativeLibraryAssetId: idSchema.optional(),
  digitalHumanId: idSchema.optional(),
  productId: idSchema.optional(),
  wardrobeItemId: idSchema.optional(),
  sceneId: idSchema.optional(),
  poseId: idSchema.optional(),
  hook: z.string().optional(),
  CTA: z.string().optional(),
  title: z.string().optional(),
  caption: z.string().optional(),
  scheduledAt: isoDatetime.optional(),
  metadata: z.record(z.any()).optional(),
  createdAt: isoDatetime,
  updatedAt: isoDatetime,
});

export const experimentObservationSchema = z.object({
  id: idSchema,
  experimentId: idSchema,
  variantId: idSchema,
  performanceSnapshotId: idSchema.optional(),
  metricName: z.string().min(1),
  metricType: z.nativeEnum(MetricType),
  value: z.number().refine(val => Number.isFinite(val), { message: 'Must be finite' }),
  numerator: nonNegativeFinite.optional(),
  denominator: positiveFinite.optional(),
  sampleSize: z.number().int().nonnegative({ message: 'Sample size cannot be negative' }),
  capturedAt: isoDatetime,
  metricWindow: z.union([z.nativeEnum(MetricWindow), z.string()]),
  source: z.string().min(1),
  isEstimated: z.boolean().default(false),
  confidence: rateRange.optional(),
  metadata: z.record(z.any()).optional(),
}).superRefine((data, ctx) => {
  // COUNT rules
  if (data.metricType === MetricType.COUNT) {
    if (data.value < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'COUNT value must be non-negative',
        path: ['value'],
      });
    }
  }

  // RATE rules
  if (data.metricType === MetricType.RATE) {
    if (data.value < 0 || data.value > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'RATE value must be between 0.0 and 1.0',
        path: ['value'],
      });
    }
    if (data.numerator !== undefined && data.numerator < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'RATE numerator must be non-negative',
        path: ['numerator'],
      });
    }
    if (data.denominator !== undefined && data.denominator <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'RATE denominator must be greater than zero',
        path: ['denominator'],
      });
    }
    if (data.numerator !== undefined && data.denominator !== undefined && data.numerator > data.denominator) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'RATE numerator must not exceed denominator',
        path: ['numerator'],
      });
    }
  }

  // DURATION rules
  if (data.metricType === MetricType.DURATION) {
    if (data.value < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'DURATION value must be non-negative',
        path: ['value'],
      });
    }
  }

  // CURRENCY rules
  if (data.metricType === MetricType.CURRENCY) {
    if (data.value < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CURRENCY value must be non-negative',
        path: ['value'],
      });
    }
  }

  // SCORE rules: valid range 0 to 100 inclusive
  if (data.metricType === MetricType.SCORE) {
    if (data.value < 0 || data.value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'SCORE value must be between 0 and 100',
        path: ['value'],
      });
    }
  }

  // Denominator check
  if (data.denominator !== undefined && data.denominator <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Denominator must be positive',
      path: ['denominator'],
    });
  }
});

export const experimentAnalysisResultSchema = z.object({
  experimentId: idSchema,
  primaryMetric: z.string().min(1),
  controlVariantId: idSchema,
  evaluatedVariantIds: z.array(idSchema),
  sampleSizes: z.record(idSchema, z.number().int().nonnegative()),
  observedValues: z.record(idSchema, z.number()),
  absoluteLift: z.record(idSchema, z.number()),
  relativeLift: z.record(idSchema, z.number()),
  standardError: z.record(idSchema, z.number().nonnegative()),
  confidenceInterval: z.record(idSchema, z.tuple([z.number(), z.number()])),
  confidenceLevel: rateRange,
  pValue: z.record(idSchema, rateRange).optional(),
  effectSize: z.record(idSchema, z.number()).optional(),
  minimumDetectableEffect: rateRange,
  statisticalSignificance: z.record(idSchema, z.boolean()),
  practicalSignificance: z.record(idSchema, z.boolean()),
  winnerVariantId: idSchema.optional(),
  resultStatus: z.nativeEnum(AnalysisResultStatus),
  warnings: z.array(z.string()).default([]),
  limitations: z.array(z.string()).default([]),
  analyzedAt: isoDatetime,
});

export const experimentRecommendationSchema = z.object({
  id: idSchema,
  experimentId: idSchema,
  recommendationType: z.string().min(1),
  text: z.string().min(1),
  evidence: z.array(z.string()).default([]),
  confidence: rateRange,
  risk: z.string().default(''),
  expectedEffect: z.string().default(''),
  userDecisionRequired: z.boolean().default(true),
  targetEntities: z.record(z.string(), idSchema),
  status: z.nativeEnum(RecommendationStatus),
  createdAt: isoDatetime,
  updatedAt: isoDatetime,
});

export const experimentDecisionSchema = z.object({
  id: idSchema,
  experimentId: idSchema,
  analysisId: idSchema.optional(),
  recommendationId: idSchema,
  decision: z.enum([
    'accept_winner',
    'reject_winner',
    'continue_experiment',
    'stop_experiment',
    'create_follow_up',
    'archive_without_action'
  ]),
  rationale: z.string().default(''),
  selectedVariantId: idSchema.optional(),
  appliedEntityType: z.string().optional(),
  appliedEntityId: idSchema.optional(),
  createdBy: z.string(),
  createdAt: isoDatetime,
  undoneAt: isoDatetime.optional(),
  metadata: z.record(z.any()).optional(),
});
