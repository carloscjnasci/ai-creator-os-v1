import {
  CreativeRecipe,
  CreativeRecipeVersion,
  RecipeApplication,
  CreativeRecipeCategory,
  RecipeSourceType,
  CreativeRecipeStatus,
  RecipeVersionStatus,
  RecipeApplicationStatus,
  RecipeParameterType,
} from './types';
import { createRecipe, createRecipeApplication } from './recipeWorkflows';
import { loadRecipes, saveRecipes, loadRecipeVersions, saveRecipeVersions, loadRecipeApplications, saveRecipeApplications } from './recipeStorage';
import { loadExperiments, loadVariants, loadAnalyses } from '../experimentation/experimentStorage';
import { AnalysisResultStatus } from '../experimentation/types';
import { loadCreativeAssets, saveCreativeAssets } from '../creative-library/lib/creativeAssetStorage';
import { CreativeAsset } from '../creative-library/types';
import { loadCampaignsFromStorage, saveCampaignsToStorage } from '../campaigns/lib/campaignStorage';
import { Campaign } from '../campaigns/types';
import { generateRecipeScorecardWorkflow } from './recipeWorkflows';

/**
 * 1. EXPERIMENTATION INTEGRATION
 * Converts an experiment winner variant into a parameterized Creative Recipe draft.
 * Throws if the experiment is inconclusive or has insufficient samples.
 */
export function convertWinnerToRecipeDraft(
  experimentId: string,
  workspaceId: string,
  name: string,
  category: CreativeRecipeCategory,
  creatorId: string
): { recipe: CreativeRecipe; version: CreativeRecipeVersion } {
  const analyses = loadAnalyses();
  const analysis = analyses.find(a => a.experimentId === experimentId);

  if (!analysis) {
    throw new Error(`No analysis completed yet for experiment ${experimentId}`);
  }

  // Handle inconclusive experiments or invalid data: do not automatically generate winning recipes
  if (
    analysis.resultStatus === AnalysisResultStatus.INCONCLUSIVE ||
    analysis.resultStatus === AnalysisResultStatus.INSUFFICIENT_SAMPLE ||
    analysis.resultStatus === AnalysisResultStatus.INVALID_DATA
  ) {
    throw new Error(
      `Inconclusive experiments cannot be converted to winning recipes. Analysis Status: ${analysis.resultStatus}`
    );
  }

  const variants = loadVariants().filter(v => v.experimentId === experimentId);
  const winnerVariant = variants.find(v => v.id === analysis.winnerVariantId);

  if (!winnerVariant) {
    throw new Error(`Winner variant ${analysis.winnerVariantId} not found in experiment ${experimentId}`);
  }

  // Prepare parameters and structures from winner variant details
  const parameters = [
    {
      id: 'param-digital-human',
      key: 'digitalHumanId',
      label: 'Digital Human ID',
      description: 'The digital human actor to use for this recipe.',
      parameterType: RecipeParameterType.TEXT,
      required: false,
      defaultValue: winnerVariant.digitalHumanId || '',
      visibility: 'visible' as const,
      order: 1,
    },
    {
      id: 'param-product',
      key: 'productId',
      label: 'Product ID',
      description: 'The product associated with the ad variant.',
      parameterType: RecipeParameterType.TEXT,
      required: false,
      defaultValue: winnerVariant.productId || '',
      visibility: 'visible' as const,
      order: 2,
    },
  ];

  const stages = [
    {
      id: 'stage-1',
      name: 'Winning Variant Execution',
      description: `Run campaign stage matching the winning variant parameters: ${winnerVariant.name}`,
      template: `Apply winning experiment structure. Digital Human: {{digitalHumanId}}, Product: {{productId}}`,
      parameterBindings: {
        digitalHumanId: 'digitalHumanId',
        productId: 'productId',
      },
      dependencies: [],
    },
  ];

  return createRecipe(workspaceId, name, category, 'Maximize campaign performance using proven A/B test layout.', creatorId, {
    description: `Creative recipe converted from winning experiment '${experimentId}' variant '${winnerVariant.name}'.`,
    sourceType: RecipeSourceType.WINNING_EXPERIMENT,
    sourceEntityIds: [experimentId],
    parameters,
    structure: { stages },
  });
}

/**
 * 2. PROMPT INTELLIGENCE INTEGRATION
 * Converts a prompt version into a prompt recipe, preserving negative prompts and model configs.
 */
export function convertPromptVersionToRecipe(
  workspaceId: string,
  promptVersionId: string,
  name: string,
  promptText: string,
  negativePrompt: string,
  model: string,
  creatorId: string
): { recipe: CreativeRecipe; version: CreativeRecipeVersion } {
  const parameters = [
    {
      id: 'param-prompt-text',
      key: 'promptText',
      label: 'Main Prompt',
      description: 'The customized prompt text parameter.',
      parameterType: RecipeParameterType.TEXT,
      required: true,
      defaultValue: promptText,
      visibility: 'visible' as const,
      order: 1,
    },
  ];

  const stages = [
    {
      id: 'stage-prompt',
      name: 'Prompt Synthesis',
      description: 'Synthesizing creative prompt with negative constraints.',
      template: `Model: ${model}\nNegative Prompt: ${negativePrompt}\nPrompt: {{promptText}}`,
      parameterBindings: {
        promptText: 'promptText',
      },
      dependencies: [],
    },
  ];

  return createRecipe(workspaceId, name, CreativeRecipeCategory.PROMPT, 'Optimize text or layout synthesis.', creatorId, {
    description: `Prompt recipe derived from prompt version ${promptVersionId}.`,
    sourceType: RecipeSourceType.PROMPT_HISTORY,
    sourceEntityIds: [promptVersionId],
    parameters,
    structure: { stages },
  });
}

/**
 * Instantiates a prompt recipe as a new mock prompt version history record.
 */
export function instantiatePromptRecipeAsVersion(
  applicationId: string,
  operatorId: string,
  workspaceContext: Record<string, any>
): { promptHistoryId: string; promptText: string; negativePrompt: string } {
  // We apply approval validation first
  const apps = loadRecipeApplications();
  const app = apps.find(a => a.id === applicationId);
  if (!app) {
    throw new Error(`Application ${applicationId} not found`);
  }

  if (app.status !== RecipeApplicationStatus.APPROVED) {
    throw new Error('Application must be approved before instantiating prompt version.');
  }

  const promptHistoryId = `pr-hist-gen-${Date.now()}`;
  return {
    promptHistoryId,
    promptText: app.parameterValues.promptText || 'Custom generated prompt text.',
    negativePrompt: 'No low quality, no duplicates',
  };
}

/**
 * 3. CAMPAIGN BUILDER INTEGRATION
 * Resolves a campaign recipe application into a real campaign entity.
 */
export function createCampaignFromRecipeApplication(
  applicationId: string,
  campaignName: string,
  operatorId: string
): Campaign {
  const apps = loadRecipeApplications();
  const app = apps.find(a => a.id === applicationId);
  if (!app) {
    throw new Error(`Recipe application ${applicationId} not found`);
  }

  if (app.status !== RecipeApplicationStatus.APPROVED) {
    throw new Error(`Applying campaign recipe requires explicit APPROVED status. Current: ${app.status}`);
  }

  // Generate the campaign
  const campaigns = loadCampaignsFromStorage();
  const campaignId = `camp-rec-${Date.now()}`;

  const newCampaign: Campaign = {
    id: campaignId,
    name: campaignName,
    description: `Campaign instantiated from recipe application: ${applicationId}`,
    status: 'draft',
    createdAt: new Date().toISOString(),
    characterId: app.parameterValues.digitalHumanId || 'unassigned',
    productId: app.parameterValues.productId || 'unassigned',
    wardrobeItemId: app.parameterValues.wardrobeItemId || 'default',
    sceneId: app.parameterValues.sceneId || 'studio',
  };

  saveCampaignsToStorage([...campaigns, newCampaign]);

  // Mark application as completed
  const appIndex = apps.findIndex(a => a.id === applicationId);
  if (appIndex !== -1) {
    apps[appIndex] = {
      ...apps[appIndex],
      status: RecipeApplicationStatus.COMPLETED,
      completedAt: new Date().toISOString(),
      createdEntities: [...(apps[appIndex].createdEntities || []), campaignId],
      updatedAt: new Date().toISOString(),
    };
    saveRecipeApplications(apps);
  }

  return newCampaign;
}

/**
 * 4. CREATIVE PLANNER AND AI DIRECTOR
 * Recommends relevant active recipes ranked by objective fit and brand compliance.
 */
export interface RecipeAdvisoryProposal {
  recipe: CreativeRecipe;
  scorecardScore: number;
  confidence: number;
  matchReason: string;
}

export function recommendRecipesForObjective(
  workspaceId: string,
  objective: string,
  brandRuleIds: string[]
): RecipeAdvisoryProposal[] {
  const recipes = loadRecipes().filter(
    r => r.workspaceId === workspaceId && r.status === CreativeRecipeStatus.ACTIVE
  );
  const versions = loadRecipeVersions();

  const recommendations: RecipeAdvisoryProposal[] = [];

  for (const recipe of recipes) {
    const activeVersion = versions.find(v => v.recipeId === recipe.id && v.status === 'active');
    if (!activeVersion) continue;

    // Check brand rules overlap or match
    const brandMatch = recipe.brandRuleIds.every(id => brandRuleIds.includes(id));
    
    // Rationale matching
    let matchReason = '';
    let objectiveMultiplier = 1;

    if (recipe.objective.toLowerCase().includes(objective.toLowerCase())) {
      matchReason = `Direct match on workspace target objective: '${objective}'.`;
      objectiveMultiplier = 1.2;
    } else if (brandMatch) {
      matchReason = 'Linked with active brand rules compliance.';
      objectiveMultiplier = 1.0;
    } else {
      matchReason = 'General fit based on historically stable performance.';
      objectiveMultiplier = 0.8;
    }

    // Generate scorecard to get official score
    const scorecard = generateRecipeScorecardWorkflow(recipe.id, activeVersion.id);
    const finalScore = Math.round(scorecard.overallScore * objectiveMultiplier);

    recommendations.push({
      recipe,
      scorecardScore: Math.min(100, finalScore),
      confidence: scorecard.confidence,
      matchReason,
    });
  }

  // Sort by scorecardScore descending
  return recommendations.sort((a, b) => b.scorecardScore - a.scorecardScore);
}

/**
 * 5. DIGITAL HUMAN INTELLIGENCE
 * Validates compatible parameters with Digital Human actor DNA.
 */
export function checkDigitalHumanRecipeCompatibility(
  digitalHumanId: string,
  recipeVersionId: string
): { compatible: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const versions = loadRecipeVersions();
  const version = versions.find(v => v.id === recipeVersionId);

  if (!version) {
    return { compatible: false, warnings: ['Recipe version not found.'] };
  }

  // Mock checking compatibility constraints
  const constraints = version.constraints || {};
  if (constraints.personalityRequired) {
    warnings.push(`Actor must have personality trait: ${constraints.personalityRequired}`);
  }

  return {
    compatible: true,
    warnings,
  };
}

/**
 * 6. CREATIVE LIBRARY INTEGRATION
 * Attaches metadata to assets representing recipe lineages and scores.
 */
export function attachRecipeMetadataToAsset(
  assetId: string,
  recipeId: string,
  performanceScore: number
): boolean {
  const assets = loadCreativeAssets();
  const index = assets.findIndex(a => a.id === assetId);
  if (index === -1) return false;

  const currentTags = assets[index].tags || [];
  const recipeTag = `recipe:${recipeId}`;
  const updatedTags = currentTags.includes(recipeTag) ? currentTags : [...currentTags, recipeTag];

  assets[index] = {
    ...assets[index],
    tags: updatedTags,
    observedPerformanceScore: performanceScore,
  };

  return saveCreativeAssets(assets);
}
