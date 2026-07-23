import { CreativeRecipe, CreativeRecipeStatus } from './types';
import { loadRecipes, saveRecipes } from './recipeStorage';

/**
 * Validates whether a state transition for a CreativeRecipe is allowed.
 */
export function isValidRecipeTransition(from: CreativeRecipeStatus, to: CreativeRecipeStatus): boolean {
  if (from === CreativeRecipeStatus.ARCHIVED) {
    return false; // Archived is terminal
  }
  if (from === to) {
    return true; // No-op is always valid
  }

  switch (from) {
    case CreativeRecipeStatus.DRAFT:
      return [CreativeRecipeStatus.VALIDATING, CreativeRecipeStatus.ARCHIVED].includes(to);

    case CreativeRecipeStatus.VALIDATING:
      return [CreativeRecipeStatus.READY, CreativeRecipeStatus.FAILED, CreativeRecipeStatus.DRAFT, CreativeRecipeStatus.ARCHIVED].includes(to);

    case CreativeRecipeStatus.READY:
      return [CreativeRecipeStatus.ACTIVE, CreativeRecipeStatus.DEPRECATED, CreativeRecipeStatus.ARCHIVED].includes(to);

    case CreativeRecipeStatus.ACTIVE:
      return [CreativeRecipeStatus.DEPRECATED, CreativeRecipeStatus.ARCHIVED].includes(to);

    case CreativeRecipeStatus.DEPRECATED:
      return [CreativeRecipeStatus.ACTIVE, CreativeRecipeStatus.ARCHIVED, CreativeRecipeStatus.DRAFT].includes(to);

    case CreativeRecipeStatus.FAILED:
      return [CreativeRecipeStatus.DRAFT, CreativeRecipeStatus.ARCHIVED].includes(to);

    default:
      return false;
  }
}

/**
 * Executes a state transition for a CreativeRecipe, updating appropriate timestamps.
 * Returns the updated recipe, saving to storage.
 */
export function transitionRecipeStatus(
  recipeId: string,
  newStatus: CreativeRecipeStatus,
  operatorId: string,
  options?: { failureCode?: string; failureMessage?: string }
): CreativeRecipe {
  const recipes = loadRecipes();
  const recipeIndex = recipes.findIndex(r => r.id === recipeId);
  if (recipeIndex === -1) {
    throw new Error(`Recipe with ID ${recipeId} not found`);
  }

  const recipe = recipes[recipeIndex];
  if (!isValidRecipeTransition(recipe.status, newStatus)) {
    throw new Error(`Invalid transition from ${recipe.status} to ${newStatus}`);
  }

  const now = new Date().toISOString();
  const updated: CreativeRecipe = {
    ...recipe,
    status: newStatus,
    updatedAt: now,
  };

  if (newStatus === CreativeRecipeStatus.ACTIVE) {
    updated.activatedAt = now;
  } else if (newStatus === CreativeRecipeStatus.DEPRECATED) {
    updated.deprecatedAt = now;
  } else if (newStatus === CreativeRecipeStatus.ARCHIVED) {
    updated.archivedAt = now;
  } else if (newStatus === CreativeRecipeStatus.FAILED) {
    updated.failureCode = options?.failureCode;
    updated.failureMessage = options?.failureMessage;
  }

  recipes[recipeIndex] = updated;
  saveRecipes(recipes);
  return updated;
}
