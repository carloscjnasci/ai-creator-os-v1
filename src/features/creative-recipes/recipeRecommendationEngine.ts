import { RecipeRecommendation, RecipeRecommendationType, RecipeRecommendationStatus } from './types';
import { loadRecipes, loadRecipeVersions, loadRecipeRecommendations, saveRecipeRecommendations } from './recipeStorage';
import { loadAnalyses } from '../experimentation/experimentStorage';
import { AnalysisResultStatus } from '../experimentation/types';

/**
 * Generates evidence-based recommendations based on existing recipes, versions, and experiments.
 * Recommendations are placed in proposed status and do not mutate recipes automatically.
 */
export function generateRecipeRecommendations(workspaceId: string): RecipeRecommendation[] {
  const recommendations: RecipeRecommendation[] = [];
  const recipes = loadRecipes().filter(r => r.workspaceId === workspaceId);
  const versions = loadRecipeVersions();
  const analyses = loadAnalyses();

  let recIndex = 1;
  const nextId = () => `rec-${workspaceId}-${Date.now()}-${recIndex++}`;
  const now = new Date().toISOString();

  // 1. Convert experiment winner into recipe
  for (const analysis of analyses) {
    if (analysis.resultStatus === AnalysisResultStatus.WINNER && analysis.winnerVariantId) {
      // Check if we already have a recipe derived from this experiment
      const alreadyDerived = recipes.some(r => r.sourceEntityIds.includes(analysis.experimentId));
      if (!alreadyDerived) {
        recommendations.push({
          id: nextId(),
          workspaceId,
          type: RecipeRecommendationType.CONVERT_WINNER,
          title: 'Convert Experiment Winner into Creative Recipe',
          description: `A/B Test analysis for experiment '${analysis.experimentId}' completed with a clear winner variant. Convert this winning structure into a reusable, parameterized recipe.`,
          evidence: [
            `Experiment ID: ${analysis.experimentId}`,
            `Winner Variant ID: ${analysis.winnerVariantId}`,
            `Primary Metric: ${analysis.primaryMetric}`,
          ],
          confidence: Math.round((analysis.confidenceLevel || 0.95) * 100),
          expectedEffect: 'Establish a proven creative playbook that can repeat this lift in subsequent campaigns.',
          risk: 'low',
          targetRecipeId: undefined,
          targetVersionId: undefined,
          userDecision: 'none',
          status: RecipeRecommendationStatus.PROPOSED,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  // 2. Platform adaptation / Collect evidence
  for (const recipe of recipes) {
    const recipeVersions = versions.filter(v => v.recipeId === recipe.id);
    const activeVersion = recipeVersions.find(v => v.id === recipe.currentVersionId || v.status === 'active');

    // 2.1 Collect more evidence
    if (recipe.usageCount === 0) {
      recommendations.push({
        id: nextId(),
        workspaceId,
        recipeId: recipe.id,
        type: RecipeRecommendationType.COLLECT_EVIDENCE,
        title: `Collect Performance Evidence for ${recipe.name}`,
        description: `Recipe '${recipe.name}' has no recorded usage or evaluations. Run a pilot campaign or an A/B test to log baseline observations.`,
        evidence: [`Recipe '${recipe.id}' usageCount is 0`],
        confidence: 90,
        expectedEffect: 'Increase recipe confidence level from untested to preliminary.',
        risk: 'low',
        targetRecipeId: recipe.id,
        userDecision: 'none',
        status: RecipeRecommendationStatus.PROPOSED,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 2.2 Adapt recipe to another platform
    if (activeVersion && activeVersion.compatiblePlatforms.length === 0) {
      recommendations.push({
        id: nextId(),
        workspaceId,
        recipeId: recipe.id,
        recipeVersionId: activeVersion.id,
        type: RecipeRecommendationType.ADAPT_PLATFORM,
        title: `Adapt ${recipe.name} to Target Platforms`,
        description: `No compatible platforms are defined for version '${activeVersion.id}'. Define layout specifications and rules for TikTok, YouTube, or Meta.`,
        evidence: [`Version '${activeVersion.id}' compatiblePlatforms list is empty`],
        confidence: 80,
        expectedEffect: 'Broaden publishing compatibility and avoid cross-platform publishing mismatches.',
        risk: 'low',
        targetRecipeId: recipe.id,
        targetVersionId: activeVersion.id,
        userDecision: 'none',
        status: RecipeRecommendationStatus.PROPOSED,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 2.3 Create follow-up experiment for weak recipes
    if (recipe.usageCount >= 3 && recipe.averageObservedScore < 40) {
      recommendations.push({
        id: nextId(),
        workspaceId,
        recipeId: recipe.id,
        type: RecipeRecommendationType.CREATE_FOLLOW_UP_EXPERIMENT,
        title: `Optimize Low-Performing Recipe: ${recipe.name}`,
        description: `The observed average score for '${recipe.name}' is ${recipe.averageObservedScore}/100. Design an optimization experiment with alternative hooks or CTAs.`,
        evidence: [
          `Average observed score is ${recipe.averageObservedScore}`,
          `Total usage count is ${recipe.usageCount}`,
        ],
        confidence: 70,
        expectedEffect: 'Identify high-impact variants to replace the low-performing default parameters.',
        risk: 'medium',
        targetRecipeId: recipe.id,
        userDecision: 'none',
        status: RecipeRecommendationStatus.PROPOSED,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // Save the recommendations
  const existing = loadRecipeRecommendations();
  // Append new unique recommendations (to avoid endless duplicates)
  const uniqueRecs = [...existing];
  for (const newRec of recommendations) {
    const isDup = existing.some(
      r => r.type === newRec.type && r.targetRecipeId === newRec.targetRecipeId && r.status === 'proposed'
    );
    if (!isDup) {
      uniqueRecs.push(newRec);
    }
  }
  saveRecipeRecommendations(uniqueRecs);

  return recommendations;
}

/**
 * Transitions a recommendation status following a user's decision.
 * Does NOT mutate the underlying recipe automatically.
 */
export function recordRecommendationDecision(
  recommendationId: string,
  decision: 'accept' | 'reject' | 'apply'
): RecipeRecommendation {
  const recs = loadRecipeRecommendations();
  const index = recs.findIndex(r => r.id === recommendationId);

  if (index === -1) {
    throw new Error(`Recommendation with ID ${recommendationId} not found`);
  }

  const rec = recs[index];
  let status = RecipeRecommendationStatus.PROPOSED;

  if (decision === 'accept') {
    status = RecipeRecommendationStatus.ACCEPTED;
  } else if (decision === 'reject') {
    status = RecipeRecommendationStatus.REJECTED;
  } else if (decision === 'apply') {
    status = RecipeRecommendationStatus.APPLIED;
  }

  const updated: RecipeRecommendation = {
    ...rec,
    userDecision: decision,
    status,
    updatedAt: new Date().toISOString(),
  };

  recs[index] = updated;
  saveRecipeRecommendations(recs);
  return updated;
}
