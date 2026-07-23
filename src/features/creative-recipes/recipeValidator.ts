import {
  CreativeRecipe,
  CreativeRecipeVersion,
  RecipeStage,
  RecipeParameter,
  CreativeRecipeStatus,
  RecipeVersionStatus,
  RecipeSourceType,
} from './types';
import { loadRecipes, loadRecipeVersions, loadRecipeEvidence } from './recipeStorage';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  evidenceLevel: 'untested' | 'preliminary' | 'supported' | 'strong' | 'validated';
  confidence: number;
  recommendedCorrections: string[];
}

const ALLOWED_PLACEHOLDERS = [
  'product.name',
  'digitalHuman.name',
  'campaign.objective',
  'platform',
  'hook',
  'cta',
  'scene.description'
];

/**
 * Validates placeholders inside templates. Returns unknown placeholders.
 */
export function findUnknownPlaceholders(template: string): string[] {
  const matches = template.match(/\{\{([^}]+)\}\}/g) || [];
  const unknowns: string[] = [];
  for (const match of matches) {
    const key = match.replace(/\{\{|\}\}/g, '').trim();
    if (!ALLOWED_PLACEHOLDERS.includes(key)) {
      unknowns.push(key);
    }
  }
  return unknowns;
}

/**
 * Validates stage dependencies in a RecipeStructure to ensure it forms a valid Directed Acyclic Graph (DAG).
 * Returns cycle description, missing references, or duplicates if found.
 */
export function validateStageGraph(stages: RecipeStage[]): {
  isValid: boolean;
  error?: string;
} {
  const stageIds = new Set<string>();
  const duplicates = new Set<string>();

  for (const stage of stages) {
    if (stageIds.has(stage.id)) {
      duplicates.add(stage.id);
    }
    stageIds.add(stage.id);
  }

  if (duplicates.size > 0) {
    return {
      isValid: false,
      error: `Duplicated stage IDs found: ${Array.from(duplicates).join(', ')}`,
    };
  }

  // Check for missing stage references in dependencies
  for (const stage of stages) {
    for (const dep of stage.dependencies) {
      if (!stageIds.has(dep)) {
        return {
          isValid: false,
          error: `Stage '${stage.id}' depends on non-existent stage '${dep}'`,
        };
      }
    }
  }

  // Cycle detection using DFS
  // status map: 0 = unvisited, 1 = visiting, 2 = visited
  const visitStatus = new Map<string, number>();
  for (const id of stageIds) {
    visitStatus.set(id, 0);
  }

  // Build adjacency list (dependencies list stage.dependencies. Thus a dependency dep -> stage)
  // We can traverse backward from stages through their dependencies, or forward. Let's traverse stage dependencies.
  const hasCycle = (currId: string): boolean => {
    visitStatus.set(currId, 1); // Mark as visiting

    const stage = stages.find(s => s.id === currId);
    if (stage) {
      for (const dep of stage.dependencies) {
        const depStatus = visitStatus.get(dep) || 0;
        if (depStatus === 1) {
          return true; // Cycle detected!
        } else if (depStatus === 0) {
          if (hasCycle(dep)) return true;
        }
      }
    }

    visitStatus.set(currId, 2); // Mark as visited
    return false;
  };

  for (const id of stageIds) {
    if (visitStatus.get(id) === 0) {
      if (hasCycle(id)) {
        return {
          isValid: false,
          error: 'Circular stage dependencies detected in structural graph.',
        };
      }
    }
  }

  return { isValid: true };
}

/**
 * Comprehensive Recipe Validation Engine
 */
export function validateRecipe(recipeId: string, versionId?: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const recommendedCorrections: string[] = [];

  const recipes = loadRecipes();
  const recipe = recipes.find(r => r.id === recipeId);

  if (!recipe) {
    return {
      valid: false,
      errors: [`Recipe ${recipeId} does not exist.`],
      warnings: [],
      evidenceLevel: 'untested',
      confidence: 0,
      recommendedCorrections: ['Create the recipe first.'],
    };
  }

  const versions = loadRecipeVersions();
  const recipeVersions = versions.filter(v => v.recipeId === recipeId);

  // If no versionId specified, default to currentVersionId or latest version
  let targetVersionId = versionId || recipe.currentVersionId;
  if (!targetVersionId && recipeVersions.length > 0) {
    // Pick the highest version number
    const sorted = [...recipeVersions].sort((a, b) => b.versionNumber - a.versionNumber);
    targetVersionId = sorted[0].id;
  }

  const version = recipeVersions.find(v => v.id === targetVersionId);

  if (!version) {
    errors.push(`No valid version found for recipe ${recipeId}`);
    return {
      valid: false,
      errors,
      warnings,
      evidenceLevel: 'untested',
      confidence: 0,
      recommendedCorrections: ['Create a draft version of the recipe.'],
    };
  }

  // 1. Metadata size limits check
  const serializedRecipe = JSON.stringify(recipe);
  const serializedVersion = JSON.stringify(version);
  if (serializedRecipe.length > 50000 || serializedVersion.length > 50000) {
    errors.push('Metadata size limit exceeded. Recipe or version properties are too large.');
    recommendedCorrections.push('Reduce the size of static descriptions or templates.');
  }

  // 2. Validate Stage Graph (DAG)
  const graphResult = validateStageGraph(version.structure.stages);
  if (!graphResult.isValid) {
    errors.push(graphResult.error || 'Invalid stage dependency graph');
    recommendedCorrections.push('Repair circular dependencies or references in structural stages.');
  }

  // 3. Placeholders checks
  const unknownSet = new Set<string>();
  for (const stage of version.structure.stages) {
    const unknowns = findUnknownPlaceholders(stage.template);
    unknowns.forEach(u => unknownSet.add(u));
  }
  if (unknownSet.size > 0) {
    errors.push(`Unknown or unsupported placeholders detected: ${Array.from(unknownSet).join(', ')}`);
    recommendedCorrections.push('Use only approved placeholders (e.g. {{product.name}}, {{hook}}).');
  }

  // 4. Parameter checks & Circular parameter bindings
  const paramKeys = new Set(version.parameters.map(p => p.key));
  for (const stage of version.structure.stages) {
    for (const [bindingKey, paramKey] of Object.entries(stage.parameterBindings)) {
      if (!paramKeys.has(paramKey)) {
        errors.push(`Stage '${stage.id}' binds to non-existent parameter key '${paramKey}'`);
        recommendedCorrections.push(`Declare parameter key '${paramKey}' in the recipe version parameter list.`);
      }
    }
  }

  // Check circular parameter bindings
  const parameterBindings = version.parameters.map(p => p.sourceBinding).filter(Boolean) as string[];
  const visitedBindings = new Set<string>();
  for (const binding of parameterBindings) {
    if (visitedBindings.has(binding)) {
      errors.push(`Circular binding detected in recipe parameters on binding key '${binding}'`);
      recommendedCorrections.push('Ensure parameter bindings are unique, distinct and hierarchical.');
    }
    visitedBindings.add(binding);
  }

  // 5. Lifecycle Readiness Check
  if (recipe.status === CreativeRecipeStatus.ACTIVE && version.status !== RecipeVersionStatus.ACTIVE) {
    warnings.push(`Recipe is ACTIVE but selected version ${version.id} status is ${version.status}.`);
    recommendedCorrections.push(`Activate the version ${version.id} explicitly.`);
  }

  // 6. Platform, Provider and Brand Rules Checks
  if (version.compatiblePlatforms.length === 0) {
    warnings.push('No compatible platforms are declared for this recipe.');
    recommendedCorrections.push('Add target platform tags (e.g. "tiktok", "instagram") to broaden relevance.');
  }

  if (recipe.brandRuleIds.length === 0) {
    warnings.push('Recipe does not reference any brand safety rules.');
  }

  // 7. Evidence evaluation
  const allEvidence = loadRecipeEvidence().filter(e => e.recipeId === recipeId);
  const evidenceCount = allEvidence.length;
  
  let evidenceLevel: 'untested' | 'preliminary' | 'supported' | 'strong' | 'validated' = 'untested';
  let confidence = recipe.confidence;

  if (evidenceCount === 0) {
    evidenceLevel = 'untested';
    confidence = 0;
  } else if (evidenceCount < 3) {
    evidenceLevel = 'preliminary';
    confidence = 30;
  } else if (evidenceCount < 5) {
    evidenceLevel = 'supported';
    confidence = 50;
  } else if (evidenceCount < 10) {
    evidenceLevel = 'strong';
    confidence = 75;
  } else {
    evidenceLevel = 'validated';
    confidence = 90;
  }

  if (recipe.sourceType === RecipeSourceType.MANUAL && evidenceCount === 0) {
    // "Do not label a recipe validated solely because it was manually created."
    evidenceLevel = 'untested';
    confidence = 0;
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    evidenceLevel,
    confidence,
    recommendedCorrections,
  };
}
