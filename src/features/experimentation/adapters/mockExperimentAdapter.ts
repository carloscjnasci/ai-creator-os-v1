import { Experiment, ExperimentVariant, ExperimentObservation, MetricType } from '../types';
import { MetricWindow } from '../../analytics-feedback/types';

/**
 * Deterministic Mock Experiment Adapter.
 * Generates reliable and reproducible observations for testing A/B evaluation scenarios.
 * All generated observations are explicitly labeled as mock/estimated.
 */
export class MockExperimentAdapter {
  /**
   * Generates deterministic observations based on the specified scenario.
   */
  public static simulateScenario(
    experiment: Experiment,
    variants: ExperimentVariant[],
    scenario: 'winner' | 'no_difference' | 'guardrail_violation' | 'insufficient_sample'
  ): ExperimentObservation[] {
    const observations: ExperimentObservation[] = [];
    const capturedAt = '2026-07-17T03:30:00Z';

    const control = variants.find(v => v.isControl);
    const alternative = variants.find(v => !v.isControl);

    if (!control || !alternative) {
      return [];
    }

    // Baseline configurations
    let controlImpressions = 1000;
    let controlCTR = 0.05; // 5%

    let altImpressions = 1020;
    let altCTR = 0.05; // 5% by default

    let addGuardrailMetric = false;
    let guardrailVal = 0.005;

    switch (scenario) {
      case 'winner':
        controlImpressions = experiment.minimumSampleSize + 500;
        altImpressions = experiment.minimumSampleSize + 600;
        controlCTR = 0.04;
        altCTR = 0.07; // 75% relative lift (highly significant)
        break;

      case 'no_difference':
        controlImpressions = experiment.minimumSampleSize + 500;
        altImpressions = experiment.minimumSampleSize + 500;
        controlCTR = 0.05;
        altCTR = 0.051; // tiny lift, well below MDE
        break;

      case 'guardrail_violation':
        controlImpressions = experiment.minimumSampleSize + 500;
        altImpressions = experiment.minimumSampleSize + 500;
        controlCTR = 0.05;
        altCTR = 0.06;
        addGuardrailMetric = true;
        guardrailVal = 0.035; // exceeds safe limit of 0.02
        break;

      case 'insufficient_sample':
        controlImpressions = Math.min(experiment.minimumSampleSize - 50, 40);
        altImpressions = Math.min(experiment.minimumSampleSize - 50, 40);
        controlCTR = 0.05;
        altCTR = 0.09;
        break;
    }

    // 1. Generate primary metric (e.g. CTR or CVR) for Control
    const controlClicks = Math.round(controlImpressions * controlCTR);
    observations.push({
      id: `mock-obs-ctrl-primary-${experiment.id}`,
      experimentId: experiment.id,
      variantId: control.id,
      metricName: experiment.primaryMetric,
      metricType: MetricType.RATE,
      value: controlClicks / controlImpressions,
      numerator: controlClicks,
      denominator: controlImpressions,
      sampleSize: controlImpressions,
      capturedAt,
      metricWindow: MetricWindow.LIFETIME,
      source: 'mock_experiment_adapter',
      isEstimated: true,
      metadata: { scenario, note: 'Deterministic control observation' }
    });

    // 2. Generate primary metric for Alternative
    const altClicks = Math.round(altImpressions * altCTR);
    observations.push({
      id: `mock-obs-alt-primary-${experiment.id}`,
      experimentId: experiment.id,
      variantId: alternative.id,
      metricName: experiment.primaryMetric,
      metricType: MetricType.RATE,
      value: altClicks / altImpressions,
      numerator: altClicks,
      denominator: altImpressions,
      sampleSize: altImpressions,
      capturedAt,
      metricWindow: MetricWindow.LIFETIME,
      source: 'mock_experiment_adapter',
      isEstimated: true,
      metadata: { scenario, note: 'Deterministic alternative variant observation' }
    });

    // 3. Optional guardrail metric (e.g., negative_engagement)
    if (addGuardrailMetric || experiment.guardrailMetrics.includes('negative_engagement')) {
      observations.push({
        id: `mock-obs-alt-guardrail-${experiment.id}`,
        experimentId: experiment.id,
        variantId: alternative.id,
        metricName: 'negative_engagement',
        metricType: MetricType.RATE,
        value: guardrailVal,
        numerator: Math.round(altImpressions * guardrailVal),
        denominator: altImpressions,
        sampleSize: altImpressions,
        capturedAt,
        metricWindow: MetricWindow.LIFETIME,
        source: 'mock_experiment_adapter',
        isEstimated: true,
        metadata: { scenario, note: 'Deterministic alternative guardrail observation' }
      });

      // Add small safe baseline guardrail for control
      observations.push({
        id: `mock-obs-ctrl-guardrail-${experiment.id}`,
        experimentId: experiment.id,
        variantId: control.id,
        metricName: 'negative_engagement',
        metricType: MetricType.RATE,
        value: 0.002,
        numerator: Math.round(controlImpressions * 0.002),
        denominator: controlImpressions,
        sampleSize: controlImpressions,
        capturedAt,
        metricWindow: MetricWindow.LIFETIME,
        source: 'mock_experiment_adapter',
        isEstimated: true,
        metadata: { scenario, note: 'Deterministic control guardrail baseline' }
      });
    }

    return observations;
  }
}
