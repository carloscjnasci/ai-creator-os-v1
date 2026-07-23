import { 
  Experiment, 
  ExperimentVariant, 
  ExperimentObservation, 
  ExperimentAnalysisResult, 
  AnalysisResultStatus, 
  MetricType 
} from './types';
import { evaluateGuardrails } from './experimentGuardrails';

/**
 * Standard Normal Cumulative Distribution Function (CDF) approximation.
 * High-precision polynomial approximation.
 */
function stdNormalCDF(x: number): number {
  const t = 1.0 / (1.0 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327; // 1 / sqrt(2 * pi)
  const prob = d * Math.exp(-0.5 * x * x) * t * (
    0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))
  );
  if (x > 0) return 1.0 - prob;
  return prob;
}

/**
 * Calculates a two-tailed p-value given a standard normal Z-score.
 */
function twoTailedPValue(z: number): number {
  if (!Number.isFinite(z)) return 1.0;
  return 2 * (1.0 - stdNormalCDF(Math.abs(z)));
}

/**
 * Gets critical Z-value for confidence interval based on confidence level.
 */
function getZCritical(confidenceLevel: number): number {
  if (confidenceLevel >= 0.99) return 2.576;
  if (confidenceLevel >= 0.95) return 1.96;
  if (confidenceLevel >= 0.90) return 1.645;
  if (confidenceLevel >= 0.85) return 1.44;
  if (confidenceLevel >= 0.80) return 1.28;
  return 1.96; // Fallback
}

/**
 * Executes statistical evaluation of experiment variants against control.
 */
export function analyzeExperiment(
  experiment: Experiment,
  variants: ExperimentVariant[],
  observations: ExperimentObservation[]
): ExperimentAnalysisResult {
  const analyzedAt = new Date().toISOString();
  const warnings: string[] = [];
  const limitations: string[] = [];

  // Default empty result structure
  const makeDefaultResult = (status: AnalysisResultStatus, msg: string): ExperimentAnalysisResult => ({
    experimentId: experiment.id,
    primaryMetric: experiment.primaryMetric,
    controlVariantId: '',
    evaluatedVariantIds: [],
    sampleSizes: {},
    observedValues: {},
    absoluteLift: {},
    relativeLift: {},
    standardError: {},
    confidenceInterval: {},
    confidenceLevel: experiment.confidenceLevel,
    minimumDetectableEffect: experiment.minimumDetectableEffect,
    statisticalSignificance: {},
    practicalSignificance: {},
    resultStatus: status,
    warnings: [msg, ...warnings],
    limitations,
    analyzedAt
  });

  // 1. Locate control variant
  const controlVariant = variants.find(v => v.isControl);
  if (!controlVariant) {
    return makeDefaultResult(AnalysisResultStatus.INVALID_DATA, 'No control variant is defined for this experiment.');
  }

  const controlId = controlVariant.id;
  const evaluatedVariants = variants.filter(v => !v.isControl);
  const evaluatedIds = evaluatedVariants.map(v => v.id);

  if (evaluatedIds.length === 0) {
    return makeDefaultResult(AnalysisResultStatus.INVALID_DATA, 'No evaluated (alternative) variants found to compare.');
  }

  // 2. Extract and filter observations for primary metric
  const primaryObs = observations.filter(o => 
    o.experimentId === experiment.id && 
    o.metricName.toLowerCase() === experiment.primaryMetric.toLowerCase()
  );

  if (primaryObs.length === 0) {
    return makeDefaultResult(AnalysisResultStatus.INSUFFICIENT_SAMPLE, `No observations found for primary metric "${experiment.primaryMetric}".`);
  }

  // Group primary observations by variantId
  const obsByVariant = new Map<string, ExperimentObservation[]>();
  for (const obs of primaryObs) {
    if (!obsByVariant.has(obs.variantId)) {
      obsByVariant.set(obs.variantId, []);
    }
    obsByVariant.get(obs.variantId)!.push(obs);
  }

  // 3. Aggregate metrics for each variant
  const sampleSizes: Record<string, number> = {};
  const observedValues: Record<string, number> = {};
  const variances: Record<string, number> = {}; // Used for continuous aggregate metrics if available

  const metricType = primaryObs[0].metricType;

  const allVariantIds = [controlId, ...evaluatedIds];
  for (const varId of allVariantIds) {
    const list = obsByVariant.get(varId) || [];
    if (list.length === 0) {
      sampleSizes[varId] = 0;
      observedValues[varId] = 0;
      continue;
    }

    if (metricType === MetricType.RATE) {
      // For proportion metrics: aggregate sum of numerators / sum of denominators
      let sumNumerator = 0;
      let sumDenominator = 0;
      for (const o of list) {
        if (o.numerator !== undefined && o.denominator !== undefined) {
          sumNumerator += o.numerator;
          sumDenominator += o.denominator;
        } else {
          // Fallback to weighting value by sampleSize
          sumNumerator += o.value * o.sampleSize;
          sumDenominator += o.sampleSize;
        }
      }
      sampleSizes[varId] = Math.round(sumDenominator);
      observedValues[varId] = sumDenominator > 0 ? sumNumerator / sumDenominator : 0;
    } else {
      // For continuous metrics: sample size is the sum of sampleSizes
      let totalSample = 0;
      let sumWeightedValues = 0;
      let sumVariances = 0;
      let hasVariance = false;

      for (const o of list) {
        totalSample += o.sampleSize;
        sumWeightedValues += o.value * o.sampleSize;
        
        // Check if metadata has variance or standardDeviation
        const itemVar = o.metadata?.variance ?? (o.metadata?.standardDeviation ? Math.pow(o.metadata.standardDeviation, 2) : undefined);
        if (itemVar !== undefined && Number.isFinite(itemVar)) {
          sumVariances += itemVar * o.sampleSize;
          hasVariance = true;
        }
      }

      sampleSizes[varId] = totalSample;
      observedValues[varId] = totalSample > 0 ? sumWeightedValues / totalSample : 0;
      if (hasVariance && totalSample > 0) {
        variances[varId] = sumVariances / totalSample;
      }
    }
  }

  // Ensure control has data
  const controlSample = sampleSizes[controlId] || 0;
  const controlVal = observedValues[controlId] || 0;

  if (controlSample === 0) {
    return makeDefaultResult(AnalysisResultStatus.INSUFFICIENT_SAMPLE, 'Control variant has no observations recorded.');
  }

  // Check runtime guardrail
  let runtimeHours = 0;
  if (experiment.startAt) {
    const startMs = new Date(experiment.startAt).getTime();
    const currentMs = new Date(analyzedAt).getTime();
    runtimeHours = (currentMs - startMs) / (1000 * 60 * 60);
  }

  let meetsRuntime = runtimeHours >= experiment.minimumRuntimeHours;
  if (experiment.startAt && !meetsRuntime) {
    warnings.push(`Minimum runtime of ${experiment.minimumRuntimeHours} hours not reached (Current: ${runtimeHours.toFixed(1)} hrs). Result is provisional.`);
  }

  // Check minimum sample size guardrail for control
  let meetsControlSample = controlSample >= experiment.minimumSampleSize;
  if (!meetsControlSample) {
    warnings.push(`Control sample size (${controlSample}) is below minimum required (${experiment.minimumSampleSize}). Result is provisional.`);
  }

  // 4. Evaluate each variant against control
  const absoluteLift: Record<string, number> = {};
  const relativeLift: Record<string, number> = {};
  const standardError: Record<string, number> = {};
  const confidenceInterval: Record<string, [number, number]> = {};
  const pValue: Record<string, number> = {};
  const statisticalSignificance: Record<string, boolean> = {};
  const practicalSignificance: Record<string, boolean> = {};

  const zCrit = getZCritical(experiment.confidenceLevel);

  // Compute confidence interval for control variant itself
  let controlSE = 0;
  if (metricType === MetricType.RATE) {
    controlSE = Math.sqrt((controlVal * (1 - controlVal)) / controlSample);
    standardError[controlId] = controlSE;
    confidenceInterval[controlId] = [
      Math.max(0, controlVal - zCrit * controlSE),
      controlVal + zCrit * controlSE
    ];
  } else if (variances[controlId] !== undefined) {
    controlSE = Math.sqrt(variances[controlId] / controlSample);
    standardError[controlId] = controlSE;
    confidenceInterval[controlId] = [
      Math.max(0, controlVal - zCrit * controlSE),
      controlVal + zCrit * controlSE
    ];
  }

  let hasContinuousVarianceError = false;

  for (const varId of evaluatedIds) {
    const val = observedValues[varId] || 0;
    const sample = sampleSizes[varId] || 0;

    absoluteLift[varId] = val - controlVal;
    relativeLift[varId] = controlVal > 0 ? (val - controlVal) / controlVal : 0;

    if (sample === 0) {
      pValue[varId] = 1.0;
      statisticalSignificance[varId] = false;
      practicalSignificance[varId] = false;
      confidenceInterval[varId] = [0, 0];
      standardError[varId] = 0;
      continue;
    }

    let seVar = 0; // Standard error of this variant
    let seDiff = 0; // Standard error of the difference
    let zScore = 0;

    if (metricType === MetricType.RATE) {
      // Two-proportion Z-test
      seVar = Math.sqrt((val * (1 - val)) / sample);
      standardError[varId] = seVar;
      confidenceInterval[varId] = [
        Math.max(0, val - zCrit * seVar),
        val + zCrit * seVar
      ];
      
      const pooledP = (controlVal * controlSample + val * sample) / (controlSample + sample);
      if (pooledP > 0 && pooledP < 1) {
        seDiff = Math.sqrt(pooledP * (1 - pooledP) * (1 / controlSample + 1 / sample));
        zScore = seDiff > 0 ? (val - controlVal) / seDiff : 0;
      } else {
        zScore = 0;
      }
      pValue[varId] = twoTailedPValue(zScore);
    } else {
      // Continuous metric comparison
      const controlVarVal = variances[controlId];
      const variantVarVal = variances[varId];

      if (controlVarVal === undefined || variantVarVal === undefined) {
        hasContinuousVarianceError = true;
        // Do not assign standard error, confidence interval, or p-value!
      } else {
        seVar = Math.sqrt(variantVarVal / sample);
        standardError[varId] = seVar;
        confidenceInterval[varId] = [
          Math.max(0, val - zCrit * seVar),
          val + zCrit * seVar
        ];
        seDiff = Math.sqrt(controlVarVal / controlSample + variantVarVal / sample);
        zScore = seDiff > 0 ? (val - controlVal) / seDiff : 0;
        pValue[varId] = twoTailedPValue(zScore);
      }
    }

    // Check statistical significance
    const alpha = 1.0 - experiment.confidenceLevel;
    const isSignificant = pValue[varId] !== undefined && pValue[varId] < alpha;
    statisticalSignificance[varId] = isSignificant;

    // Practical significance: relativeLift meets/exceeds MDE, and must be positive!
    const isPracticallySignificant = isSignificant && 
      relativeLift[varId] >= experiment.minimumDetectableEffect && 
      absoluteLift[varId] > 0;
    practicalSignificance[varId] = isPracticallySignificant;
  }

  // If continuous metric is compared but variance is missing, report descriptive-only or invalid
  if (metricType !== MetricType.RATE && hasContinuousVarianceError) {
    limitations.push('Variance information is missing for this continuous metric. Hypothesis testing and p-values cannot be computed.');
  }

  // 5. Evaluate guardrails
  const guardrailResult = evaluateGuardrails(experiment, observations, controlId);
  const guardrailViolated = guardrailResult.violated && guardrailResult.severity === 'high';

  // 6. Select winner if eligible
  let winnerVariantId: string | undefined = undefined;
  let resultStatus = AnalysisResultStatus.INCONCLUSIVE;

  // Conditions for a winner to be declared:
  // - Minimum sample size met for control AND winning variant
  // - Minimum runtime hours met
  // - No critical guardrail violations
  // - Statistical & practical significance met
  // - Positive lift
  // - No continuous variance error preventing computation
  const qualifiesForWinner = (varId: string): boolean => {
    const sample = sampleSizes[varId] || 0;
    return (
      meetsRuntime &&
      meetsControlSample &&
      sample >= experiment.minimumSampleSize &&
      !guardrailViolated &&
      statisticalSignificance[varId] &&
      practicalSignificance[varId] &&
      absoluteLift[varId] > 0 &&
      (!hasContinuousVarianceError || metricType === MetricType.RATE)
    );
  };

  const winningCandidates = evaluatedIds.filter(qualifiesForWinner);

  if (winningCandidates.length > 0) {
    // Pick the candidate with the highest absolute lift
    winningCandidates.sort((a, b) => absoluteLift[b] - absoluteLift[a]);
    winnerVariantId = winningCandidates[0];
    resultStatus = AnalysisResultStatus.WINNER;
  } else if (guardrailViolated) {
    resultStatus = AnalysisResultStatus.GUARDRAIL_VIOLATION;
    warnings.push(`High-severity guardrail violation detected: ${guardrailResult.violatedGuardrails.join(', ')}.`);
  } else if (metricType !== MetricType.RATE && hasContinuousVarianceError) {
    resultStatus = AnalysisResultStatus.DESCRIPTIVE_ONLY;
  } else {
    // Check if sample sizes or runtime were the bottleneck
    const totalSampleMet = allVariantIds.every(varId => (sampleSizes[varId] || 0) >= experiment.minimumSampleSize);
    if (!meetsRuntime || !totalSampleMet) {
      resultStatus = AnalysisResultStatus.INSUFFICIENT_SAMPLE;
    } else {
      // Check if there was no difference detected at all
      const hasSignificantDiff = evaluatedIds.some(varId => statisticalSignificance[varId]);
      resultStatus = hasSignificantDiff ? AnalysisResultStatus.INCONCLUSIVE : AnalysisResultStatus.NO_DIFFERENCE;
    }
  }

  return {
    experimentId: experiment.id,
    primaryMetric: experiment.primaryMetric,
    controlVariantId: controlId,
    evaluatedVariantIds: evaluatedIds,
    sampleSizes,
    observedValues,
    absoluteLift,
    relativeLift,
    standardError,
    confidenceInterval,
    confidenceLevel: experiment.confidenceLevel,
    pValue,
    minimumDetectableEffect: experiment.minimumDetectableEffect,
    statisticalSignificance,
    practicalSignificance,
    winnerVariantId,
    resultStatus,
    warnings,
    limitations,
    analyzedAt
  };
}
