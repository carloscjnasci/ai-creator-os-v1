import { Experiment, ExperimentObservation, GuardrailResult } from './types';

/**
 * Evaluates guardrail metrics for an experiment based on current observations.
 * A guardrail violation can prevent a variant from being declared a winner.
 */
export function evaluateGuardrails(
  experiment: Experiment,
  observations: ExperimentObservation[],
  controlVariantId: string
): GuardrailResult {
  const violatedGuardrails: string[] = [];
  const supportingEvidence: Record<string, string> = {};
  let severity: 'low' | 'medium' | 'high' = 'low';

  // Extract observations relevant to this experiment
  const expObs = observations.filter(o => o.experimentId === experiment.id);
  if (expObs.length === 0) {
    return {
      violated: false,
      violatedGuardrails: [],
      supportingEvidence: {},
      severity: 'low',
      resultImpact: 'No observations available to evaluate guardrails.'
    };
  }

  // Group observations by variant and metric name
  const obsMap = new Map<string, Map<string, ExperimentObservation[]>>();
  for (const obs of expObs) {
    if (!obsMap.has(obs.variantId)) {
      obsMap.set(obs.variantId, new Map());
    }
    const varMap = obsMap.get(obs.variantId)!;
    if (!varMap.has(obs.metricName)) {
      varMap.set(obs.metricName, []);
    }
    varMap.get(obs.metricName)!.push(obs);
  }

  // Get control's average or most recent values for comparison
  const getLatestValue = (variantId: string, metricName: string): number | undefined => {
    const list = obsMap.get(variantId)?.get(metricName);
    if (!list || list.length === 0) return undefined;
    // Sort descending by capturedAt to get latest
    const sorted = [...list].sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
    return sorted[0].value;
  };

  // Check each configured guardrail metric
  for (const metric of experiment.guardrailMetrics) {
    const controlVal = getLatestValue(controlVariantId, metric);

    // Evaluate each evaluated variant against control or absolute thresholds
    for (const [variantId, varMap] of obsMap.entries()) {
      if (variantId === controlVariantId) continue;

      const variantVal = getLatestValue(variantId, metric);
      if (variantVal === undefined) continue;

      // Rule 1: Negative Engagement (like report rate, block rate)
      if (metric === 'negative_engagement' || metric === 'unfollow_rate' || metric === 'unsubscribe_rate') {
        if (variantVal > 0.02) { // Absolute threshold 2%
          violatedGuardrails.push(`${metric}:${variantId}`);
          supportingEvidence[`${metric}:${variantId}`] = `Observed rate is ${variantVal.toFixed(4)} which exceeds safe threshold (0.02).`;
          severity = 'high';
        } else if (controlVal !== undefined && variantVal > controlVal * 1.5) { // 50% relative increase over control
          violatedGuardrails.push(`${metric}:${variantId}`);
          supportingEvidence[`${metric}:${variantId}`] = `Observed rate is ${variantVal.toFixed(4)} which is >50% higher than control (${controlVal.toFixed(4)}).`;
          severity = 'medium';
        }
      }

      // Rule 2: Cost Increase (spend)
      if (metric === 'cost' || metric === 'spend') {
        if (controlVal !== undefined && controlVal > 0 && variantVal > controlVal * 1.3) { // 30% cost increase
          violatedGuardrails.push(`${metric}:${variantId}`);
          supportingEvidence[`${metric}:${variantId}`] = `Variant spend is ${variantVal.toFixed(2)} which is >30% higher than control (${controlVal.toFixed(2)}).`;
          if (severity !== 'high') severity = 'medium';
        }
      }

      // Rule 3: Conversion Rate Decline
      if (metric === 'cvr' || metric === 'conversion_rate') {
        if (controlVal !== undefined && variantVal < controlVal * 0.8) { // 20% conversion rate drop
          violatedGuardrails.push(`${metric}:${variantId}`);
          supportingEvidence[`${metric}:${variantId}`] = `Conversion rate is ${variantVal.toFixed(4)} which is >20% below control (${controlVal.toFixed(4)}).`;
          severity = 'high';
        }
      }

      // Rule 4: Platform Validation/Failure
      if (metric === 'platform_failure_rate') {
        if (variantVal > 0) {
          violatedGuardrails.push(`${metric}:${variantId}`);
          supportingEvidence[`${metric}:${variantId}`] = `Observed platform errors/failures: ${variantVal}.`;
          severity = 'high';
        }
      }
    }
  }

  const violated = violatedGuardrails.length > 0;
  let resultImpact = 'Guardrails satisfied. No impact on winner declarations.';
  if (violated) {
    resultImpact = severity === 'high' 
      ? 'CRITICAL: High-severity guardrail violations detected. Winner declaration is BLOCKED.'
      : 'WARNING: Medium-severity guardrail violations detected. Exercise extreme caution.';
  }

  return {
    violated,
    violatedGuardrails,
    supportingEvidence,
    severity,
    resultImpact
  };
}
