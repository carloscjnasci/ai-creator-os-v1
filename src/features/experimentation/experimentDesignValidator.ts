import { Experiment, ExperimentVariant } from './types';

export interface ValidationResult {
  errors: string[];
  warnings: string[];
  readinessStatus: 'ready' | 'invalid';
  recommendedCorrections: string[];
}

/**
 * Validates the design of an experiment and its variants before starting.
 */
export function validateExperimentDesign(
  experiment: Experiment,
  variants: ExperimentVariant[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const recommendedCorrections: string[] = [];

  // 1. Hypothesis exists
  if (!experiment.hypothesis || experiment.hypothesis.trim() === '') {
    errors.push('Hypothesis is required to run an experiment.');
    recommendedCorrections.push('Add a clear, testable hypothesis statement (e.g., "Changing the hook will increase retention").');
  }

  // 2. Objective exists
  if (!experiment.objective || experiment.objective.trim() === '') {
    errors.push('Objective is required.');
    recommendedCorrections.push('Specify a quantitative goal for this experiment.');
  }

  // 3. Primary metric exists
  if (!experiment.primaryMetric || experiment.primaryMetric.trim() === '') {
    errors.push('Primary metric configuration is missing.');
    recommendedCorrections.push('Select a primary metric like CVR or CTR to measure success.');
  }

  // 4. At least two variants
  if (variants.length < 2) {
    errors.push(`An experiment requires at least 2 variants. Current count: ${variants.length}.`);
    recommendedCorrections.push('Add at least one alternative variant to test against the control.');
  }

  // 5. Exactly one control
  const controlVariants = variants.filter(v => v.isControl);
  if (controlVariants.length === 0) {
    errors.push('No control variant defined.');
    recommendedCorrections.push('Select exactly one variant as the baseline control.');
  } else if (controlVariants.length > 1) {
    errors.push(`Multiple control variants defined (${controlVariants.length}). Exactly one control is allowed.`);
    recommendedCorrections.push('Ensure only one variant has the isControl flag set to true.');
  }

  // 6. Valid allocation weights
  let totalWeight = 0;
  let hasInvalidWeight = false;
  for (const variant of variants) {
    if (variant.allocationWeight <= 0 || !Number.isFinite(variant.allocationWeight)) {
      hasInvalidWeight = true;
    } else {
      totalWeight += variant.allocationWeight;
    }
  }

  if (hasInvalidWeight) {
    errors.push('All variant allocation weights must be positive, finite numbers.');
    recommendedCorrections.push('Correct any negative, zero, or invalid allocation weights.');
  }

  if (variants.length >= 2 && totalWeight <= 0) {
    errors.push('Total variant allocation weight must be greater than zero.');
    recommendedCorrections.push('Assign positive weights to variants to allow proper allocation.');
  }

  // 7. No duplicate variant keys
  const keys = variants.map(v => v.variantKey);
  const duplicateKeys = keys.filter((key, index) => keys.indexOf(key) !== index);
  if (duplicateKeys.length > 0) {
    errors.push(`Duplicate variant keys found: ${Array.from(new Set(duplicateKeys)).join(', ')}.`);
    recommendedCorrections.push('Assign a unique variant key to each variant.');
  }

  // 8. Confidence level checks
  if (experiment.confidenceLevel <= 0 || experiment.confidenceLevel >= 1) {
    errors.push('Confidence level must be strictly between 0.0 and 1.0 (e.g. 0.95).');
    recommendedCorrections.push('Set confidenceLevel to a standard value (0.90, 0.95, or 0.99).');
  } else if (experiment.confidenceLevel < 0.80) {
    warnings.push(`Low confidence level (${(experiment.confidenceLevel * 100).toFixed(0)}%) selected. Standard practice recommends at least 90%.`);
    recommendedCorrections.push('Increase confidence level to 0.95 to reduce false positive rate.');
  }

  // 9. Minimum detectable effect
  if (experiment.minimumDetectableEffect <= 0 || experiment.minimumDetectableEffect >= 1) {
    errors.push('Minimum detectable effect (MDE) must be strictly between 0.0 and 1.0.');
    recommendedCorrections.push('Set MDE to a standard range (e.g., 0.01 to 0.20).');
  }

  // 10. Minimum sample size
  if (experiment.minimumSampleSize <= 0) {
    errors.push('Minimum sample size must be a positive integer.');
    recommendedCorrections.push('Configure a realistic minimum sample size based on estimated daily volume.');
  } else if (experiment.minimumSampleSize < 100) {
    warnings.push('Small minimum sample size may yield low statistical power.');
    recommendedCorrections.push('Consider a sample size of at least 100 per variant to ensure robust analysis.');
  }

  // 11. Runtime checks
  if (experiment.minimumRuntimeHours <= 0) {
    errors.push('Minimum runtime hours must be greater than zero.');
  }
  if (experiment.maximumRuntimeHours < experiment.minimumRuntimeHours) {
    errors.push('Maximum runtime hours cannot be less than minimum runtime hours.');
    recommendedCorrections.push('Ensure maximum runtime hours is equal to or greater than minimum runtime hours.');
  }

  // 12. Compatible variant lineage / Asset selection / Prompt check
  for (const variant of variants) {
    if (variant.metadata?.isArchived || variant.metadata?.isDeleted) {
      errors.push(`Variant ${variant.name} points to an archived or deleted asset/resource.`);
      recommendedCorrections.push(`Replace the inactive asset/resource in variant ${variant.name}.`);
    }
    if (variant.metadata?.isRejectedPrompt) {
      errors.push(`Variant ${variant.name} uses a prompt version that was rejected by compliance/brand safety.`);
      recommendedCorrections.push(`Select an approved prompt version for variant ${variant.name}.`);
    }
    // Check brand rules
    if (variant.metadata?.brandRuleViolated) {
      errors.push(`Variant ${variant.name} violates active brand safety rules: ${variant.metadata.brandRuleViolationMessage || 'unspecified rule'}.`);
      recommendedCorrections.push(`Edit the creative content in variant ${variant.name} to comply with brand rules.`);
    }
  }

  const readinessStatus = errors.length === 0 ? 'ready' : 'invalid';

  return {
    errors,
    warnings,
    readinessStatus,
    recommendedCorrections
  };
}
