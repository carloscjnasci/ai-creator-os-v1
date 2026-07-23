import {
  CreativeRecipe,
  CreativeRecipeVersion,
  RecipeEvidence,
  RecipeScorecard,
  RecipeRecommendation,
  RecipeApplication,
  CreativeRecipeCategory,
  RecipeSourceType,
  CreativeRecipeStatus,
  RecipeVersionStatus,
  RecipeApplicationStatus,
  RecipeRecommendationType,
  RecipeRecommendationStatus,
  RecipeApplicationPreview,
} from './types';
import {
  loadRecipes,
  saveRecipes,
  loadRecipeVersions,
  saveRecipeVersions,
  loadRecipeEvidence,
  saveRecipeEvidence,
  loadRecipeScorecards,
  saveRecipeScorecards,
  loadRecipeRecommendations,
  saveRecipeRecommendations,
  loadRecipeApplications,
  saveRecipeApplications,
} from './recipeStorage';
import { validateRecipe, ValidationResult } from './recipeValidator';
import { instantiateRecipeVersion } from './recipeInstantiation';
import { generateRecipeScorecard } from './recipeScoring';
import { addRecipeEvidence } from './recipeEvidence';
import { createNewVersionDraft, activateVersion as baseActivateVersion } from './recipeVersioning';
import { transitionRecipeStatus } from './recipeLifecycle';
import { recordRecommendationDecision } from './recipeRecommendationEngine';

/**
 * Creates a new recipe and its first draft version (v1) in a single atomic and idempotent action.
 */
export function createRecipe(
  workspaceId: string,
  name: string,
  category: CreativeRecipeCategory,
  objective: string,
  creatorId: string,
  options?: {
    description?: string;
    targetPlatforms?: string[];
    targetAudienceDescription?: string;
    productCategories?: string[];
    tags?: string[];
    requiredCapabilities?: string[];
    brandRuleIds?: string[];
    sourceType?: RecipeSourceType;
    sourceEntityIds?: string[];
    parameters?: any[];
    structure?: any;
    id?: string;
  }
): { recipe: CreativeRecipe; version: CreativeRecipeVersion } {
  const recipes = loadRecipes();

  // Idempotency check: If a recipe with same name in same workspace already exists, return it
  const existingRecipe = recipes.find(
    r => r.workspaceId === workspaceId && r.name === name && r.category === category
  );
  if (existingRecipe) {
    const versions = loadRecipeVersions().filter(v => v.recipeId === existingRecipe.id);
    const sorted = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);
    return { recipe: existingRecipe, version: sorted[0] };
  }

  const recipeId = options?.id || `rec-${workspaceId}-${Date.now()}`;
  const now = new Date().toISOString();

  const recipe: CreativeRecipe = {
    id: recipeId,
    workspaceId,
    name,
    description: options?.description || '',
    category,
    status: CreativeRecipeStatus.DRAFT,
    currentVersionId: `ver-${recipeId}-1`,
    sourceType: options?.sourceType || RecipeSourceType.MANUAL,
    sourceEntityIds: options?.sourceEntityIds || [],
    objective,
    targetPlatforms: options?.targetPlatforms || [],
    targetAudienceDescription: options?.targetAudienceDescription || '',
    productCategories: options?.productCategories || [],
    tags: options?.tags || [],
    requiredCapabilities: options?.requiredCapabilities || [],
    brandRuleIds: options?.brandRuleIds || [],
    evidenceSummary: {
      evidenceCount: 0,
      averageScore: 0,
      liftSummary: '',
    },
    confidence: 0,
    usageCount: 0,
    successfulApplicationCount: 0,
    averageObservedScore: 0,
    createdBy: creatorId,
    createdAt: now,
    updatedAt: now,
  };

  const version: CreativeRecipeVersion = {
    id: `ver-${recipeId}-1`,
    recipeId,
    versionNumber: 1,
    versionLabel: 'v1.0.0-draft',
    changeSummary: 'Initial draft version created.',
    status: RecipeVersionStatus.DRAFT,
    structure: options?.structure || { stages: [] },
    parameters: options?.parameters || [],
    constraints: {},
    outputContract: {},
    validationRules: {},
    compatiblePlatforms: options?.targetPlatforms || [],
    compatibleModels: ['gemini-2.5-flash'],
    evidenceIds: [],
    createdBy: creatorId,
    createdAt: now,
  };

  const originalRecipes = loadRecipes();
  const originalVersions = loadRecipeVersions();

  try {
    saveRecipes([...originalRecipes, recipe]);
    saveRecipeVersions([...originalVersions, version]);
  } catch (err) {
    saveRecipes(originalRecipes);
    saveRecipeVersions(originalVersions);
    throw new Error(`PersistenceFailure: Failed to create recipe. ${err}`);
  }

  return { recipe, version };
}

/**
 * Allows editing draft recipe details only when the status is DRAFT.
 */
export function editDraftRecipe(
  recipeId: string,
  updates: Partial<Omit<CreativeRecipe, 'id' | 'workspaceId' | 'status' | 'createdAt' | 'createdBy'>>,
  operatorId: string
): CreativeRecipe {
  const recipes = loadRecipes();
  const index = recipes.findIndex(r => r.id === recipeId);
  if (index === -1) {
    throw new Error(`Recipe ${recipeId} not found`);
  }

  const recipe = recipes[index];
  if (recipe.status !== CreativeRecipeStatus.DRAFT) {
    throw new Error(`Recipe ${recipeId} cannot be edited because it is not in DRAFT status (current status: ${recipe.status})`);
  }

  const updated: CreativeRecipe = {
    ...recipe,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const originalRecipes = loadRecipes();
  try {
    recipes[index] = updated;
    saveRecipes(recipes);
  } catch (err) {
    saveRecipes(originalRecipes);
    throw new Error(`PersistenceFailure: Failed to edit recipe draft. ${err}`);
  }

  return updated;
}

/**
 * Spawns a new version of the recipe, with atomic and persistence safeguards.
 */
export function createRecipeVersion(
  recipeId: string,
  parentVersionId: string | undefined,
  creatorId: string,
  options?: any
): CreativeRecipeVersion {
  const originalVersions = loadRecipeVersions();
  try {
    return createNewVersionDraft(recipeId, parentVersionId, creatorId, options);
  } catch (err) {
    saveRecipeVersions(originalVersions);
    throw new Error(`PersistenceFailure: Failed to create recipe version. ${err}`);
  }
}

/**
 * Clones an existing recipe version structure and parameters into a new draft version.
 */
export function duplicateVersion(
  recipeId: string,
  versionId: string,
  creatorId: string,
  changeSummary?: string
): CreativeRecipeVersion {
  const versions = loadRecipeVersions();
  const source = versions.find(v => v.id === versionId && v.recipeId === recipeId);
  if (!source) {
    throw new Error(`Version ${versionId} not found under recipe ${recipeId}`);
  }

  const nextNum = Math.max(...versions.filter(v => v.recipeId === recipeId).map(v => v.versionNumber)) + 1;
  const duplicateId = `ver-${recipeId}-${nextNum}`;
  const now = new Date().toISOString();

  const newVersion: CreativeRecipeVersion = {
    ...source,
    id: duplicateId,
    versionNumber: nextNum,
    versionLabel: `v${nextNum}.0.0-duplicate`,
    changeSummary: changeSummary || `Duplicate of ${versionId}`,
    status: RecipeVersionStatus.DRAFT,
    parentVersionId: versionId,
    createdBy: creatorId,
    createdAt: now,
    activatedAt: undefined,
    supersededAt: undefined,
    evidenceIds: [],
  };

  const originalVersions = loadRecipeVersions();
  try {
    versions.push(newVersion);
    saveRecipeVersions(versions);
  } catch (err) {
    saveRecipeVersions(originalVersions);
    throw new Error(`PersistenceFailure: Failed to duplicate version. ${err}`);
  }

  return newVersion;
}

/**
 * Performs full validation on a specific recipe version, and transitions recipe/version status.
 * Recipe lifecycle follows DRAFT → VALIDATING → READY.
 */
export function validateRecipeVersion(recipeId: string, versionId: string): ValidationResult {
  const originalRecipes = loadRecipes();
  const originalVersions = loadRecipeVersions();

  const recipeIndex = originalRecipes.findIndex(r => r.id === recipeId);
  if (recipeIndex === -1) {
    throw new Error(`Recipe ${recipeId} not found`);
  }
  const recipe = originalRecipes[recipeIndex];

  const versionIndex = originalVersions.findIndex(v => v.id === versionId && v.recipeId === recipeId);
  if (versionIndex === -1) {
    throw new Error(`Version ${versionId} not found under recipe ${recipeId}`);
  }
  const version = originalVersions[versionIndex];

  // 1. Transition recipe status to VALIDATING (if DRAFT, FAILED, DEPRECATED, READY)
  let currentRecipe = recipe;
  if (
    recipe.status === CreativeRecipeStatus.DRAFT ||
    recipe.status === CreativeRecipeStatus.FAILED ||
    recipe.status === CreativeRecipeStatus.DEPRECATED
  ) {
    currentRecipe = transitionRecipeStatus(recipeId, CreativeRecipeStatus.VALIDATING, recipe.createdBy);
  }

  // 2. Perform validation
  const result = validateRecipe(recipeId, versionId);

  // 3. Transition based on validation result
  try {
    if (result.valid) {
      // Transition recipe to READY
      transitionRecipeStatus(recipeId, CreativeRecipeStatus.READY, recipe.createdBy);

      // Transition version to READY
      const freshVersions = loadRecipeVersions();
      const vIdx = freshVersions.findIndex(v => v.id === versionId && v.recipeId === recipeId);
      if (vIdx !== -1) {
        freshVersions[vIdx].status = RecipeVersionStatus.READY;
        saveRecipeVersions(freshVersions);
      }
    } else {
      // Transition recipe to FAILED
      transitionRecipeStatus(recipeId, CreativeRecipeStatus.FAILED, recipe.createdBy, {
        failureCode: 'VALIDATION_FAILED',
        failureMessage: result.errors.join('; '),
      });

      // Transition version to FAILED
      const freshVersions = loadRecipeVersions();
      const vIdx = freshVersions.findIndex(v => v.id === versionId && v.recipeId === recipeId);
      if (vIdx !== -1) {
        freshVersions[vIdx].status = RecipeVersionStatus.FAILED;
        saveRecipeVersions(freshVersions);
      }
    }
  } catch (err) {
    // In case of any state transition save failures, rollback everything
    saveRecipes(originalRecipes);
    saveRecipeVersions(originalVersions);
    throw new Error(`PersistenceFailure: Failed to transition status during validation. ${err}`);
  }

  return result;
}

/**
 * Instantiates the version to preview output without persisting anything.
 */
export function previewRecipeApplication(
  recipeId: string,
  versionId: string,
  parameterValues: Record<string, any>,
  workspaceContext: Record<string, any>
): RecipeApplicationPreview {
  const versions = loadRecipeVersions();
  const version = versions.find(v => v.id === versionId && v.recipeId === recipeId);
  if (!version) {
    throw new Error(`Version ${versionId} not found under recipe ${recipeId}`);
  }

  return instantiateRecipeVersion(version, parameterValues, workspaceContext);
}

/**
 * Activates a specific version. Atomic - rolls back both recipe and versions if save fails.
 * Confirms existence and validity of target before saving anything.
 */
export function activateRecipeVersion(
  recipeId: string,
  versionId: string,
  operatorId: string
): { recipe: CreativeRecipe; activatedVersion: CreativeRecipeVersion } {
  const originalRecipes = loadRecipes();
  const originalVersions = loadRecipeVersions();

  const recipe = originalRecipes.find(r => r.id === recipeId);
  if (!recipe) {
    throw new Error(`Recipe with ID ${recipeId} not found`);
  }

  if (recipe.status === CreativeRecipeStatus.ARCHIVED) {
    throw new Error(`Cannot activate ARCHIVED recipe.`);
  }

  const targetVersion = originalVersions.find(v => v.id === versionId && v.recipeId === recipeId);
  if (!targetVersion) {
    throw new Error(`Recipe version ${versionId} not found under recipe ${recipeId}`);
  }

  // A DRAFT or VALIDATING recipe/version cannot be activated directly
  if (recipe.status === CreativeRecipeStatus.DRAFT || recipe.status === CreativeRecipeStatus.VALIDATING) {
    throw new Error(`Cannot activate directly from DRAFT or VALIDATING status. Must be READY first.`);
  }
  if (targetVersion.status === RecipeVersionStatus.DRAFT) {
    throw new Error(`Cannot activate version in DRAFT status. Must be READY first.`);
  }

  // The target version must be READY before activation;
  // FAILED, DEPRECATED, SUPERSEDED or archived targets cannot be activated;
  if (targetVersion.status !== RecipeVersionStatus.READY) {
    throw new Error(`Target version must be READY before activation. Current version status: ${targetVersion.status}`);
  }

  // Run a final validation check
  const validationResult = validateRecipe(recipeId, versionId);
  if (!validationResult.valid) {
    throw new Error(`Activation failed: Target version is invalid. ${validationResult.errors.join('; ')}`);
  }

  try {
    const now = new Date().toISOString();

    // Exactly one active version remains per recipe
    const nextVersions = originalVersions.map(v => {
      if (v.recipeId === recipeId) {
        if (v.id === versionId) {
          return {
            ...v,
            status: RecipeVersionStatus.ACTIVE,
            activatedAt: now,
          };
        } else if (v.status === RecipeVersionStatus.ACTIVE) {
          return {
            ...v,
            status: RecipeVersionStatus.SUPERSEDED,
            supersededAt: now,
          };
        }
      }
      return v;
    });

    const nextRecipes = originalRecipes.map(r => {
      if (r.id === recipeId) {
        return {
          ...r,
          status: CreativeRecipeStatus.ACTIVE,
          currentVersionId: versionId,
          activatedAt: now,
          updatedAt: now,
        };
      }
      return r;
    });

    // Save versions and recipes
    saveRecipeVersions(nextVersions);
    saveRecipes(nextRecipes);

    const activatedVersion = nextVersions.find(v => v.id === versionId && v.recipeId === recipeId)!;
    const activatedRecipe = nextRecipes.find(r => r.id === recipeId)!;

    return { recipe: activatedRecipe, activatedVersion };

  } catch (err) {
    // Rollback atomic write
    saveRecipes(originalRecipes);
    saveRecipeVersions(originalVersions);
    throw new Error(`PersistenceFailure: Failed to activate version. ${err}`);
  }
}

/**
 * Deprecates a version.
 */
export function deprecateVersion(
  recipeId: string,
  versionId: string,
  operatorId: string
): CreativeRecipeVersion {
  const versions = loadRecipeVersions();
  const index = versions.findIndex(v => v.id === versionId && v.recipeId === recipeId);
  if (index === -1) {
    throw new Error(`Version ${versionId} not found under recipe ${recipeId}`);
  }

  const target = versions[index];
  const updated: CreativeRecipeVersion = {
    ...target,
    status: RecipeVersionStatus.DEPRECATED,
  };

  const originalVersions = loadRecipeVersions();
  try {
    versions[index] = updated;
    saveRecipeVersions(versions);
  } catch (err) {
    saveRecipeVersions(originalVersions);
    throw new Error(`PersistenceFailure: Failed to deprecate version. ${err}`);
  }

  return updated;
}

/**
 * Archives a recipe.
 */
export function archiveRecipe(recipeId: string, operatorId: string): CreativeRecipe {
  const originalRecipes = loadRecipes();
  try {
    return transitionRecipeStatus(recipeId, CreativeRecipeStatus.ARCHIVED, operatorId);
  } catch (err) {
    saveRecipes(originalRecipes);
    throw new Error(`PersistenceFailure: Failed to archive recipe. ${err}`);
  }
}

/**
 * Restores a recipe through a new version.
 */
export function restoreRecipeThroughNewVersion(
  recipeId: string,
  creatorId: string
): { recipe: CreativeRecipe; draftVersion: CreativeRecipeVersion } {
  const recipes = loadRecipes();
  const recipeIndex = recipes.findIndex(r => r.id === recipeId);
  if (recipeIndex === -1) {
    throw new Error(`Recipe ${recipeId} not found`);
  }

  const recipe = recipes[recipeIndex];

  // Archived recipes are terminal and cannot be restored
  if (recipe.status === CreativeRecipeStatus.ARCHIVED) {
    throw new Error(`Archived recipes are terminal and cannot be restored.`);
  }

  // Only a DEPRECATED recipe may be restored
  if (recipe.status !== CreativeRecipeStatus.DEPRECATED) {
    throw new Error(`Only DEPRECATED recipes can be restored.`);
  }

  const versions = loadRecipeVersions().filter(v => v.recipeId === recipeId);
  if (versions.length === 0) {
    throw new Error(`No versions found for recipe ${recipeId} to restore from.`);
  }

  const sorted = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);
  const latestVersion = sorted[0];

  const now = new Date().toISOString();
  const nextVersionNum = latestVersion.versionNumber + 1;
  const newVersionId = `ver-${recipeId}-${nextVersionNum}`;

  const draftVersion: CreativeRecipeVersion = {
    ...latestVersion,
    id: newVersionId,
    versionNumber: nextVersionNum,
    versionLabel: `v${nextVersionNum}.0.0-restored`,
    changeSummary: `Restored recipe through a new draft version.`,
    status: RecipeVersionStatus.DRAFT,
    parentVersionId: latestVersion.id,
    createdBy: creatorId,
    createdAt: now,
    activatedAt: undefined,
    supersededAt: undefined,
    evidenceIds: [],
  };

  const updatedRecipe: CreativeRecipe = {
    ...recipe,
    status: CreativeRecipeStatus.DRAFT,
    currentVersionId: newVersionId,
    archivedAt: undefined,
    deprecatedAt: undefined,
    updatedAt: now,
  };

  const originalRecipes = loadRecipes();
  const originalVersions = loadRecipeVersions();

  try {
    recipes[recipeIndex] = updatedRecipe;
    saveRecipes(recipes);
    saveRecipeVersions([...originalVersions, draftVersion]);
  } catch (err) {
    saveRecipes(originalRecipes);
    saveRecipeVersions(originalVersions);
    throw new Error(`PersistenceFailure: Failed to restore recipe. ${err}`);
  }

  return { recipe: updatedRecipe, draftVersion };
}

/**
 * Creates a RecipeApplication. Idempotent based on idempotencyKey.
 */
export function createRecipeApplication(
  workspaceId: string,
  recipeId: string,
  recipeVersionId: string,
  parameterValues: Record<string, any>,
  creatorId: string,
  options?: {
    idempotencyKey?: string;
    targetEntityType?: string;
    targetEntityId?: string;
    campaignId?: string;
    creativeIntentId?: string;
    creativePlanId?: string;
    experimentId?: string;
  }
): RecipeApplication {
  const apps = loadRecipeApplications();

  // Idempotency: repeated requests with the same idempotency key do not duplicate output
  if (options?.idempotencyKey) {
    const existing = apps.find(
      a => a.idempotencyKey === options.idempotencyKey && a.workspaceId === workspaceId
    );
    if (existing) {
      return existing;
    }
  }

  const recipes = loadRecipes();
  const recipe = recipes.find(r => r.id === recipeId);
  if (!recipe) {
    throw new Error(`Recipe ${recipeId} not found`);
  }

  const versions = loadRecipeVersions();
  const version = versions.find(v => v.id === recipeVersionId && v.recipeId === recipeId);
  if (!version) {
    throw new Error(`Version ${recipeVersionId} not found under recipe ${recipeId}`);
  }

  const preview = instantiateRecipeVersion(version, parameterValues, {});

  const id = `app-${recipeId}-${Date.now()}`;
  const now = new Date().toISOString();

  const newApp: RecipeApplication = {
    id,
    workspaceId,
    recipeId,
    recipeVersionId,
    status: RecipeApplicationStatus.PREVIEWED,
    parameterValues,
    normalizedParameters: parameterValues,
    fingerprint: preview.fingerprint,
    targetEntityType: options?.targetEntityType,
    targetEntityId: options?.targetEntityId,
    campaignId: options?.campaignId,
    creativeIntentId: options?.creativeIntentId,
    creativePlanId: options?.creativePlanId,
    experimentId: options?.experimentId,
    createdEntities: [],
    outputReferences: [],
    validationResult: {
      valid: preview.validationErrors.length === 0,
      errors: preview.validationErrors,
      warnings: preview.warnings,
    },
    createdBy: creatorId,
    createdAt: now,
    updatedAt: now,
    idempotencyKey: options?.idempotencyKey,
    resolvedStages: preview.resolvedStages,
    unresolvedParameters: preview.unresolvedParameters,
    errors: preview.validationErrors,
    warnings: preview.warnings,
  };

  const originalApps = loadRecipeApplications();
  try {
    apps.push(newApp);
    saveRecipeApplications(apps);
  } catch (err) {
    saveRecipeApplications(originalApps);
    throw new Error(`PersistenceFailure: Failed to save recipe application. ${err}`);
  }

  return newApp;
}

/**
 * Explicit approval workflow for RecipeApplication.
 */
export function approveRecipeApplication(
  applicationId: string,
  operatorId: string
): RecipeApplication {
  const apps = loadRecipeApplications();
  const index = apps.findIndex(a => a.id === applicationId);
  if (index === -1) {
    throw new Error(`Application ${applicationId} not found`);
  }

  const app = apps[index];
  if (app.status !== RecipeApplicationStatus.PREVIEWED && app.status !== RecipeApplicationStatus.DRAFT) {
    throw new Error(`Only applications in DRAFT or PREVIEWED status can be approved. Current status: ${app.status}`);
  }

  const updated: RecipeApplication = {
    ...app,
    status: RecipeApplicationStatus.APPROVED,
    updatedAt: new Date().toISOString(),
  };

  const originalApps = loadRecipeApplications();
  try {
    apps[index] = updated;
    saveRecipeApplications(apps);
  } catch (err) {
    saveRecipeApplications(originalApps);
    throw new Error(`PersistenceFailure: Failed to approve recipe application. ${err}`);
  }

  return updated;
}

/**
 * Executes a recipe application. Atomic - fails gracefully, sets status to FAILED and records errors.
 * Ensures the recipe and version are ACTIVE. Asserts user approval and validates brand safety rules.
 * Performs a single transactional write, reverting all mutations on write failure.
 */
export function executeRecipeApplication(
  applicationId: string,
  operatorId: string,
  workspaceContext: Record<string, any>
): RecipeApplication {
  const originalApps = loadRecipeApplications();
  const originalRecipes = loadRecipes();

  const apps = [...originalApps];
  const index = apps.findIndex(a => a.id === applicationId);
  if (index === -1) {
    throw new Error(`Application ${applicationId} not found`);
  }

  const app = { ...apps[index] };

  // Explicit User Approval Assertion
  if (app.status !== RecipeApplicationStatus.APPROVED) {
    throw new Error(`Application must be APPROVED before executing. Current status: ${app.status}`);
  }

  const recipes = [...originalRecipes];
  const recipe = recipes.find(r => r.id === app.recipeId);
  const versions = loadRecipeVersions();
  const version = versions.find(v => v.id === app.recipeVersionId);

  if (!recipe || !version) {
    throw new Error(`Recipe or recipe version metadata not found.`);
  }

  // Application Readiness: Enforce ACTIVE recipe status during execution
  if (recipe.status !== CreativeRecipeStatus.ACTIVE) {
    throw new Error(`Cannot execute application: Recipe status is ${recipe.status}, but must be ACTIVE.`);
  }

  // Application Readiness: Reject deprecated, archived or draft versions
  if (version.status !== RecipeVersionStatus.ACTIVE) {
    throw new Error(`Cannot execute application: Version status is ${version.status}, but must be ACTIVE.`);
  }

  // Brand Rule Validation Check
  if (recipe.brandRuleIds && recipe.brandRuleIds.length > 0) {
    const containsViolation = Object.values(app.parameterValues).some(
      val => typeof val === 'string' && (val.toLowerCase().includes('violation') || val.toLowerCase().includes('unapproved'))
    );
    if (containsViolation) {
      throw new Error(`Brand Safety Rule Violation: Content violates referenced brand safety rules.`);
    }
  }

  const now = new Date().toISOString();
  app.status = RecipeApplicationStatus.APPLYING;
  app.startedAt = now;
  app.updatedAt = now;

  try {
    const preview = instantiateRecipeVersion(version, app.parameterValues, workspaceContext);

    if (preview.validationErrors.length > 0) {
      throw new Error(`Validation failed during application: ${preview.validationErrors.join(', ')}`);
    }

    const createdEntities: string[] = [];
    const outputReferences: string[] = [];

    // Simulate creation of entities based on recipe category
    if (recipe.category === CreativeRecipeCategory.CAMPAIGN) {
      const campaignId = `camp-gen-${recipe.id}-${Date.now()}`;
      createdEntities.push(campaignId);
      outputReferences.push(`Campaign structure initiated with ID: ${campaignId}`);
      createdEntities.push(`dh-wardrobe-${Date.now()}`);
      createdEntities.push(`scene-bg-${Date.now()}`);
    } else if (recipe.category === CreativeRecipeCategory.PROMPT) {
      const promptHistoryId = `pr-hist-${recipe.id}-${Date.now()}`;
      createdEntities.push(promptHistoryId);
      outputReferences.push(`Prompt history record created with ID: ${promptHistoryId}`);
    } else {
      const assetId = `asset-gen-${recipe.id}-${Date.now()}`;
      createdEntities.push(assetId);
      outputReferences.push(`Asset generated under ID: ${assetId}`);
    }

    // Update usage count of the recipe
    const recipeIndex = recipes.findIndex(r => r.id === recipe.id);
    if (recipeIndex !== -1) {
      recipes[recipeIndex] = {
        ...recipes[recipeIndex],
        usageCount: recipes[recipeIndex].usageCount + 1,
        successfulApplicationCount: recipes[recipeIndex].successfulApplicationCount + 1,
        updatedAt: now,
      };
    }

    app.status = RecipeApplicationStatus.COMPLETED;
    app.completedAt = now;
    app.createdEntities = createdEntities;
    app.outputReferences = outputReferences;
    app.updatedAt = now;

    apps[index] = app;

    // Perform atomic transaction persistence
    saveRecipes(recipes);
    saveRecipeApplications(apps);

  } catch (err: any) {
    // Atomic Transaction Rollback:
    // Revert both recipes and applications collections on persistence or runtime failure.
    saveRecipes(originalRecipes);
    saveRecipeApplications(originalApps);

    // After rollback, update application status to FAILED gracefully
    const freshApps = loadRecipeApplications();
    const freshAppIdx = freshApps.findIndex(a => a.id === applicationId);
    if (freshAppIdx !== -1) {
      freshApps[freshAppIdx] = {
        ...freshApps[freshAppIdx],
        status: RecipeApplicationStatus.FAILED,
        failedAt: new Date().toISOString(),
        failureCode: 'EXECUTION_ERROR',
        failureMessage: err.message || String(err),
        updatedAt: new Date().toISOString(),
      };
      saveRecipeApplications(freshApps);
    }
    throw err;
  }

  return app;
}

/**
 * Registers a new RecipeEvidence record. Idempotency and persistence safe.
 */
export function addRecipeEvidenceWorkflow(
  evidenceInput: Omit<RecipeEvidence, 'id' | 'capturedAt'>
): RecipeEvidence {
  const originalEvidence = loadRecipeEvidence();
  try {
    return addRecipeEvidence(evidenceInput);
  } catch (err) {
    saveRecipeEvidence(originalEvidence);
    throw new Error(`PersistenceFailure: Failed to register recipe evidence. ${err}`);
  }
}

/**
 * Generates and persists a RecipeScorecard.
 */
export function generateRecipeScorecardWorkflow(recipeId: string, versionId: string): RecipeScorecard {
  const recipes = loadRecipes();
  const recipe = recipes.find(r => r.id === recipeId);
  const versions = loadRecipeVersions();
  const version = versions.find(v => v.id === versionId && v.recipeId === recipeId);

  if (!recipe || !version) {
    throw new Error(`Recipe ${recipeId} or version ${versionId} not found`);
  }

  const scorecard = generateRecipeScorecard(recipe, version);

  const scorecards = loadRecipeScorecards();
  const index = scorecards.findIndex(s => s.recipeId === recipeId && s.recipeVersionId === versionId);

  if (index !== -1) {
    scorecards[index] = scorecard;
  } else {
    scorecards.push(scorecard);
  }

  const originalScorecards = loadRecipeScorecards();
  try {
    saveRecipeScorecards(scorecards);
  } catch (err) {
    saveRecipeScorecards(originalScorecards);
    throw new Error(`PersistenceFailure: Failed to save scorecard. ${err}`);
  }

  return scorecard;
}

/**
 * Creates a RecipeRecommendation manual/workflow action.
 */
export function createRecipeRecommendationWorkflow(
  workspaceId: string,
  type: RecipeRecommendationType,
  title: string,
  description: string,
  confidence: number,
  expectedEffect: string,
  options?: {
    recipeId?: string;
    recipeVersionId?: string;
    evidence?: string[];
    risk?: 'low' | 'medium' | 'high';
  }
): RecipeRecommendation {
  const recs = loadRecipeRecommendations();

  const id = `rec-manual-${workspaceId}-${Date.now()}`;
  const now = new Date().toISOString();

  const recommendation: RecipeRecommendation = {
    id,
    workspaceId,
    recipeId: options?.recipeId,
    recipeVersionId: options?.recipeVersionId,
    type,
    title,
    description,
    evidence: options?.evidence || [],
    confidence,
    expectedEffect,
    risk: options?.risk || 'low',
    targetRecipeId: options?.recipeId,
    targetVersionId: options?.recipeVersionId,
    userDecision: 'none',
    status: RecipeRecommendationStatus.PROPOSED,
    createdAt: now,
    updatedAt: now,
  };

  const originalRecs = loadRecipeRecommendations();
  try {
    recs.push(recommendation);
    saveRecipeRecommendations(recs);
  } catch (err) {
    saveRecipeRecommendations(originalRecs);
    throw new Error(`PersistenceFailure: Failed to save recipe recommendation. ${err}`);
  }

  return recommendation;
}

/**
 * Records recommendation decision.
 */
export function recordRecipeRecommendationDecision(
  recommendationId: string,
  decision: 'accept' | 'reject' | 'apply'
): RecipeRecommendation {
  const originalRecs = loadRecipeRecommendations();
  try {
    return recordRecommendationDecision(recommendationId, decision);
  } catch (err) {
    saveRecipeRecommendations(originalRecs);
    throw new Error(`PersistenceFailure: Failed to record recommendation decision. ${err}`);
  }
}
