import {
  CreativeRecipe,
  CreativeRecipeVersion,
  CreativeRecipeCategory,
  CreativeRecipeStatus,
  RecipeSourceType,
} from '../types';
import { loadRecipes, saveRecipes, loadRecipeVersions, saveRecipeVersions } from '../recipeStorage';
import { validateRecipe, ValidationResult } from '../recipeValidator';
import { transitionRecipeStatus } from '../recipeLifecycle';
import { createNewVersionDraft, editVersion } from '../recipeVersioning';
import { activateRecipeVersion } from '../recipeWorkflows';

export const ManualRecipeAdapter = {
  createRecipe(
    workspaceId: string,
    name: string,
    description: string,
    category: CreativeRecipeCategory,
    creatorId: string,
    options?: {
      objective?: string;
      targetPlatforms?: string[];
      targetAudienceDescription?: string;
      productCategories?: string[];
      tags?: string[];
    }
  ): CreativeRecipe {
    const recipes = loadRecipes();
    const id = `rec-man-${Date.now()}`;
    const now = new Date().toISOString();

    const newRecipe: CreativeRecipe = {
      id,
      workspaceId,
      name,
      description,
      category,
      status: CreativeRecipeStatus.DRAFT,
      currentVersionId: '',
      sourceType: RecipeSourceType.MANUAL,
      sourceEntityIds: [],
      objective: options?.objective || '',
      targetPlatforms: options?.targetPlatforms || [],
      targetAudienceDescription: options?.targetAudienceDescription || '',
      productCategories: options?.productCategories || [],
      tags: options?.tags || [],
      requiredCapabilities: [],
      brandRuleIds: [],
      evidenceSummary: {
        evidenceCount: 0,
        averageScore: 0,
        liftSummary: 'User-created manual template.',
      },
      confidence: 0,
      usageCount: 0,
      successfulApplicationCount: 0,
      averageObservedScore: 0,
      createdBy: creatorId,
      createdAt: now,
      updatedAt: now,
    };

    recipes.push(newRecipe);
    saveRecipes(recipes);

    // Create initial version 1
    createNewVersionDraft(id, undefined, creatorId, {
      versionLabel: 'v1.0.0-draft',
      changeSummary: 'Initial manual recipe draft version.',
    });

    return newRecipe;
  },

  createVersion(
    recipeId: string,
    parentVersionId: string | undefined,
    creatorId: string,
    options?: any
  ): CreativeRecipeVersion {
    return createNewVersionDraft(recipeId, parentVersionId, creatorId, options);
  },

  validateRecipe(recipeId: string, versionId?: string): ValidationResult {
    return validateRecipe(recipeId, versionId);
  },

  publishRecipeVersion(recipeId: string, versionId: string, operatorId: string): { recipe: CreativeRecipe; activatedVersion: CreativeRecipeVersion } {
    const valResult = validateRecipe(recipeId, versionId);
    if (!valResult.valid) {
      throw new Error(`Cannot activate version ${versionId}: ${valResult.errors.join(', ')}`);
    }
    return activateRecipeVersion(recipeId, versionId, operatorId);
  },

  archiveRecipe(recipeId: string, operatorId: string): CreativeRecipe {
    return transitionRecipeStatus(recipeId, CreativeRecipeStatus.ARCHIVED, operatorId);
  },

  editRecipeVersion(
    recipeId: string,
    versionId: string,
    updates: any,
    operatorId: string
  ): CreativeRecipeVersion {
    return editVersion(recipeId, versionId, updates, operatorId);
  }
};
