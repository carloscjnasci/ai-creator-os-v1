import { RecipeEvidence, RecipeEvidenceSourceType } from './types';
import { loadRecipeEvidence, saveRecipeEvidence } from './recipeStorage';
import { loadAnalyses } from '../experimentation/experimentStorage';
import { AnalysisResultStatus } from '../experimentation/types';

/**
 * Validates and registers a new RecipeEvidence record.
 * Ensures rules like "no duplicate evidence", "no fabricated lifts/samples", and "no inconclusive wins" are strictly followed.
 */
export function addRecipeEvidence(
  evidenceInput: Omit<RecipeEvidence, 'id' | 'capturedAt'>
): RecipeEvidence {
  // 1. Enforce explicit valid values (no fabrication, no defaults)
  if (!evidenceInput.metricName || evidenceInput.metricName.trim() === '') {
    throw new Error('Evidence metricName must be explicitly provided.');
  }
  if (!Number.isFinite(evidenceInput.observedValue)) {
    throw new Error('Observed value must be a valid finite number.');
  }
  if (!Number.isFinite(evidenceInput.baselineValue)) {
    throw new Error('Baseline value must be a valid finite number.');
  }
  if (!Number.isFinite(evidenceInput.absoluteLift) || !Number.isFinite(evidenceInput.relativeLift)) {
    throw new Error('Lift must be explicitly provided as a valid finite number.');
  }
  if (evidenceInput.sampleSize <= 0 || !Number.isInteger(evidenceInput.sampleSize)) {
    throw new Error('Sample size must be an explicit positive integer. Defaults are rejected.');
  }

  const allEvidence = loadRecipeEvidence();

  // 2. Prevent duplicate evidence
  const isDuplicate = allEvidence.some(
    e =>
      e.recipeVersionId === evidenceInput.recipeVersionId &&
      e.metricName === evidenceInput.metricName &&
      e.sourceEntityId === evidenceInput.sourceEntityId
  );
  if (isDuplicate) {
    throw new Error('Duplicate evidence record is prevented.');
  }

  const limitations = [...(evidenceInput.limitations || [])];

  // 3. Conclusive Experiment Verification
  if (evidenceInput.sourceType === RecipeEvidenceSourceType.EXPERIMENT && evidenceInput.experimentId) {
    const analyses = loadAnalyses();
    const matchAnalysis = analyses.find(a => a.experimentId === evidenceInput.experimentId);

    if (matchAnalysis) {
      const status = matchAnalysis.resultStatus;
      if (
        status === AnalysisResultStatus.INCONCLUSIVE ||
        status === AnalysisResultStatus.INSUFFICIENT_SAMPLE ||
        status === AnalysisResultStatus.INVALID_DATA
      ) {
        throw new Error(`Evidence from inconclusive experiments cannot be treated as a win. Status: ${status}`);
      }

      if (status === AnalysisResultStatus.GUARDRAIL_VIOLATION) {
        limitations.push('Warning: Experiencing guardrail violations during experimentation.');
      }
    }
  }

  const id = `ev-${evidenceInput.recipeId}-${allEvidence.length + 1}`;
  const now = new Date().toISOString();

  const newEvidence: RecipeEvidence = {
    ...evidenceInput,
    id,
    limitations,
    capturedAt: now,
  };

  allEvidence.push(newEvidence);
  saveRecipeEvidence(allEvidence);
  return newEvidence;
}
