export enum CreativeRecipeCategory {
  HOOK = 'hook',
  SCRIPT = 'script',
  PROMPT = 'prompt',
  VISUAL_STYLE = 'visual_style',
  PRODUCT_DEMO = 'product_demo',
  CAMPAIGN = 'campaign',
  PUBLICATION = 'publication',
  EXPERIMENTATION = 'experimentation',
  FULL_WORKFLOW = 'full_workflow',
  OTHER = 'other',
}

export enum RecipeSourceType {
  MANUAL = 'manual',
  WINNING_EXPERIMENT = 'winning_experiment',
  ANALYTICS_RECOMMENDATION = 'analytics_recommendation',
  PROMPT_HISTORY = 'prompt_history',
  CAMPAIGN = 'campaign',
  IMPORTED_TEMPLATE = 'imported_template',
  SYSTEM_TEMPLATE = 'system_template',
}

export enum CreativeRecipeStatus {
  DRAFT = 'draft',
  VALIDATING = 'validating',
  READY = 'ready',
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
  ARCHIVED = 'archived',
  FAILED = 'failed',
}

export enum RecipeVersionStatus {
  DRAFT = 'draft',
  READY = 'ready',
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
  SUPERSEDED = 'superseded',
  FAILED = 'failed',
}

export enum RecipeParameterType {
  TEXT = 'text',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  SELECT = 'select',
  MULTI_SELECT = 'multi_select',
  PLATFORM = 'platform',
  MODEL = 'model',
  PRODUCT = 'product',
  DIGITAL_HUMAN = 'digital_human',
  WARDROBE = 'wardrobe',
  SCENE = 'scene',
  POSE = 'pose',
  ASSET = 'asset',
  PROMPT_VERSION = 'prompt_version',
  CAMPAIGN = 'campaign',
  EXPERIMENT = 'experiment',
  DATE_TIME = 'date_time',
  DURATION = 'duration',
  ASPECT_RATIO = 'aspect_ratio',
}

export enum RecipeEvidenceSourceType {
  EXPERIMENT = 'experiment',
  ANALYSIS = 'analysis',
  PERFORMANCE = 'performance',
  MANUAL = 'manual',
  OTHER = 'other',
}

export enum RecipeRecommendationType {
  ACTIVATE = 'activate',
  COLLECT_EVIDENCE = 'collect_evidence',
  CREATE_VERSION = 'create_version',
  DEPRECATE_WEAK_VERSION = 'deprecate_weak_version',
  ADAPT_PLATFORM = 'adapt_platform',
  CONVERT_WINNER = 'convert_winner',
  ADD_MISSING_PARAMETER = 'add_missing_parameter',
  SIMPLIFY_STRUCTURE = 'simplify_structure',
  CREATE_FOLLOW_UP_EXPERIMENT = 'create_follow_up_experiment',
}

export enum RecipeRecommendationStatus {
  PROPOSED = 'proposed',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  APPLIED = 'applied',
  ARCHIVED = 'archived',
}

export enum RecipeApplicationStatus {
  DRAFT = 'draft',
  PREVIEWED = 'previewed',
  APPROVED = 'approved',
  APPLYING = 'applying',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface CreativeRecipe {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  category: CreativeRecipeCategory;
  status: CreativeRecipeStatus;
  currentVersionId: string;
  sourceType: RecipeSourceType;
  sourceEntityIds: string[];
  objective: string;
  targetPlatforms: string[];
  targetAudienceDescription: string;
  productCategories: string[];
  tags: string[];
  requiredCapabilities: string[];
  brandRuleIds: string[];
  evidenceSummary: {
    evidenceCount: number;
    averageScore: number;
    liftSummary: string;
  };
  confidence: number;
  usageCount: number;
  successfulApplicationCount: number;
  averageObservedScore: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
  deprecatedAt?: string;
  archivedAt?: string;
  failureCode?: string;
  failureMessage?: string;
}

export interface RecipeParameter {
  id: string;
  key: string;
  label: string;
  description: string;
  parameterType: RecipeParameterType;
  required: boolean;
  defaultValue?: any;
  allowedValues?: any[];
  minimum?: number;
  maximum?: number;
  pattern?: string;
  sourceBinding?: string;
  visibility: 'visible' | 'hidden' | 'advanced';
  order: number;
  validationMessage?: string;
}

export interface RecipeStage {
  id: string;
  type: string; // research, strategy, hook, script, prompt, image, video, publication, analytics, experiment
  title: string;
  description: string;
  template: string;
  parameterBindings: Record<string, string>;
  dependencies: string[];
  outputType: string;
  providerPreference?: string;
  modelPreference?: string;
  optional: boolean;
  order: number;
  validationRules: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface RecipeStructure {
  stages: RecipeStage[];
}

export interface CreativeRecipeVersion {
  id: string;
  recipeId: string;
  versionNumber: number;
  versionLabel: string;
  changeSummary: string;
  status: RecipeVersionStatus;
  structure: RecipeStructure;
  parameters: RecipeParameter[];
  constraints: Record<string, any>;
  outputContract: Record<string, any>;
  validationRules: Record<string, any>;
  compatiblePlatforms: string[];
  compatibleModels: string[];
  evidenceIds: string[];
  parentVersionId?: string;
  derivedFromExperimentId?: string;
  derivedFromRecommendationId?: string;
  derivedFromPromptHistoryId?: string;
  createdBy: string;
  createdAt: string;
  activatedAt?: string;
  supersededAt?: string;
}

export interface RecipeEvidence {
  id: string;
  recipeId: string;
  recipeVersionId: string;
  sourceType: RecipeEvidenceSourceType;
  sourceEntityId: string;
  experimentId?: string;
  analysisId?: string;
  performanceSnapshotId?: string;
  campaignId?: string;
  promptHistoryId?: string;
  creativeLibraryAssetId?: string;
  metricName: string;
  observedValue: number;
  baselineValue: number;
  absoluteLift: number;
  relativeLift: number;
  sampleSize: number;
  confidence: number;
  limitations: string[];
  capturedAt: string;
}

export interface RecipeScorecard {
  id: string; // usually same as recipeId
  recipeId: string;
  recipeVersionId: string;
  evidenceStrength: number; // 0-100
  reproducibility: number; // 0-100
  platformFit: number; // 0-100
  brandFit: number; // 0-100
  parameterCompleteness: number; // 0-100
  historicalPerformance: number; // 0-100
  experimentSupport: number; // 0-100
  usageReliability: number; // 0-100
  overallScore: number; // 0-100
  confidence: number; // 0-100
  limitations: string[];
  generatedAt: string;
}

export interface RecipeRecommendation {
  id: string;
  workspaceId: string;
  recipeId?: string;
  recipeVersionId?: string;
  type: RecipeRecommendationType;
  title: string;
  description: string;
  evidence: string[];
  confidence: number; // 0-100
  expectedEffect: string;
  risk: 'low' | 'medium' | 'high';
  targetRecipeId?: string;
  targetVersionId?: string;
  userDecision: 'none' | 'accept' | 'reject' | 'apply';
  status: RecipeRecommendationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeApplication {
  id: string;
  workspaceId: string;
  recipeId: string;
  recipeVersionId: string;
  status: RecipeApplicationStatus;
  parameterValues: Record<string, any>;
  normalizedParameters: Record<string, any>;
  fingerprint: string;
  targetEntityType?: string;
  targetEntityId?: string;
  campaignId?: string;
  creativeIntentId?: string;
  creativePlanId?: string;
  experimentId?: string;
  createdEntities?: string[];
  outputReferences?: string[];
  validationResult?: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  failedAt?: string;
  failureCode?: string;
  failureMessage?: string;
  idempotencyKey?: string;
  resolvedStages?: {
    stageId: string;
    resolvedTemplate: string;
    bindings: Record<string, any>;
  }[];
  unresolvedParameters?: string[];
  errors?: string[];
  warnings?: string[];
}

export interface RecipeApplicationPreview {
  fingerprint: string;
  resolvedStages: {
    stageId: string;
    resolvedTemplate: string;
    bindings: Record<string, any>;
  }[];
  unresolvedParameters: string[];
  validationErrors: string[];
  warnings: string[];
  lineage: {
    recipeId: string;
    recipeVersionId: string;
    parentVersionId?: string;
  };
}
