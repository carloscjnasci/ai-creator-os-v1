import { loadCampaignsFromStorage, CAMPAIGN_STORAGE_KEY, parseStoredCampaigns } from '../campaigns/lib/campaignStorage';
import { loadCharactersFromStorage, CHARACTER_STORAGE_KEY, parseStoredCharacters } from '../characters/lib/characterStorage';
import { loadProductsFromStorage, PRODUCT_STORAGE_KEY, parseStoredProducts } from '../products/lib/productStorage';
import { loadWardrobeItemsFromStorage, WARDROBE_STORAGE_KEY } from '../wardrobe/wardrobeStorage';
import { loadScenesFromStorage, SCENE_STORAGE_KEY, parseStoredScenes } from '../scenes/sceneStorage';
import { loadPosesFromStorage, POSE_STORAGE_KEY, parseStoredPoses } from '../poses/poseStorage';
import { loadPromptHistoryFromStorage, PROMPT_HISTORY_STORAGE_KEY, parseStoredPromptHistory } from '../prompt-engine/promptHistoryStorage';
import { loadSettingsFromStorage, SETTINGS_STORAGE_KEY, notifySettingsChanged } from './settingsStorage';
import { loadResearchSignals, parseStoredResearchSignals, RESEARCH_SIGNAL_STORAGE_KEY } from '../research-hub/lib/researchStorage';
import { loadViralAnalyses, parseStoredViralAnalyses, VIRAL_ANALYSIS_STORAGE_KEY } from '../viral-analyzer/lib/viralAnalysisStorage';
import { loadDigitalHumanProfiles, parseStoredDigitalHumanProfiles, DIGITAL_HUMAN_PROFILE_STORAGE_KEY } from '../digital-humans/lib/digitalHumanStorage';
import { loadCampaignWorkflows, parseStoredCampaignWorkflows, CAMPAIGN_WORKFLOW_STORAGE_KEY } from '../campaign-builder/lib/campaignWorkflowStorage';
import { loadPromptExperiments, parseStoredPromptExperiments, PROMPT_EXPERIMENT_STORAGE_KEY } from '../prompt-intelligence/lib/promptExperimentStorage';
import { loadCreativeAssets, parseStoredCreativeAssets, CREATIVE_ASSET_STORAGE_KEY } from '../creative-library/lib/creativeAssetStorage';
import { loadCreativePlans, parseStoredCreativePlans, CREATIVE_PLAN_STORAGE_KEY } from '../ai-director/lib/creativePlanStorage';
import { loadExecutionRuns, parseStoredExecutionRuns, EXECUTION_RUN_STORAGE_KEY } from '../execution-center/lib/executionRunStorage';
import { loadProviderJobs, parseStoredProviderJobs, PROVIDER_JOB_STORAGE_KEY } from '../provider-gateway/lib/providerJobStorage';
import { loadProviderConnections, parseStoredProviderConnections, PROVIDER_CONNECTION_STORAGE_KEY } from '../provider-gateway/lib/providerConnectionStorage';
import { loadAssetRecords, parseAssetRecords, ASSET_STORAGE_KEY } from '@/features/asset-pipeline/assetPipelineStorage';
import {
  loadPublicationDrafts,
  loadPublishingJobs,
  loadPublishingConnections,
  parseStoredPublicationDrafts,
  parseStoredPublishingJobs,
  parseStoredPublishingConnections,
  PUBLICATION_DRAFT_STORAGE_KEY,
  PUBLISHING_JOB_STORAGE_KEY,
  PUBLISHING_CONNECTION_STORAGE_KEY,
} from '@/features/publishing-hub/lib/publishingStorage';

import type { Campaign } from '../campaigns/types';
import type { Character } from '../characters/types';
import type { Product } from '../products/types';
import type { WardrobeItem } from '../wardrobe/types';
import type { Scene } from '../scenes/types';
import type { Pose } from '../poses/types';
import type { PromptHistoryEntry } from '../prompt-engine/types';
import type { SettingsPreferences } from './types';
import { sanitizeLocale } from '../i18n/localeConfig';
import type { TrendSignal } from '../research-hub/types';
import type { SavedViralAnalysis } from '../viral-analyzer/types';
import type { DigitalHumanProfile } from '../digital-humans/types';
import type { CampaignWorkflow } from '../campaign-builder/types';
import type { PromptExperiment } from '../prompt-intelligence/types';
import type { CreativeAsset } from '../creative-library/types';
import type { CreativePlan } from '@/core/types';
import type { ExecutionRun } from '@/core/execution-engine';
import type { ProviderConnectionPreference, ProviderJob } from '@/core/provider-gateway';
import type { CloudAssetRecord } from '../asset-pipeline/types';
import type { PublicationDraft, PublishingConnectionPreference, PublishingJob } from '../publishing-hub/types';

import { PROMPT_OUTPUT_TYPES, PROMPT_PLATFORMS, PROMPT_ASPECT_RATIOS } from '../prompt-engine/types';
import { ANALYTICS_DATE_RANGES } from '../analytics/types';
import { isSettingsThemePreference } from './types';

export interface WorkspaceBackupPayload {
  version: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  exportedAt: string;
  settings: SettingsPreferences;
  campaigns: Campaign[];
  characters: Character[];
  products: Product[];
  wardrobe: WardrobeItem[];
  scenes: Scene[];
  poses: Pose[];
  promptHistory: PromptHistoryEntry[];
  researchSignals?: TrendSignal[];
  viralAnalyses?: SavedViralAnalysis[];
  digitalHumanProfiles?: DigitalHumanProfile[];
  campaignWorkflows?: CampaignWorkflow[];
  promptExperiments?: PromptExperiment[];
  creativeAssets?: CreativeAsset[];
  creativePlans?: CreativePlan[];
  executionRuns?: ExecutionRun[];
  providerJobs?: ProviderJob[];
  providerConnections?: ProviderConnectionPreference[];
  cloudAssets?: CloudAssetRecord[];
  publicationDrafts?: PublicationDraft[];
  publishingJobs?: PublishingJob[];
  publishingConnections?: PublishingConnectionPreference[];
  performanceSnapshots?: any[];
  scorecards?: any[];
  insights?: any[];
  recommendations?: any[];
  feedbackDecisions?: any[];
  calibrationRecords?: any[];
  learningContext?: any;
  experiments?: any[];
  experimentVariants?: any[];
  observations?: any[];
  assignments?: any[];
  analyses?: any[];
  experimentRecommendations?: any[];
  decisions?: any[];
  secureConnectorState?: any;
  syncJobMetadata?: any;
  learningSignals?: any[];
  recipes?: any[];
  recipeVersions?: any[];
  recipeEvidence?: any[];
  recipeScorecards?: any[];
  recipeRecommendations?: any[];
  recipeApplications?: any[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isDate(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && Number.isFinite(new Date(value).getTime());
}
function isArrayAcceptedByParser(value: unknown, parser: (serialized: string | null) => unknown[]): boolean {
  if (!Array.isArray(value)) return false;
  try { return parser(JSON.stringify(value)).length === value.length; } catch { return false; }
}
function isWardrobeItem(value: unknown): value is WardrobeItem {
  return isRecord(value) && typeof value.id === 'string' && value.id.trim() !== '' && typeof value.name === 'string' && value.name.trim() !== '' && typeof value.description === 'string' && isDate(value.createdAt);
}
function isSettingsPreferences(value: unknown): value is SettingsPreferences {
  if (!isRecord(value) || typeof value.theme !== 'string' || !isSettingsThemePreference(value.theme)) return false;
  if (!isRecord(value.promptDefaults)) return false;
  const defaults = value.promptDefaults;
  if (typeof defaults.outputType !== 'string' || !(PROMPT_OUTPUT_TYPES as readonly string[]).includes(defaults.outputType)) return false;
  if (typeof defaults.platform !== 'string' || !(PROMPT_PLATFORMS as readonly string[]).includes(defaults.platform)) return false;
  if (typeof defaults.aspectRatio !== 'string' || !(PROMPT_ASPECT_RATIOS as readonly string[]).includes(defaults.aspectRatio)) return false;
  if (typeof defaults.durationSeconds !== 'number' || !Number.isInteger(defaults.durationSeconds) || defaults.durationSeconds < 1 || defaults.durationSeconds > 60) return false;
  return typeof value.analyticsDefaultRange === 'string' && (ANALYTICS_DATE_RANGES as readonly string[]).includes(value.analyticsDefaultRange);
}

export function deepSanitizeSensitiveKeys(value: unknown): any {
  if (Array.isArray(value)) {
    return value.map(deepSanitizeSensitiveKeys);
  }
  if (value !== null && typeof value === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      const lowerK = k.toLowerCase();
      // Remove any authorization, credentials, secrets, tokens, passwords, cookies, personal audience data, upload headers
      if (
        lowerK.includes('authorization') ||
        lowerK.includes('credential') ||
        lowerK.includes('secret') ||
        lowerK.includes('token') ||
        lowerK.includes('password') ||
        lowerK.includes('cookie') ||
        lowerK.includes('client_secret') ||
        lowerK.includes('clientsecret') ||
        lowerK.includes('refresh_token') ||
        lowerK.includes('refreshtoken') ||
        lowerK.includes('access_token') ||
        lowerK.includes('accesstoken') ||
        lowerK.includes('uploadurl') ||
        lowerK.includes('upload_url') ||
        lowerK.includes('signedurl') ||
        lowerK.includes('signed_url') ||
        lowerK.includes('uploadheader') ||
        lowerK.includes('upload_header') ||
        lowerK.includes('personal') ||
        lowerK.includes('audience') ||
        lowerK.includes('rawresponse') ||
        lowerK.includes('raw_response')
      ) {
        continue;
      }

      let cleanedVal = v;
      if (typeof v === 'string') {
        const lowerV = v.toLowerCase();
        // Remove base64 media or long binary data
        if (
          v.startsWith('data:') ||
          lowerV.includes('base64') ||
          v.length > 5000 // Strip raw unbounded provider responses or huge media values
        ) {
          cleanedVal = undefined;
        } else if (
          lowerV.startsWith('http') &&
          (lowerV.includes('signature=') ||
           lowerV.includes('expires=') ||
           lowerV.includes('token=') ||
           lowerV.includes('mock-token') ||
           lowerV.includes('sig='))
        ) {
          cleanedVal = undefined;
        }
      } else {
        cleanedVal = deepSanitizeSensitiveKeys(v);
      }

      if (cleanedVal !== undefined) {
        cleaned[k] = cleanedVal;
      }
    }
    return cleaned;
  }
  return value;
}

export function sanitizeCloudAssetsForBackup(assets: any[]): any[] {
  if (!Array.isArray(assets)) return [];
  const sanitized = deepSanitizeSensitiveKeys(assets);
  return sanitized.map((asset: any) => {
    const clean = { ...asset };
    // Normalize unfinished uploads to interrupted or failed
    if (
      clean.lifecycleStatus === 'pending' ||
      clean.lifecycleStatus === 'ingesting' ||
      clean.lifecycleStatus === 'processing'
    ) {
      clean.lifecycleStatus = 'failed';
      clean.processingStatus = 'failed';
      clean.failureCode = 'INTERRUPTED';
      clean.failureMessage = 'Ingestion was interrupted due to a system reload or backup restore.';
    }
    return clean;
  });
}

function loadFromLocalStorage(key: string, defaultValue: any): any {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function sanitizeImportPayload(payload: WorkspaceBackupPayload): WorkspaceBackupPayload {
  const cleaned = deepSanitizeSensitiveKeys(payload) as WorkspaceBackupPayload;

  if (cleaned.settings) {
    cleaned.settings.locale = sanitizeLocale(cleaned.settings.locale);
  } else {
    cleaned.settings = {
      theme: 'system',
      promptDefaults: {
        outputType: 'video',
        platform: 'veo-3',
        aspectRatio: '9:16',
        durationSeconds: 8,
      },
      analyticsDefaultRange: '30-days',
      locale: 'pt-BR',
    };
  }

  if (cleaned.publishingJobs) {
    cleaned.publishingJobs = cleaned.publishingJobs.map((job: any) => {
      if (job.status === 'queued' || job.status === 'running') {
        return {
          ...job,
          status: 'failed',
          failureCode: 'INTERRUPTED',
          failureMessage: 'Job was interrupted due to a backup restore.',
        };
      }
      return job;
    });
  }

  if (cleaned.providerJobs) {
    cleaned.providerJobs = cleaned.providerJobs.map((job: any) => {
      if (job.status === 'queued' || job.status === 'running') {
        return {
          ...job,
          status: 'failed',
          failureCode: 'INTERRUPTED',
          failureMessage: 'Job was interrupted due to a backup restore.',
        };
      }
      return job;
    });
  }

  // Active experiments become paused or interrupted on import
  if (cleaned.experiments) {
    cleaned.experiments = cleaned.experiments.map((exp: any) => {
      if (exp.status === 'running' || exp.status === 'evaluating') {
        return {
          ...exp,
          status: 'paused',
          updatedAt: new Date().toISOString()
        };
      }
      return exp;
    });
  }

  // Active secure sync jobs become failed or interrupted on import
  if (cleaned.syncJobMetadata) {
    if (cleaned.syncJobMetadata.status === 'running' || cleaned.syncJobMetadata.status === 'active') {
      cleaned.syncJobMetadata = {
        ...cleaned.syncJobMetadata,
        status: 'failed',
        failureReason: 'INTERRUPTED'
      };
    }
  }

  return cleaned;
}

const parseSnapshots = (val: string | null) => val ? JSON.parse(val) : [];
const parseScorecards = (val: string | null) => val ? JSON.parse(val) : [];
const parseInsights = (val: string | null) => val ? JSON.parse(val) : [];
const parseRecommendations = (val: string | null) => val ? JSON.parse(val) : [];
const parseDecisions = (val: string | null) => val ? JSON.parse(val) : [];
const parseCalibrations = (val: string | null) => val ? JSON.parse(val) : [];

const parseExperiments = (val: string | null) => val ? JSON.parse(val) : [];
const parseVariants = (val: string | null) => val ? JSON.parse(val) : [];
const parseObservations = (val: string | null) => val ? JSON.parse(val) : [];
const parseAssignments = (val: string | null) => val ? JSON.parse(val) : [];
const parseAnalyses = (val: string | null) => val ? JSON.parse(val) : [];
const parseSecureConnectorState = (val: string | null) => val ? JSON.parse(val) : {};
const parseSyncJobMetadata = (val: string | null) => val ? JSON.parse(val) : {};
const parseLearningSignals = (val: string | null) => val ? JSON.parse(val) : [];

const parseRecipes = (val: string | null) => val ? JSON.parse(val) : [];
const parseRecipeVersions = (val: string | null) => val ? JSON.parse(val) : [];
const parseRecipeEvidence = (val: string | null) => val ? JSON.parse(val) : [];
const parseRecipeScorecards = (val: string | null) => val ? JSON.parse(val) : [];
const parseRecipeRecommendations = (val: string | null) => val ? JSON.parse(val) : [];
const parseRecipeApplications = (val: string | null) => val ? JSON.parse(val) : [];

const collectionDefinitions = [
  { property: 'researchSignals', key: RESEARCH_SIGNAL_STORAGE_KEY, load: loadResearchSignals, parse: parseStoredResearchSignals, introducedIn: 2 },
  { property: 'viralAnalyses', key: VIRAL_ANALYSIS_STORAGE_KEY, load: loadViralAnalyses, parse: parseStoredViralAnalyses, introducedIn: 2 },
  { property: 'digitalHumanProfiles', key: DIGITAL_HUMAN_PROFILE_STORAGE_KEY, load: loadDigitalHumanProfiles, parse: parseStoredDigitalHumanProfiles, introducedIn: 2 },
  { property: 'campaignWorkflows', key: CAMPAIGN_WORKFLOW_STORAGE_KEY, load: loadCampaignWorkflows, parse: parseStoredCampaignWorkflows, introducedIn: 2 },
  { property: 'promptExperiments', key: PROMPT_EXPERIMENT_STORAGE_KEY, load: loadPromptExperiments, parse: parseStoredPromptExperiments, introducedIn: 2 },
  { property: 'creativeAssets', key: CREATIVE_ASSET_STORAGE_KEY, load: loadCreativeAssets, parse: parseStoredCreativeAssets, introducedIn: 2 },
  { property: 'creativePlans', key: CREATIVE_PLAN_STORAGE_KEY, load: loadCreativePlans, parse: parseStoredCreativePlans, introducedIn: 2 },
  { property: 'executionRuns', key: EXECUTION_RUN_STORAGE_KEY, load: loadExecutionRuns, parse: parseStoredExecutionRuns, introducedIn: 3 },
  { property: 'providerJobs', key: PROVIDER_JOB_STORAGE_KEY, load: loadProviderJobs, parse: parseStoredProviderJobs, introducedIn: 4 },
  { property: 'providerConnections', key: PROVIDER_CONNECTION_STORAGE_KEY, load: loadProviderConnections, parse: parseStoredProviderConnections, introducedIn: 4 },
  { property: 'cloudAssets', key: ASSET_STORAGE_KEY, load: loadAssetRecords, parse: parseAssetRecords, introducedIn: 5 },
  { property: 'publicationDrafts', key: PUBLICATION_DRAFT_STORAGE_KEY, load: loadPublicationDrafts, parse: parseStoredPublicationDrafts, introducedIn: 6 },
  { property: 'publishingJobs', key: PUBLISHING_JOB_STORAGE_KEY, load: loadPublishingJobs, parse: parseStoredPublishingJobs, introducedIn: 6 },
  { property: 'publishingConnections', key: PUBLISHING_CONNECTION_STORAGE_KEY, load: loadPublishingConnections, parse: parseStoredPublishingConnections, introducedIn: 6 },
  { property: 'performanceSnapshots', key: 'ai_creator_os:performance_snapshots', load: () => loadFromLocalStorage('ai_creator_os:performance_snapshots', []), parse: parseSnapshots, introducedIn: 7 },
  { property: 'scorecards', key: 'ai_creator_os:scorecards', load: () => loadFromLocalStorage('ai_creator_os:scorecards', []), parse: parseScorecards, introducedIn: 7 },
  { property: 'insights', key: 'ai_creator_os:insights', load: () => loadFromLocalStorage('ai_creator_os:insights', []), parse: parseInsights, introducedIn: 7 },
  { property: 'recommendations', key: 'ai_creator_os:recommendations', load: () => loadFromLocalStorage('ai_creator_os:recommendations', []), parse: parseRecommendations, introducedIn: 7 },
  { property: 'feedbackDecisions', key: 'ai_creator_os:feedback_decisions', load: () => loadFromLocalStorage('ai_creator_os:feedback_decisions', []), parse: parseDecisions, introducedIn: 7 },
  { property: 'calibrationRecords', key: 'ai_creator_os:calibration_records', load: () => loadFromLocalStorage('ai_creator_os:calibration_records', []), parse: parseCalibrations, introducedIn: 7 },
  { property: 'experiments', key: 'ai_creator_os:experiments', load: () => loadFromLocalStorage('ai_creator_os:experiments', []), parse: parseExperiments, introducedIn: 8 },
  { property: 'experimentVariants', key: 'ai_creator_os:experiment_variants', load: () => loadFromLocalStorage('ai_creator_os:experiment_variants', []), parse: parseVariants, introducedIn: 8 },
  { property: 'observations', key: 'ai_creator_os:experiment_observations', load: () => loadFromLocalStorage('ai_creator_os:experiment_observations', []), parse: parseObservations, introducedIn: 8 },
  { property: 'assignments', key: 'ai_creator_os:experiment_assignments', load: () => loadFromLocalStorage('ai_creator_os:experiment_assignments', []), parse: parseAssignments, introducedIn: 8 },
  { property: 'analyses', key: 'ai_creator_os:experiment_analyses', load: () => loadFromLocalStorage('ai_creator_os:experiment_analyses', []), parse: parseAnalyses, introducedIn: 8 },
  { property: 'experimentRecommendations', key: 'ai_creator_os:experiment_recommendations', load: () => loadFromLocalStorage('ai_creator_os:experiment_recommendations', []), parse: parseRecommendations, introducedIn: 8 },
  { property: 'decisions', key: 'ai_creator_os:experiment_decisions', load: () => loadFromLocalStorage('ai_creator_os:experiment_decisions', []), parse: parseDecisions, introducedIn: 8 },
  { property: 'secureConnectorState', key: 'ai_creator_os:experiment_secure_connector_state', load: () => loadFromLocalStorage('ai_creator_os:experiment_secure_connector_state', {}), parse: parseSecureConnectorState, introducedIn: 8 },
  { property: 'syncJobMetadata', key: 'ai_creator_os:experiment_sync_job_metadata', load: () => loadFromLocalStorage('ai_creator_os:experiment_sync_job_metadata', {}), parse: parseSyncJobMetadata, introducedIn: 8 },
  { property: 'learningSignals', key: 'ai_creator_os:experiment_learning_signals', load: () => loadFromLocalStorage('ai_creator_os:experiment_learning_signals', []), parse: parseLearningSignals, introducedIn: 8 },
  { property: 'recipes', key: 'ai_creator_os:creative_recipes', load: () => loadFromLocalStorage('ai_creator_os:creative_recipes', []), parse: parseRecipes, introducedIn: 9 },
  { property: 'recipeVersions', key: 'ai_creator_os:creative_recipe_versions', load: () => loadFromLocalStorage('ai_creator_os:creative_recipe_versions', []), parse: parseRecipeVersions, introducedIn: 9 },
  { property: 'recipeEvidence', key: 'ai_creator_os:creative_recipe_evidence', load: () => loadFromLocalStorage('ai_creator_os:creative_recipe_evidence', []), parse: parseRecipeEvidence, introducedIn: 9 },
  { property: 'recipeScorecards', key: 'ai_creator_os:creative_recipe_scorecards', load: () => loadFromLocalStorage('ai_creator_os:creative_recipe_scorecards', []), parse: parseRecipeScorecards, introducedIn: 9 },
  { property: 'recipeRecommendations', key: 'ai_creator_os:creative_recipe_recommendations', load: () => loadFromLocalStorage('ai_creator_os:creative_recipe_recommendations', []), parse: parseRecipeRecommendations, introducedIn: 9 },
  { property: 'recipeApplications', key: 'ai_creator_os:creative_recipes:applications', load: () => loadFromLocalStorage('ai_creator_os:creative_recipes:applications', []), parse: parseRecipeApplications, introducedIn: 9 },
] as const;

export function createWorkspaceBackup(): WorkspaceBackupPayload {
  return {
    version: 10,
    exportedAt: new Date().toISOString(),
    settings: loadSettingsFromStorage(),
    campaigns: loadCampaignsFromStorage(),
    characters: loadCharactersFromStorage(),
    products: loadProductsFromStorage(),
    wardrobe: loadWardrobeItemsFromStorage(),
    scenes: loadScenesFromStorage(),
    poses: loadPosesFromStorage(),
    promptHistory: loadPromptHistoryFromStorage(),
    researchSignals: loadResearchSignals(),
    viralAnalyses: loadViralAnalyses(),
    digitalHumanProfiles: loadDigitalHumanProfiles(),
    campaignWorkflows: loadCampaignWorkflows(),
    promptExperiments: loadPromptExperiments(),
    creativeAssets: loadCreativeAssets(),
    creativePlans: loadCreativePlans(),
    executionRuns: loadExecutionRuns(),
    providerJobs: loadProviderJobs(),
    providerConnections: loadProviderConnections(),
    cloudAssets: sanitizeCloudAssetsForBackup(loadAssetRecords()),
    publicationDrafts: deepSanitizeSensitiveKeys(loadPublicationDrafts()),
    publishingJobs: deepSanitizeSensitiveKeys(loadPublishingJobs()),
    publishingConnections: deepSanitizeSensitiveKeys(loadPublishingConnections()),
    performanceSnapshots: deepSanitizeSensitiveKeys(loadFromLocalStorage('ai_creator_os:performance_snapshots', [])),
    scorecards: deepSanitizeSensitiveKeys(loadFromLocalStorage('ai_creator_os:scorecards', [])),
    insights: deepSanitizeSensitiveKeys(loadFromLocalStorage('ai_creator_os:insights', [])),
    recommendations: deepSanitizeSensitiveKeys(loadFromLocalStorage('ai_creator_os:recommendations', [])),
    feedbackDecisions: deepSanitizeSensitiveKeys(loadFromLocalStorage('ai_creator_os:feedback_decisions', [])),
    calibrationRecords: deepSanitizeSensitiveKeys(loadFromLocalStorage('ai_creator_os:calibration_records', [])),
    learningContext: deepSanitizeSensitiveKeys(loadFromLocalStorage('ai_creator_os:learning_context', null)),
    experiments: deepSanitizeSensitiveKeys(loadFromLocalStorage('ai_creator_os:experiments', [])),
    experimentVariants: deepSanitizeSensitiveKeys(loadFromLocalStorage('ai_creator_os:experiment_variants', [])),
    observations: deepSanitizeSensitiveKeys(loadFromLocalStorage('ai_creator_os:experiment_observations', [])),
    assignments: deepSanitizeSensitiveKeys(loadFromLocalStorage('ai_creator_os:experiment_assignments', [])),
    analyses: deepSanitizeSensitiveKeys(loadFromLocalStorage('ai_creator_os:experiment_analyses', [])),
    experimentRecommendations: deepSanitizeSensitiveKeys(loadFromLocalStorage('ai_creator_os:experiment_recommendations', [])),
    decisions: deepSanitizeSensitiveKeys(loadFromLocalStorage('ai_creator_os:experiment_decisions', [])),
    secureConnectorState: deepSanitizeSensitiveKeys(loadFromLocalStorage('ai_creator_os:experiment_secure_connector_state', {})),
    syncJobMetadata: deepSanitizeSensitiveKeys(loadFromLocalStorage('ai_creator_os:experiment_sync_job_metadata', {})),
    learningSignals: deepSanitizeSensitiveKeys(loadFromLocalStorage('ai_creator_os:experiment_learning_signals', [])),
    recipes: deepSanitizeSensitiveKeys(loadFromLocalStorage('ai_creator_os:creative_recipes', [])),
    recipeVersions: deepSanitizeSensitiveKeys(loadFromLocalStorage('ai_creator_os:creative_recipe_versions', [])),
    recipeEvidence: deepSanitizeSensitiveKeys(loadFromLocalStorage('ai_creator_os:creative_recipe_evidence', [])),
    recipeScorecards: deepSanitizeSensitiveKeys(loadFromLocalStorage('ai_creator_os:creative_recipe_scorecards', [])),
    recipeRecommendations: deepSanitizeSensitiveKeys(loadFromLocalStorage('ai_creator_os:creative_recipe_recommendations', [])),
    recipeApplications: deepSanitizeSensitiveKeys(loadFromLocalStorage('ai_creator_os:creative_recipes:applications', [])),
  };
}

export function validateWorkspaceBackup(value: unknown): value is WorkspaceBackupPayload {
  if (!isRecord(value) || (value.version !== 1 && value.version !== 2 && value.version !== 3 && value.version !== 4 && value.version !== 5 && value.version !== 6 && value.version !== 7 && value.version !== 8 && value.version !== 9 && value.version !== 10) || !isDate(value.exportedAt)) return false;
  if (!isSettingsPreferences(value.settings)) return false;
  if (!isArrayAcceptedByParser(value.campaigns, parseStoredCampaigns)) return false;
  if (!isArrayAcceptedByParser(value.characters, parseStoredCharacters)) return false;
  if (!isArrayAcceptedByParser(value.products, parseStoredProducts)) return false;
  if (!Array.isArray(value.wardrobe) || !value.wardrobe.every(isWardrobeItem)) return false;
  if (!isArrayAcceptedByParser(value.scenes, parseStoredScenes)) return false;
  if (!isArrayAcceptedByParser(value.poses, parseStoredPoses)) return false;
  if (!isArrayAcceptedByParser(value.promptHistory, parseStoredPromptHistory)) return false;
  for (const definition of collectionDefinitions) {
    const collectionValue = value[definition.property];
    if (value.version >= definition.introducedIn && collectionValue === undefined) return false;
    if (collectionValue !== undefined) {
      if (definition.property === 'secureConnectorState' || definition.property === 'syncJobMetadata') {
        if (!isRecord(collectionValue)) return false;
      } else {
        if (!isArrayAcceptedByParser(collectionValue, definition.parse as any)) return false;
      }
    }
  }
  return true;
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage; } catch { return null; }
}

function targetEntries(payload: WorkspaceBackupPayload): Array<[string, string]> {
  const entries: Array<[string, unknown]> = [
    [SETTINGS_STORAGE_KEY, payload.settings],
    [CAMPAIGN_STORAGE_KEY, payload.campaigns],
    [CHARACTER_STORAGE_KEY, payload.characters],
    [PRODUCT_STORAGE_KEY, payload.products],
    [WARDROBE_STORAGE_KEY, payload.wardrobe],
    [SCENE_STORAGE_KEY, payload.scenes],
    [POSE_STORAGE_KEY, payload.poses],
    [PROMPT_HISTORY_STORAGE_KEY, payload.promptHistory],
    [RESEARCH_SIGNAL_STORAGE_KEY, payload.researchSignals ?? []],
    [VIRAL_ANALYSIS_STORAGE_KEY, payload.viralAnalyses ?? []],
    [DIGITAL_HUMAN_PROFILE_STORAGE_KEY, payload.digitalHumanProfiles ?? []],
    [CAMPAIGN_WORKFLOW_STORAGE_KEY, payload.campaignWorkflows ?? []],
    [PROMPT_EXPERIMENT_STORAGE_KEY, payload.promptExperiments ?? []],
    [CREATIVE_ASSET_STORAGE_KEY, payload.creativeAssets ?? []],
    [CREATIVE_PLAN_STORAGE_KEY, payload.creativePlans ?? []],
    [EXECUTION_RUN_STORAGE_KEY, payload.executionRuns ?? []],
    [PROVIDER_JOB_STORAGE_KEY, payload.providerJobs ?? []],
    [PROVIDER_CONNECTION_STORAGE_KEY, payload.providerConnections ?? []],
    [ASSET_STORAGE_KEY, sanitizeCloudAssetsForBackup(payload.cloudAssets ?? [])],
    [PUBLICATION_DRAFT_STORAGE_KEY, deepSanitizeSensitiveKeys(payload.publicationDrafts ?? [])],
    [PUBLISHING_JOB_STORAGE_KEY, deepSanitizeSensitiveKeys(payload.publishingJobs ?? [])],
    [PUBLISHING_CONNECTION_STORAGE_KEY, deepSanitizeSensitiveKeys(payload.publishingConnections ?? [])],
    ['ai_creator_os:performance_snapshots', payload.performanceSnapshots ?? []],
    ['ai_creator_os:scorecards', payload.scorecards ?? []],
    ['ai_creator_os:insights', payload.insights ?? []],
    ['ai_creator_os:recommendations', payload.recommendations ?? []],
    ['ai_creator_os:feedback_decisions', payload.feedbackDecisions ?? []],
    ['ai_creator_os:calibration_records', payload.calibrationRecords ?? []],
    ['ai_creator_os:learning_context', payload.learningContext ?? null],
    ['ai_creator_os:experiments', payload.experiments ?? []],
    ['ai_creator_os:experiment_variants', payload.experimentVariants ?? []],
    ['ai_creator_os:experiment_observations', payload.observations ?? []],
    ['ai_creator_os:experiment_assignments', payload.assignments ?? []],
    ['ai_creator_os:experiment_analyses', payload.analyses ?? []],
    ['ai_creator_os:experiment_recommendations', payload.experimentRecommendations ?? []],
    ['ai_creator_os:experiment_decisions', payload.decisions ?? []],
    ['ai_creator_os:experiment_secure_connector_state', payload.secureConnectorState ?? {}],
    ['ai_creator_os:experiment_sync_job_metadata', payload.syncJobMetadata ?? {}],
    ['ai_creator_os:experiment_learning_signals', payload.learningSignals ?? []],
    ['ai_creator_os:creative_recipes', payload.recipes ?? []],
    ['ai_creator_os:creative_recipe_versions', payload.recipeVersions ?? []],
    ['ai_creator_os:creative_recipe_evidence', payload.recipeEvidence ?? []],
    ['ai_creator_os:creative_recipe_scorecards', payload.recipeScorecards ?? []],
    ['ai_creator_os:creative_recipe_recommendations', payload.recipeRecommendations ?? []],
    ['ai_creator_os:creative_recipes:applications', payload.recipeApplications ?? []],
  ];
  return entries.map(([key, value]) => [key, JSON.stringify(value)]);
}

function rollback(storage: Storage, previous: Array<[string, string | null]>): void {
  for (const [key, value] of previous) {
    try { if (value === null) storage.removeItem(key); else storage.setItem(key, value); } catch { /* best effort */ }
  }
}

export function restoreWorkspaceBackup(payload: WorkspaceBackupPayload): boolean {
  if (!validateWorkspaceBackup(payload)) return false;
  const sanitized = sanitizeImportPayload(payload);
  const storage = getStorage();
  if (!storage) return false;
  let targets: Array<[string, string]>;
  try { targets = targetEntries(sanitized); } catch { return false; }
  const previous: Array<[string, string | null]> = [];
  try { for (const [key] of targets) previous.push([key, storage.getItem(key)]); } catch { return false; }
  try { for (const [key, value] of targets) storage.setItem(key, value); } catch { rollback(storage, previous); return false; }
  notifySettingsChanged();
  return true;
}

export function clearWorkspaceStorage(): boolean {
  const storage = getStorage();
  if (!storage) return false;
  const keys = targetEntries(createWorkspaceBackup()).map(([key]) => key);
  const previous: Array<[string, string | null]> = [];
  try { for (const key of keys) previous.push([key, storage.getItem(key)]); } catch { return false; }
  try { for (const key of keys) storage.removeItem(key); } catch { rollback(storage, previous); return false; }
  notifySettingsChanged();
  return true;
}
