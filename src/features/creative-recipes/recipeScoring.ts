import { CreativeRecipe, CreativeRecipeVersion, RecipeScorecard } from './types';
import { loadRecipeEvidence, saveRecipeScorecards } from './recipeStorage';

/**
 * Deterministically generates a RecipeScorecard for a given recipe and version.
 * Clamps all dimension scores strictly between 0 and 100.
 * Does not treat absent evidence as successful evidence.
 */
export function generateRecipeScorecard(
  recipe: CreativeRecipe,
  version: CreativeRecipeVersion
): RecipeScorecard {
  const allEvidence = loadRecipeEvidence().filter(e => e.recipeId === recipe.id);
  const limitations: string[] = [];

  // 1. Evidence Strength
  let evidenceStrength = 0;
  if (allEvidence.length === 0) {
    evidenceStrength = 0;
    limitations.push('Absent evidence: Recipe has no registered performance evidence.');
  } else {
    // Score based on count of evidence and average confidence
    const avgConfidence = allEvidence.reduce((acc, e) => acc + e.confidence, 0) / allEvidence.length;
    evidenceStrength = Math.min(100, Math.round((allEvidence.length * 15) + (avgConfidence * 50)));
  }

  // 2. Reproducibility
  let reproducibility = 10;
  if (allEvidence.length > 0) {
    const totalSample = allEvidence.reduce((acc, e) => acc + e.sampleSize, 0);
    if (totalSample > 5000) {
      reproducibility = 95;
    } else if (totalSample > 1000) {
      reproducibility = 75;
    } else {
      reproducibility = 40;
      limitations.push('Limited sample size across collected evidence.');
    }
  } else {
    limitations.push('Reproducibility cannot be verified without performance evidence.');
  }

  // 3. Platform Fit
  const platformFit = version.compatiblePlatforms.length > 0 ? 90 : 30;
  if (version.compatiblePlatforms.length === 0) {
    limitations.push('No compatible platforms defined.');
  }

  // 4. Brand Fit
  const brandFit = recipe.brandRuleIds.length > 0 ? 95 : 50;
  if (recipe.brandRuleIds.length === 0) {
    limitations.push('No brand rules linked. Brand safety is unverified.');
  }

  // 5. Parameter Completeness
  let parameterCompleteness = 100;
  if (version.parameters.length === 0) {
    parameterCompleteness = 50;
    limitations.push('No parameters specified in template structure.');
  } else {
    const incompleteCount = version.parameters.filter(p => p.required && p.defaultValue === undefined).length;
    parameterCompleteness = Math.max(0, 100 - (incompleteCount * 20));
  }

  // 6. Historical Performance
  let historicalPerformance = 0;
  if (allEvidence.length > 0) {
    const positiveLifts = allEvidence.filter(e => e.relativeLift > 0).length;
    historicalPerformance = Math.round((positiveLifts / allEvidence.length) * 100);
  } else {
    historicalPerformance = 0;
  }

  // 7. Experiment Support
  const hasExperimentEvidence = allEvidence.some(e => e.sourceType === 'experiment');
  const experimentSupport = hasExperimentEvidence ? 90 : 20;
  if (!hasExperimentEvidence) {
    limitations.push('No formal scientific A/B test supports this recipe.');
  }

  // 8. Usage Reliability
  let usageReliability = 100;
  if (recipe.usageCount > 0) {
    usageReliability = Math.round((recipe.successfulApplicationCount / recipe.usageCount) * 100);
  } else {
    usageReliability = 50; // Neutral starting reliability
  }

  // 9. Overall Score & Confidence
  const overallScore = Math.round(
    (evidenceStrength +
      reproducibility +
      platformFit +
      brandFit +
      parameterCompleteness +
      historicalPerformance +
      experimentSupport +
      usageReliability) /
      8
  );

  let confidence = 0;
  if (allEvidence.length === 0) {
    confidence = 10; // "Untested recipes must show low evidence confidence."
  } else {
    confidence = Math.min(100, Math.round((evidenceStrength * 0.7) + (usageReliability * 0.3)));
  }

  const scorecard: RecipeScorecard = {
    id: `sc-${recipe.id}`,
    recipeId: recipe.id,
    recipeVersionId: version.id,
    evidenceStrength,
    reproducibility,
    platformFit,
    brandFit,
    parameterCompleteness,
    historicalPerformance,
    experimentSupport,
    usageReliability,
    overallScore,
    confidence,
    limitations,
    generatedAt: new Date().toISOString(),
  };

  // Save the scorecard
  return scorecard;
}
