import { z } from 'zod';
import {
  CreativeRecipeCategory,
  RecipeSourceType,
  CreativeRecipeStatus,
  RecipeVersionStatus,
  RecipeParameterType,
  RecipeEvidenceSourceType,
  RecipeRecommendationType,
  RecipeRecommendationStatus,
  RecipeApplicationStatus,
} from './types';

// Helper for finite non-negative numbers
const nonNegativeFinite = z.number()
  .refine(val => Number.isFinite(val), { message: 'Must be a finite number' })
  .refine(val => val >= 0, { message: 'Must be non-negative' });

// Helper for positive finite numbers
const positiveFinite = z.number()
  .refine(val => Number.isFinite(val), { message: 'Must be a finite number' })
  .refine(val => val > 0, { message: 'Must be positive' });

// Helper for score ranges: 0 to 100
const scoreRange = z.number()
  .refine(val => Number.isFinite(val), { message: 'Must be a finite number' })
  .refine(val => val >= 0 && val <= 100, { message: 'Must be between 0 and 100' });

// Identifier validation
const idSchema = z.string()
  .min(1, { message: 'Identifier cannot be empty' })
  .regex(/^[a-zA-Z0-9_\-]+$/, { message: 'Malformed identifier format' });

// Timestamp validation (ISO datetime)
const isoDatetime = z.string().datetime({ message: 'Must be a valid ISO datetime' });

export const creativeRecipeSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  name: z.string().min(1, { message: 'Name is required' }),
  description: z.string().default(''),
  category: z.nativeEnum(CreativeRecipeCategory),
  status: z.nativeEnum(CreativeRecipeStatus),
  currentVersionId: z.string().default(''),
  sourceType: z.nativeEnum(RecipeSourceType),
  sourceEntityIds: z.array(z.string()).default([]),
  objective: z.string().default(''),
  targetPlatforms: z.array(z.string()).default([]),
  targetAudienceDescription: z.string().default(''),
  productCategories: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  requiredCapabilities: z.array(z.string()).default([]),
  brandRuleIds: z.array(z.string()).default([]),
  evidenceSummary: z.object({
    evidenceCount: z.number().nonnegative().default(0),
    averageScore: z.number().min(0).max(100).default(0),
    liftSummary: z.string().default(''),
  }).default({}),
  confidence: scoreRange.default(0),
  usageCount: z.number().int().nonnegative().default(0),
  successfulApplicationCount: z.number().int().nonnegative().default(0),
  averageObservedScore: z.number().min(0).max(100).default(0),
  createdBy: z.string().min(1),
  createdAt: isoDatetime,
  updatedAt: isoDatetime,
  activatedAt: isoDatetime.optional(),
  deprecatedAt: isoDatetime.optional(),
  archivedAt: isoDatetime.optional(),
  failureCode: z.string().optional(),
  failureMessage: z.string().optional(),
});

export const recipeParameterSchema = z.object({
  id: idSchema,
  key: z.string().min(1).regex(/^[a-zA-Z][a-zA-Z0-9_\.]*$/, { message: 'Invalid parameter key format' }),
  label: z.string().min(1),
  description: z.string().default(''),
  parameterType: z.nativeEnum(RecipeParameterType),
  required: z.boolean().default(true),
  defaultValue: z.any().optional(),
  allowedValues: z.array(z.any()).optional(),
  minimum: z.number().optional(),
  maximum: z.number().optional(),
  pattern: z.string().optional(),
  sourceBinding: z.string().optional(),
  visibility: z.enum(['visible', 'hidden', 'advanced']).default('visible'),
  order: z.number().int().default(0),
  validationMessage: z.string().optional(),
});

export const recipeStageSchema = z.object({
  id: idSchema,
  type: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  template: z.string().default(''),
  parameterBindings: z.record(z.string()).default({}),
  dependencies: z.array(z.string()).default([]),
  outputType: z.string().default('text'),
  providerPreference: z.string().optional(),
  modelPreference: z.string().optional(),
  optional: z.boolean().default(false),
  order: z.number().int().default(0),
  validationRules: z.record(z.any()).default({}),
  metadata: z.record(z.any()).optional(),
});

export const recipeStructureSchema = z.object({
  stages: z.array(recipeStageSchema).default([]),
});

export const creativeRecipeVersionSchema = z.object({
  id: idSchema,
  recipeId: idSchema,
  versionNumber: positiveFinite,
  versionLabel: z.string().min(1),
  changeSummary: z.string().default(''),
  status: z.nativeEnum(RecipeVersionStatus),
  structure: recipeStructureSchema,
  parameters: z.array(recipeParameterSchema).default([]),
  constraints: z.record(z.any()).default({}),
  outputContract: z.record(z.any()).default({}),
  validationRules: z.record(z.any()).default({}),
  compatiblePlatforms: z.array(z.string()).default([]),
  compatibleModels: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
  parentVersionId: idSchema.optional(),
  derivedFromExperimentId: idSchema.optional(),
  derivedFromRecommendationId: idSchema.optional(),
  derivedFromPromptHistoryId: idSchema.optional(),
  createdBy: z.string().min(1),
  createdAt: isoDatetime,
  activatedAt: isoDatetime.optional(),
  supersededAt: isoDatetime.optional(),
});

export const recipeEvidenceSchema = z.object({
  id: idSchema,
  recipeId: idSchema,
  recipeVersionId: idSchema,
  sourceType: z.nativeEnum(RecipeEvidenceSourceType),
  sourceEntityId: z.string().min(1),
  experimentId: idSchema.optional(),
  analysisId: idSchema.optional(),
  performanceSnapshotId: idSchema.optional(),
  campaignId: idSchema.optional(),
  promptHistoryId: idSchema.optional(),
  creativeLibraryAssetId: idSchema.optional(),
  metricName: z.string().min(1),
  observedValue: z.number(),
  baselineValue: z.number(),
  absoluteLift: z.number(),
  relativeLift: z.number(),
  sampleSize: positiveFinite,
  confidence: z.number().min(0).max(1),
  limitations: z.array(z.string()).default([]),
  capturedAt: isoDatetime,
});

export const recipeScorecardSchema = z.object({
  id: idSchema,
  recipeId: idSchema,
  recipeVersionId: idSchema,
  evidenceStrength: scoreRange,
  reproducibility: scoreRange,
  platformFit: scoreRange,
  brandFit: scoreRange,
  parameterCompleteness: scoreRange,
  historicalPerformance: scoreRange,
  experimentSupport: scoreRange,
  usageReliability: scoreRange,
  overallScore: scoreRange,
  confidence: scoreRange,
  limitations: z.array(z.string()).default([]),
  generatedAt: isoDatetime,
});

export const recipeRecommendationSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  recipeId: idSchema.optional(),
  recipeVersionId: idSchema.optional(),
  type: z.nativeEnum(RecipeRecommendationType),
  title: z.string().min(1),
  description: z.string().default(''),
  evidence: z.array(z.string()).default([]),
  confidence: scoreRange,
  expectedEffect: z.string().default(''),
  risk: z.enum(['low', 'medium', 'high']).default('low'),
  targetRecipeId: idSchema.optional(),
  targetVersionId: idSchema.optional(),
  userDecision: z.enum(['none', 'accept', 'reject', 'apply']).default('none'),
  status: z.nativeEnum(RecipeRecommendationStatus),
  createdAt: isoDatetime,
  updatedAt: isoDatetime,
});

export const recipeApplicationSchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  recipeId: idSchema,
  recipeVersionId: idSchema,
  status: z.nativeEnum(RecipeApplicationStatus),
  parameterValues: z.record(z.any()).default({}),
  normalizedParameters: z.record(z.any()).default({}),
  fingerprint: z.string().min(1),
  targetEntityType: z.string().optional(),
  targetEntityId: z.string().optional(),
  campaignId: z.string().optional(),
  creativeIntentId: z.string().optional(),
  creativePlanId: z.string().optional(),
  experimentId: z.string().optional(),
  createdEntities: z.array(z.string()).default([]),
  outputReferences: z.array(z.string()).default([]),
  validationResult: z.object({
    valid: z.boolean(),
    errors: z.array(z.string()),
    warnings: z.array(z.string()),
  }).optional(),
  createdBy: z.string().min(1),
  createdAt: isoDatetime,
  updatedAt: isoDatetime,
  startedAt: isoDatetime.optional(),
  completedAt: isoDatetime.optional(),
  failedAt: isoDatetime.optional(),
  failureCode: z.string().optional(),
  failureMessage: z.string().optional(),
  idempotencyKey: z.string().optional(),
  resolvedStages: z.array(z.object({
    stageId: idSchema,
    resolvedTemplate: z.string(),
    bindings: z.record(z.any()),
  })).default([]),
  unresolvedParameters: z.array(z.string()).default([]),
  errors: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
});
