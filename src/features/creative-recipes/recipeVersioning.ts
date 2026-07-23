import { CreativeRecipeVersion, RecipeVersionStatus, CreativeRecipeStatus, CreativeRecipe } from './types';
import { loadRecipeVersions, saveRecipeVersions, loadRecipes, saveRecipes, loadRecipeApplications } from './recipeStorage';
import { transitionRecipeStatus } from './recipeLifecycle';

/**
 * Deterministically creates a new version draft for a recipe.
 * Increments the version number sequentially.
 */
export function createNewVersionDraft(
  recipeId: string,
  parentVersionId: string | undefined,
  creatorId: string,
  options?: {
    versionLabel?: string;
    changeSummary?: string;
    structure?: any;
    parameters?: any[];
    constraints?: Record<string, any>;
    outputContract?: Record<string, any>;
    validationRules?: Record<string, any>;
    compatiblePlatforms?: string[];
    compatibleModels?: string[];
  }
): CreativeRecipeVersion {
  const versions = loadRecipeVersions();
  const recipeVersions = versions.filter(v => v.recipeId === recipeId);

  let nextVersionNumber = 1;
  if (parentVersionId) {
    const parent = recipeVersions.find(v => v.id === parentVersionId);
    if (parent) {
      nextVersionNumber = parent.versionNumber + 1;
    }
  } else if (recipeVersions.length > 0) {
    const maxVal = Math.max(...recipeVersions.map(v => v.versionNumber));
    nextVersionNumber = maxVal + 1;
  }

  const id = `ver-${recipeId}-${nextVersionNumber}`;
  const now = new Date().toISOString();

  const newVersion: CreativeRecipeVersion = {
    id,
    recipeId,
    versionNumber: nextVersionNumber,
    versionLabel: options?.versionLabel || `v${nextVersionNumber}.0.0-draft`,
    changeSummary: options?.changeSummary || 'Initial draft version created.',
    status: RecipeVersionStatus.DRAFT,
    structure: options?.structure || { stages: [] },
    parameters: options?.parameters || [],
    constraints: options?.constraints || {},
    outputContract: options?.outputContract || {},
    validationRules: options?.validationRules || {},
    compatiblePlatforms: options?.compatiblePlatforms || [],
    compatibleModels: options?.compatibleModels || [],
    evidenceIds: [],
    parentVersionId,
    createdBy: creatorId,
    createdAt: now,
  };

  versions.push(newVersion);
  saveRecipeVersions(versions);
  return newVersion;
}

/**
 * Activates a specific version. This action:
 * 1. Sets target version status to ACTIVE (and sets activatedAt).
 * 2. Supersedes the previous active version (setting status to SUPERSEDED and setting supersededAt).
 * 3. Updates the recipe's currentVersionId and sets its status to ACTIVE.
 */
export function activateVersion(
  recipeId: string,
  versionId: string,
  operatorId: string
): { recipe: CreativeRecipe; activatedVersion: CreativeRecipeVersion } {
  const versions = loadRecipeVersions();
  const recipeVersions = versions.filter(v => v.recipeId === recipeId);
  const targetVersionIndex = versions.findIndex(v => v.id === versionId && v.recipeId === recipeId);

  if (targetVersionIndex === -1) {
    throw new Error(`Recipe version ${versionId} not found under recipe ${recipeId}`);
  }

  const targetVersion = versions[targetVersionIndex];
  if (targetVersion.status === RecipeVersionStatus.FAILED) {
    throw new Error(`Failed activation must not supersede the current active version. Version status is FAILED.`);
  }

  const now = new Date().toISOString();

  // Supersede previous active versions
  for (let i = 0; i < versions.length; i++) {
    if (versions[i].recipeId === recipeId && versions[i].status === RecipeVersionStatus.ACTIVE && versions[i].id !== versionId) {
      versions[i] = {
        ...versions[i],
        status: RecipeVersionStatus.SUPERSEDED,
        supersededAt: now,
      };
    }
  }

  // Activate target
  const activatedVersion: CreativeRecipeVersion = {
    ...targetVersion,
    status: RecipeVersionStatus.ACTIVE,
    activatedAt: now,
  };
  versions[targetVersionIndex] = activatedVersion;

  // Save all versions (previous ones were immutable except for the status state transition)
  saveRecipeVersions(versions);

  // Update recipe
  const recipes = loadRecipes();
  const recipeIndex = recipes.findIndex(r => r.id === recipeId);
  if (recipeIndex === -1) {
    throw new Error(`Recipe with ID ${recipeId} not found`);
  }

  const recipe = recipes[recipeIndex];
  const updatedRecipe: CreativeRecipe = {
    ...recipe,
    status: CreativeRecipeStatus.ACTIVE,
    currentVersionId: versionId,
    activatedAt: now,
    updatedAt: now,
  };
  recipes[recipeIndex] = updatedRecipe;
  saveRecipes(recipes);

  return { recipe: updatedRecipe, activatedVersion };
}

/**
 * Edits a version. If it's already active, editing spawns a brand new draft version.
 * If it's a draft, it allows inline modification since draft isn't frozen yet.
 */
export function editVersion(
  recipeId: string,
  versionId: string,
  updates: Partial<Omit<CreativeRecipeVersion, 'id' | 'recipeId' | 'versionNumber' | 'status' | 'createdAt'>>,
  operatorId: string
): CreativeRecipeVersion {
  const versions = loadRecipeVersions();
  const index = versions.findIndex(v => v.id === versionId && v.recipeId === recipeId);

  if (index === -1) {
    throw new Error(`Recipe version ${versionId} not found`);
  }

  const target = versions[index];

  if (target.status === RecipeVersionStatus.ACTIVE) {
    // Spawn a new draft version from this active one
    return createNewVersionDraft(recipeId, target.id, operatorId, {
      versionLabel: updates.versionLabel || `v${target.versionNumber + 1}.0.0-draft`,
      changeSummary: updates.changeSummary || `Derived from active version ${target.id}`,
      structure: updates.structure || target.structure,
      parameters: updates.parameters || target.parameters,
      constraints: updates.constraints || target.constraints,
      outputContract: updates.outputContract || target.outputContract,
      validationRules: updates.validationRules || target.validationRules,
      compatiblePlatforms: updates.compatiblePlatforms || target.compatiblePlatforms,
      compatibleModels: updates.compatibleModels || target.compatibleModels,
    });
  }

  // Inline edit if it's draft or other editable state
  const updated: CreativeRecipeVersion = {
    ...target,
    ...updates,
    updatedAt: new Date().toISOString(),
  } as any;

  versions[index] = updated;
  saveRecipeVersions(versions);
  return updated;
}

/**
 * Deletes a recipe version.
 * Version deletion is not allowed after it has been applied.
 */
export function deleteVersion(recipeId: string, versionId: string): void {
  const applications = loadRecipeApplications();
  const hasBeenApplied = applications.some(app => app.recipeVersionId === versionId);

  if (hasBeenApplied) {
    throw new Error(`Version deletion is not allowed after it has been applied.`);
  }

  const versions = loadRecipeVersions();
  const filtered = versions.filter(v => !(v.id === versionId && v.recipeId === recipeId));

  if (filtered.length === versions.length) {
    throw new Error(`Recipe version ${versionId} not found`);
  }

  saveRecipeVersions(filtered);
}
