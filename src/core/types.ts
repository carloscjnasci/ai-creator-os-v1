export const CREATIVE_PLATFORMS = [
  'tiktok',
  'tiktok-shop',
  'youtube',
  'instagram',
  'pinterest',
  'google',
  'generic',
] as const;

export type CreativePlatform = (typeof CREATIVE_PLATFORMS)[number];

export const CREATIVE_OBJECTIVES = [
  'sales',
  'virality',
  'awareness',
  'engagement',
  'ctr',
  'launch',
  'education',
] as const;

export type CreativeObjective = (typeof CREATIVE_OBJECTIVES)[number];

export interface CreativeIntent {
  id: string;
  goal: string;
  targetAudience: string;
  platform: CreativePlatform;
  objective: CreativeObjective;
  productId?: string;
  digitalHumanId?: string;
  createdAt: string;
}

export interface ViralScoreBreakdown {
  hook: number;
  cta: number;
  storytelling: number;
  emotion: number;
  clothing: number;
  trend: number;
  productFit: number;
  clarity: number;
}

export interface ViralScoreResult {
  overall: number;
  breakdown: ViralScoreBreakdown;
  strengths: string[];
  risks: string[];
}

export type ExecutionStepStatus = 'ready' | 'blocked' | 'completed';

export interface ExecutionPlanStep {
  id: string;
  order: number;
  label: string;
  domain:
    | 'strategy'
    | 'product'
    | 'digital-human'
    | 'wardrobe'
    | 'scene'
    | 'prompt'
    | 'image'
    | 'video'
    | 'publishing'
    | 'analytics';
  status: ExecutionStepStatus;
  description: string;
  provider?: string;
}

export interface CreativeDeliverables {
  hook: string;
  script: string[];
  imagePrompt: string;
  videoPrompt: string;
  flowPrompt: string;
  veoPrompt: string;
  thumbnailConcept: string;
  title: string;
  caption: string;
  hashtags: string[];
}

export interface CreativePlan {
  id: string;
  intent: CreativeIntent;
  campaignName: string;
  strategy: string;
  selectedCharacterId?: string;
  selectedProductId?: string;
  selectedWardrobeItemId?: string;
  selectedSceneId?: string;
  selectedPoseId?: string;
  deliverables: CreativeDeliverables;
  executionPlan: ExecutionPlanStep[];
  viralScore: ViralScoreResult;
  createdAt: string;
}

export interface WorkspaceEntitySummary {
  id: string;
  name: string;
  description: string;
}

export interface CreativeWorkspaceSnapshot {
  characters: WorkspaceEntitySummary[];
  products: WorkspaceEntitySummary[];
  wardrobe: WorkspaceEntitySummary[];
  scenes: WorkspaceEntitySummary[];
  poses: WorkspaceEntitySummary[];
}

export interface PromptOptimizationIssue {
  type: 'length' | 'redundancy' | 'conflict' | 'ambiguity' | 'structure';
  severity: 'low' | 'medium' | 'high';
  message: string;
}

export interface PromptOptimizationResult {
  originalLength: number;
  optimizedLength: number;
  issues: PromptOptimizationIssue[];
  optimizedPrompt: string;
  qualityScore: number;
}

export interface ViralContentAnalysis {
  platform: CreativePlatform;
  sourceUrl: string;
  hook: string;
  storytelling: string;
  cta: string;
  camera: string;
  lighting: string;
  emotion: string;
  caption: string;
  hashtags: string[];
  audio: string;
  scene: string;
  clothing: string;
  expression: string;
  pose: string;
  rhythm: string;
  adaptedPrompt: string;
  viralScore: ViralScoreResult;
}
