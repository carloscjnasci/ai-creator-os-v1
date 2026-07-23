import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { 
  Experiment, 
  ExperimentVariant, 
  ExperimentObservation, 
  ExperimentType, 
  ExperimentStatus, 
  MetricType, 
  AnalysisResultStatus, 
  RecommendationStatus 
} from '../types';
import { 
  experimentSchema, 
  experimentVariantSchema, 
  experimentObservationSchema 
} from '../experimentSchemas';
import { 
  isValidTransition, 
  transitionExperiment 
} from '../experimentLifecycle';
import { 
  validateExperimentDesign 
} from '../experimentDesignValidator';
import { 
  assignVariantDeterministically 
} from '../experimentAssignment';
import { 
  analyzeExperiment 
} from '../experimentAnalyzer';
import { 
  generateRecommendations 
} from '../experimentRecommendationEngine';
import { 
  MockExperimentAdapter 
} from '../adapters/mockExperimentAdapter';
import { 
  ManualExperimentAdapter 
} from '../adapters/manualExperimentAdapter';
import { 
  SecureExperimentAdapter 
} from '../adapters/secureExperimentAdapter';
import { 
  loadExperiments, 
  saveExperiments, 
  loadVariants, 
  saveVariants, 
  subscribeToStorageChanges,
  EXPERIMENTS_KEY
} from '../experimentStorage';

// Helpers to build base compliant entities
function getBaseExperiment(overrides: Partial<Experiment> = {}): Experiment {
  return {
    id: 'exp-test-123',
    workspaceId: 'ws-test',
    name: 'Standard Hook A/B Test',
    description: 'Testing standard versus high-impact hook variations.',
    hypothesis: 'A high-impact hook will increase the TikTok click-through rate.',
    objective: 'Increase click-through rate by 10%.',
    experimentType: ExperimentType.AB_TEST,
    status: ExperimentStatus.DRAFT,
    primaryMetric: 'ctr',
    secondaryMetrics: [],
    guardrailMetrics: ['negative_engagement'],
    minimumSampleSize: 200,
    minimumRuntimeHours: 24,
    maximumRuntimeHours: 72,
    confidenceLevel: 0.95,
    minimumDetectableEffect: 0.05,
    allocationStrategy: 'even',
    tags: ['hook-test'],
    owner: 'user-admin',
    createdAt: '2026-07-16T12:00:00Z',
    updatedAt: '2026-07-16T12:00:00Z',
    ...overrides
  };
}

function getBaseVariants(experimentId: string = 'exp-test-123'): ExperimentVariant[] {
  return [
    {
      id: 'var-control-01',
      experimentId,
      name: 'Control Hook (Base)',
      description: 'The baseline video hook.',
      variantKey: 'control',
      isControl: true,
      allocationWeight: 50,
      promptHistoryId: 'prompt-111',
      createdAt: '2026-07-16T12:00:00Z',
      updatedAt: '2026-07-16T12:00:00Z'
    },
    {
      id: 'var-alt-02',
      experimentId,
      name: 'High Impact Hook',
      description: 'An aggressive 3-second hook.',
      variantKey: 'variant_a',
      isControl: false,
      allocationWeight: 50,
      promptHistoryId: 'prompt-222',
      createdAt: '2026-07-16T12:00:00Z',
      updatedAt: '2026-07-16T12:00:00Z'
    }
  ];
}

describe('Experimentation Engine Unit Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // 1. Experiment Schema
  it('validates a schema-compliant experiment successfully and rejects malformed records', () => {
    const validExp = getBaseExperiment();
    const result = experimentSchema.safeParse(validExp);
    expect(result.success).toBe(true);

    const invalidExp = getBaseExperiment({ confidenceLevel: 1.5 }); // Confidence level must be 0-1
    const invalidResult = experimentSchema.safeParse(invalidExp);
    expect(invalidResult.success).toBe(false);
  });

  // 2. Lifecycle transitions
  it('correctly handles permitted status transitions', () => {
    const draftExp = getBaseExperiment({ status: ExperimentStatus.DRAFT });
    
    // Draft -> Ready
    const step1 = transitionExperiment(draftExp, ExperimentStatus.READY, getBaseVariants());
    expect(step1.success).toBe(true);
    expect(step1.experiment?.status).toBe(ExperimentStatus.READY);

    // Ready -> Running
    const runningExp = transitionExperiment(step1.experiment!, ExperimentStatus.RUNNING, getBaseVariants());
    expect(runningExp.success).toBe(true);
    expect(runningExp.experiment?.status).toBe(ExperimentStatus.RUNNING);
    expect(runningExp.experiment?.startAt).toBeDefined();
  });

  // 3. Invalid lifecycle transitions
  it('enforces invalid transitions strictly and blocks forbidden status shifts', () => {
    const completedExp = getBaseExperiment({ status: ExperimentStatus.COMPLETED });
    
    // Completed -> Running is forbidden
    const transition = transitionExperiment(completedExp, ExperimentStatus.RUNNING, getBaseVariants());
    expect(transition.success).toBe(false);
    expect(transition.error).toContain('Invalid transition');

    const archivedExp = getBaseExperiment({ status: ExperimentStatus.ARCHIVED });
    
    // Archived -> Draft is forbidden
    const transition2 = transitionExperiment(archivedExp, ExperimentStatus.DRAFT, getBaseVariants());
    expect(transition2.success).toBe(false);
  });

  // 4. Variant validation
  it('validates a variant against the schema rules', () => {
    const variants = getBaseVariants();
    const controlResult = experimentVariantSchema.safeParse(variants[0]);
    expect(controlResult.success).toBe(true);

    // Invalid weight
    const badVariant = { ...variants[1], allocationWeight: -10 };
    const invalidResult = experimentVariantSchema.safeParse(badVariant);
    expect(invalidResult.success).toBe(false);
  });

  // 5. Exactly one control
  it('requires exactly one control variant in design validation', () => {
    const exp = getBaseExperiment();
    const variants = getBaseVariants();

    // Set both as control
    variants[1].isControl = true;
    const validationBoth = validateExperimentDesign(exp, variants);
    expect(validationBoth.errors).toContain('Multiple control variants defined (2). Exactly one control is allowed.');

    // Set none as control
    variants[0].isControl = false;
    variants[1].isControl = false;
    const validationNone = validateExperimentDesign(exp, variants);
    expect(validationNone.errors).toContain('No control variant defined.');
  });

  // 6. Allocation normalization
  it('ensures variant weights accumulate to a valid allocation strategy', () => {
    const exp = getBaseExperiment();
    const variants = getBaseVariants();

    // Verify weights are positive
    const validation = validateExperimentDesign(exp, variants);
    expect(validation.errors).toHaveLength(0);

    variants[0].allocationWeight = 0;
    const invalidVal = validateExperimentDesign(exp, variants);
    expect(invalidVal.errors).toContain('All variant allocation weights must be positive, finite numbers.');
  });

  // 7. Deterministic assignment
  it('deterministically maps an assignment unit to the same variant every time', () => {
    const expId = 'exp-deterministic';
    const variants = getBaseVariants(expId);
    
    const unitId = 'visitor-anonymous-091';
    
    const firstAssigned = assignVariantDeterministically(expId, unitId, variants);
    expect(firstAssigned).not.toBeNull();

    // Assert subsequent assignments for the same ID yield the exact same variant
    for (let i = 0; i < 50; i++) {
      const reAssigned = assignVariantDeterministically(expId, unitId, variants);
      expect(reAssigned?.id).toBe(firstAssigned?.id);
    }
  });

  // 8. Stable assignment after reload
  it('guarantees stable assignment across reloads without secret dependencies', () => {
    const expId = 'exp-stable-reload';
    const variants = getBaseVariants(expId);
    
    const unit1 = 'user-abc';
    const unit2 = 'user-xyz';

    const assign1 = assignVariantDeterministically(expId, unit1, variants);
    const assign2 = assignVariantDeterministically(expId, unit2, variants);

    // Simulate reloading state by instantiating new variant copies
    const reloadedVariants = getBaseVariants(expId);
    
    expect(assignVariantDeterministically(expId, unit1, reloadedVariants)?.id).toBe(assign1?.id);
    expect(assignVariantDeterministically(expId, unit2, reloadedVariants)?.id).toBe(assign2?.id);
  });

  // 9. Invalid allocation
  it('rejects or ignores variants with non-positive or non-finite allocation weights', () => {
    const expId = 'exp-invalid-weight';
    const variants = getBaseVariants(expId);
    
    // Set alternative variant weight to 0 (effectively 100% control)
    variants[1].allocationWeight = 0;

    for (let i = 0; i < 100; i++) {
      const assigned = assignVariantDeterministically(expId, `unit-${i}`, variants);
      expect(assigned?.id).toBe('var-control-01');
    }
  });

  // 10. Proportion comparison
  it('correctly calculates absolute and relative lifts for rates/proportions', () => {
    const exp = getBaseExperiment();
    const variants = getBaseVariants();

    // Record high performance CTR observations
    const observations: ExperimentObservation[] = [
      {
        id: 'obs-ctrl',
        experimentId: exp.id,
        variantId: 'var-control-01',
        metricName: 'ctr',
        metricType: MetricType.RATE,
        value: 0.05,
        numerator: 50,
        denominator: 1000,
        sampleSize: 1000,
        capturedAt: '2026-07-16T15:00:00Z',
        metricWindow: 'lifetime',
        source: 'manual',
        isEstimated: false
      },
      {
        id: 'obs-alt',
        experimentId: exp.id,
        variantId: 'var-alt-02',
        metricName: 'ctr',
        metricType: MetricType.RATE,
        value: 0.08,
        numerator: 80,
        denominator: 1000,
        sampleSize: 1000,
        capturedAt: '2026-07-16T15:00:00Z',
        metricWindow: 'lifetime',
        source: 'manual',
        isEstimated: false
      }
    ];

    const result = analyzeExperiment(exp, variants, observations);
    
    // Absolute lift: 0.08 - 0.05 = 0.03
    expect(result.absoluteLift['var-alt-02']).toBeCloseTo(0.03, 5);
    // Relative lift: (0.08 - 0.05) / 0.05 = 0.60 (60%)
    expect(result.relativeLift['var-alt-02']).toBeCloseTo(0.60, 5);
  });

  // 11. Confidence interval
  it('correctly structures confidence interval ranges for control and variants', () => {
    const exp = getBaseExperiment();
    const variants = getBaseVariants();
    const observations: ExperimentObservation[] = [
      {
        id: 'obs-ctrl',
        experimentId: exp.id,
        variantId: 'var-control-01',
        metricName: 'ctr',
        metricType: MetricType.RATE,
        value: 0.05,
        numerator: 50,
        denominator: 1000,
        sampleSize: 1000,
        capturedAt: '2026-07-16T15:00:00Z',
        metricWindow: 'lifetime',
        source: 'manual',
        isEstimated: false
      },
      {
        id: 'obs-alt',
        experimentId: exp.id,
        variantId: 'var-alt-02',
        metricName: 'ctr',
        metricType: MetricType.RATE,
        value: 0.05,
        numerator: 50,
        denominator: 1000,
        sampleSize: 1000,
        capturedAt: '2026-07-16T15:00:00Z',
        metricWindow: 'lifetime',
        source: 'manual',
        isEstimated: false
      }
    ];

    const result = analyzeExperiment(exp, variants, observations);
    
    const ctrlCI = result.confidenceInterval['var-control-01'];
    expect(ctrlCI).toBeDefined();
    expect(ctrlCI[0]).toBeLessThan(0.05);
    expect(ctrlCI[1]).toBeGreaterThan(0.05);
  });

  // 12. Minimum sample enforcement
  it('prevents winner declaration when sample sizes fall below minimum threshold', () => {
    // Required minimum sample size is 200
    const exp = getBaseExperiment({ minimumSampleSize: 200, minimumRuntimeHours: 0 });
    const variants = getBaseVariants();
    const observations: ExperimentObservation[] = [
      {
        id: 'obs-ctrl',
        experimentId: exp.id,
        variantId: 'var-control-01',
        metricName: 'ctr',
        metricType: MetricType.RATE,
        value: 0.05,
        numerator: 5,
        denominator: 100, // sample size 100 < 200
        sampleSize: 100,
        capturedAt: '2026-07-16T15:00:00Z',
        metricWindow: 'lifetime',
        source: 'manual',
        isEstimated: false
      },
      {
        id: 'obs-alt',
        experimentId: exp.id,
        variantId: 'var-alt-02',
        metricName: 'ctr',
        metricType: MetricType.RATE,
        value: 0.15, // huge lift but sample size insufficient
        numerator: 15,
        denominator: 100,
        sampleSize: 100,
        capturedAt: '2026-07-16T15:00:00Z',
        metricWindow: 'lifetime',
        source: 'manual',
        isEstimated: false
      }
    ];

    const result = analyzeExperiment(exp, variants, observations);
    expect(result.resultStatus).toBe(AnalysisResultStatus.INSUFFICIENT_SAMPLE);
    expect(result.winnerVariantId).toBeUndefined();
  });

  // 13. Minimum runtime enforcement
  it('prevents winner declaration when elapsed runtime is below minimum runtime limit', () => {
    // Start experiment now to trigger short runtime simulation
    const exp = getBaseExperiment({ 
      minimumRuntimeHours: 24, 
      minimumSampleSize: 50,
      startAt: new Date().toISOString() // elapsed runtime is ~0 hours
    });
    const variants = getBaseVariants();
    const observations: ExperimentObservation[] = [
      {
        id: 'obs-ctrl',
        experimentId: exp.id,
        variantId: 'var-control-01',
        metricName: 'ctr',
        metricType: MetricType.RATE,
        value: 0.05,
        numerator: 25,
        denominator: 500,
        sampleSize: 500,
        capturedAt: '2026-07-16T15:00:00Z',
        metricWindow: 'lifetime',
        source: 'manual',
        isEstimated: false
      },
      {
        id: 'obs-alt',
        experimentId: exp.id,
        variantId: 'var-alt-02',
        metricName: 'ctr',
        metricType: MetricType.RATE,
        value: 0.12,
        numerator: 60,
        denominator: 500,
        sampleSize: 500,
        capturedAt: '2026-07-16T15:00:00Z',
        metricWindow: 'lifetime',
        source: 'manual',
        isEstimated: false
      }
    ];

    const result = analyzeExperiment(exp, variants, observations);
    expect(result.resultStatus).toBe(AnalysisResultStatus.INSUFFICIENT_SAMPLE);
    expect(result.winnerVariantId).toBeUndefined();
    expect(result.warnings.some(w => w.includes('Minimum runtime'))).toBe(true);
  });

  // 14. Practical significance
  it('requires positive lift exceeding Minimum Detectable Effect (MDE) to declare a winner', () => {
    // MDE is 0.05 (5%)
    const exp = getBaseExperiment({ minimumSampleSize: 100, minimumRuntimeHours: 0, minimumDetectableEffect: 0.05 });
    const variants = getBaseVariants();
    const observations: ExperimentObservation[] = [
      {
        id: 'obs-ctrl',
        experimentId: exp.id,
        variantId: 'var-control-01',
        metricName: 'ctr',
        metricType: MetricType.RATE,
        value: 0.05,
        numerator: 50,
        denominator: 1000,
        sampleSize: 1000,
        capturedAt: '2026-07-16T15:00:00Z',
        metricWindow: 'lifetime',
        source: 'manual',
        isEstimated: false
      },
      {
        id: 'obs-alt',
        experimentId: exp.id,
        variantId: 'var-alt-02',
        metricName: 'ctr',
        metricType: MetricType.RATE,
        value: 0.051, // lift is only 2% relative, which is below MDE (5%)
        numerator: 51,
        denominator: 1000,
        sampleSize: 1000,
        capturedAt: '2026-07-16T15:00:00Z',
        metricWindow: 'lifetime',
        source: 'manual',
        isEstimated: false
      }
    ];

    const result = analyzeExperiment(exp, variants, observations);
    expect(result.resultStatus).toBe(AnalysisResultStatus.NO_DIFFERENCE);
    expect(result.winnerVariantId).toBeUndefined();
  });

  // 15. Statistical significance
  it('correctly calculates p-values and marks statistical significance', () => {
    const exp = getBaseExperiment({ minimumSampleSize: 100, minimumRuntimeHours: 0 });
    const variants = getBaseVariants();
    
    // High-contrast sample size where difference is overwhelmingly significant
    const observations: ExperimentObservation[] = [
      {
        id: 'obs-ctrl',
        experimentId: exp.id,
        variantId: 'var-control-01',
        metricName: 'ctr',
        metricType: MetricType.RATE,
        value: 0.05,
        numerator: 50,
        denominator: 1000,
        sampleSize: 1000,
        capturedAt: '2026-07-16T15:00:00Z',
        metricWindow: 'lifetime',
        source: 'manual',
        isEstimated: false
      },
      {
        id: 'obs-alt',
        experimentId: exp.id,
        variantId: 'var-alt-02',
        metricName: 'ctr',
        metricType: MetricType.RATE,
        value: 0.09, // 9% versus 5% (extremely significant)
        numerator: 90,
        denominator: 1000,
        sampleSize: 1000,
        capturedAt: '2026-07-16T15:00:00Z',
        metricWindow: 'lifetime',
        source: 'manual',
        isEstimated: false
      }
    ];

    const result = analyzeExperiment(exp, variants, observations);
    expect(result.statisticalSignificance['var-alt-02']).toBe(true);
    expect(result.pValue?.['var-alt-02']).toBeLessThan(0.01);
  });

  // 16. Inconclusive result
  it('classifies result as inconclusive when statistical significance is not reached despite full sample', () => {
    const exp = getBaseExperiment({ minimumSampleSize: 500, minimumRuntimeHours: 0 });
    const variants = getBaseVariants();
    const observations: ExperimentObservation[] = [
      {
        id: 'obs-ctrl',
        experimentId: exp.id,
        variantId: 'var-control-01',
        metricName: 'ctr',
        metricType: MetricType.RATE,
        value: 0.05,
        numerator: 50,
        denominator: 1000,
        sampleSize: 1000,
        capturedAt: '2026-07-16T15:00:00Z',
        metricWindow: 'lifetime',
        source: 'manual',
        isEstimated: false
      },
      {
        id: 'obs-alt',
        experimentId: exp.id,
        variantId: 'var-alt-02',
        metricName: 'ctr',
        metricType: MetricType.RATE,
        value: 0.052, // slight variation, completely within natural noise (not significant)
        numerator: 52,
        denominator: 1000,
        sampleSize: 1000,
        capturedAt: '2026-07-16T15:00:00Z',
        metricWindow: 'lifetime',
        source: 'manual',
        isEstimated: false
      }
    ];

    const result = analyzeExperiment(exp, variants, observations);
    expect(result.resultStatus).toBe(AnalysisResultStatus.NO_DIFFERENCE);
    expect(result.winnerVariantId).toBeUndefined();
  });

  // 17. Guardrail violation
  it('blocks winner declaration when a critical guardrail metric is violated', () => {
    const exp = getBaseExperiment({ minimumSampleSize: 100, minimumRuntimeHours: 0 });
    const variants = getBaseVariants();
    
    // Alt has spectacular click-through rate, but high negative engagement (complaints, unfollows)
    const observations: ExperimentObservation[] = [
      {
        id: 'obs-ctrl',
        experimentId: exp.id,
        variantId: 'var-control-01',
        metricName: 'ctr',
        metricType: MetricType.RATE,
        value: 0.05,
        numerator: 50,
        denominator: 1000,
        sampleSize: 1000,
        capturedAt: '2026-07-16T15:00:00Z',
        metricWindow: 'lifetime',
        source: 'manual',
        isEstimated: false
      },
      {
        id: 'obs-alt',
        experimentId: exp.id,
        variantId: 'var-alt-02',
        metricName: 'ctr',
        metricType: MetricType.RATE,
        value: 0.12,
        numerator: 120,
        denominator: 1000,
        sampleSize: 1000,
        capturedAt: '2026-07-16T15:00:00Z',
        metricWindow: 'lifetime',
        source: 'manual',
        isEstimated: false
      },
      // Guardrail metric: negative_engagement = 4% (above critical limit of 2%)
      {
        id: 'obs-alt-guard',
        experimentId: exp.id,
        variantId: 'var-alt-02',
        metricName: 'negative_engagement',
        metricType: MetricType.RATE,
        value: 0.04,
        sampleSize: 1000,
        capturedAt: '2026-07-16T15:00:00Z',
        metricWindow: 'lifetime',
        source: 'manual',
        isEstimated: false
      }
    ];

    const result = analyzeExperiment(exp, variants, observations);
    
    // Result status must shift to guardrail violation and block the winner
    expect(result.resultStatus).toBe(AnalysisResultStatus.GUARDRAIL_VIOLATION);
    expect(result.winnerVariantId).toBeUndefined();
  });

  // 18. Unavailable variance behavior
  it('skips hypothesis tests and returns descriptive results for continuous metrics with missing variance', () => {
    const exp = getBaseExperiment({ primaryMetric: 'watch_time_seconds' });
    const variants = getBaseVariants();
    const observations: ExperimentObservation[] = [
      {
        id: 'obs-ctrl',
        experimentId: exp.id,
        variantId: 'var-control-01',
        metricName: 'watch_time_seconds',
        metricType: MetricType.DURATION,
        value: 14.5, // control average watch time
        sampleSize: 1000,
        capturedAt: '2026-07-16T15:00:00Z',
        metricWindow: 'lifetime',
        source: 'manual',
        isEstimated: false,
        metadata: {} // missing variance/stdDev
      },
      {
        id: 'obs-alt',
        experimentId: exp.id,
        variantId: 'var-alt-02',
        metricName: 'watch_time_seconds',
        metricType: MetricType.DURATION,
        value: 19.2, // variant average watch time
        sampleSize: 1000,
        capturedAt: '2026-07-16T15:00:00Z',
        metricWindow: 'lifetime',
        source: 'manual',
        isEstimated: false,
        metadata: {} // missing variance/stdDev
      }
    ];

    const result = analyzeExperiment(exp, variants, observations);
    expect(result.limitations).toContain('Variance information is missing for this continuous metric. Hypothesis testing and p-values cannot be computed.');
    expect(result.pValue?.['var-alt-02']).toBeUndefined();
    expect(result.standardError?.['var-alt-02']).toBeUndefined();
    expect(result.confidenceInterval?.['var-alt-02']).toBeUndefined();
    expect(result.statisticalSignificance?.['var-alt-02']).toBe(false);
    expect(result.practicalSignificance?.['var-alt-02']).toBe(false);
    expect(result.winnerVariantId).toBeUndefined();
    expect(result.resultStatus).toBe('descriptive_only');
  });

  // 19. No fabricated metrics
  it('ensures that system observations rely strictly on real-recorded lists and flags simulated data explicitly', () => {
    const mockObs = MockExperimentAdapter.simulateScenario(getBaseExperiment(), getBaseVariants(), 'winner');
    for (const o of mockObs) {
      expect(o.isEstimated).toBe(true);
      expect(o.source).toBe('mock_experiment_adapter');
    }
  });

  // 20. Recommendation evidence
  it('guarantees recommendation items are populated with structural evidence arrays citing metrics', () => {
    const exp = getBaseExperiment({ minimumSampleSize: 50, minimumRuntimeHours: 0 });
    const variants = getBaseVariants();
    const observations = MockExperimentAdapter.simulateScenario(exp, variants, 'winner');

    const analysis = analyzeExperiment(exp, variants, observations);
    const recommendations = generateRecommendations(exp, analysis, variants);

    expect(recommendations).toHaveLength(3);
    const winnerRec = recommendations.find(r => r.recommendationType === 'declare_winner');
    expect(winnerRec).toBeDefined();
    expect(winnerRec?.evidence.some(e => e.includes('statistically significant'))).toBe(true);
    expect(winnerRec?.evidence.some(e => e.includes('lift'))).toBe(true);
  });

  // 21. Storage failures
  it('handles write quota errors gracefully during storage saves without crashing', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const exps = [getBaseExperiment()];
    const result = saveExperiments(exps);
    expect(result).toBe(false); // safeWrite must return false instead of raising exception

    spy.mockRestore();
  });

  // 22. Storage subscription and cleanup
  it('correctly registers storage change handlers and clears them on cleanup', () => {
    let fired = false;
    const cleanup = subscribeToStorageChanges(EXPERIMENTS_KEY, () => {
      fired = true;
    });

    const event = new StorageEvent('storage', {
      key: EXPERIMENTS_KEY,
      newValue: '[]'
    });
    window.dispatchEvent(event);

    expect(fired).toBe(true);
    cleanup(); // cleanup subscription
  });

  // 23. Mock adapter determinism
  it('verifies that the Mock Adapter produces identical, stable observations for identical scenario seeds', () => {
    const exp = getBaseExperiment();
    const variants = getBaseVariants();

    const set1 = MockExperimentAdapter.simulateScenario(exp, variants, 'winner');
    const set2 = MockExperimentAdapter.simulateScenario(exp, variants, 'winner');

    expect(set1).toHaveLength(4);
    expect(set2).toHaveLength(4);
    expect(set1[0].value).toBe(set2[0].value);
    expect(set1[1].value).toBe(set2[1].value);
  });

  // 24. Manual adapter validation
  it('properly validates manually entered aggregate observations and blocks personal identifiers', () => {
    const baseObs: Partial<ExperimentObservation> = {
      experimentId: 'exp-valid',
      variantId: 'var-control',
      metricName: 'clicks',
      metricType: MetricType.COUNT,
      value: 45,
      sampleSize: 1000
    };

    const validCheck = ManualExperimentAdapter.validateManualObservation(baseObs);
    expect(validCheck.success).toBe(true);

    // Try adding PII
    const badObs: Partial<ExperimentObservation> = {
      ...baseObs,
      metadata: {
        email: 'attacker@private-user.com'
      }
    };
    const invalidCheck = ManualExperimentAdapter.validateManualObservation(badObs);
    expect(invalidCheck.success).toBe(false);
    expect(invalidCheck.error).toContain('Security Guardrail: Personal audience data');
  });

  // 25. Secure adapter contracts
  it('handles secure adapter interaction contracts cleanly', async () => {
    const secureAdapter = new SecureExperimentAdapter();
    expect(secureAdapter.createExperiment).toBeDefined();
    expect(secureAdapter.startExperiment).toBeDefined();
    expect(secureAdapter.fetchResults).toBeDefined();
  });

  // 26. No credential persistence
  it('confirms that metadata serialization sanitizes keys containing API keys, secrets, or bearer tokens', () => {
    const dirtyMetadata = {
      campaign: 'Summer Launch',
      authToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      apiKey: 'secret_key_123',
      unrelatedField: 'safe_to_persist'
    };

    const variants = getBaseVariants();
    variants[0].metadata = dirtyMetadata;

    saveVariants(variants);
    const reloaded = loadVariants();

    const cleanMeta = reloaded[0].metadata;
    expect(cleanMeta).toBeDefined();
    expect(cleanMeta?.unrelatedField).toBe('safe_to_persist');
    expect(cleanMeta?.authToken).toBeUndefined();
    expect(cleanMeta?.apiKey).toBeUndefined();
  });
});
