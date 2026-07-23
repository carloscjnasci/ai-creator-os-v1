import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { 
  Experiment, 
  ExperimentVariant, 
  ExperimentObservation, 
  ExperimentType,
  ExperimentStatus, 
  MetricType 
} from '../types';
import { 
  loadExperiments, 
  saveExperiments, 
  loadVariants, 
  saveVariants, 
  loadObservations, 
  saveObservations,
  loadDecisions,
  saveDecisions
} from '../experimentStorage';
import { 
  editDraftExperiment, 
  applyDecisionWorkflow
} from '../experimentWorkflow';
import { experimentObservationSchema } from '../experimentSchemas';
import { initializeExperimentEventConsumer } from '../experimentEvents';
import { 
  convertSnapshotToObservations, 
  generatePublicationDraftForVariant, 
  getDigitalHumanExperimentSummary,
  createFollowUpCampaignFromWinner
} from '../integrations';
import { 
  createWorkspaceBackup, 
  validateWorkspaceBackup, 
  deepSanitizeSensitiveKeys 
} from '@/features/settings/workspaceBackup';
import { loadPublicationDrafts } from '../../publishing-hub/lib/publishingStorage';
import { publishCreativeEvent } from '../../../core/events/creativeEventBus';
import { MockExperimentAdapter } from '../adapters/mockExperimentAdapter';

// Helpers to build base compliant entities
function getBaseExperiment(overrides: Partial<Experiment> = {}): Experiment {
  return {
    id: 'exp-test-123',
    workspaceId: 'ws_test',
    name: 'Standard Hook A/B Test',
    description: 'Testing standard versus high-impact hook variations.',
    hypothesis: 'A high-impact hook will increase the TikTok click-through rate.',
    objective: 'Increase click-through rate by 10%.',
    campaignId: 'camp_test_123',
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  } as any;
}

function getBaseVariant(overrides: Partial<ExperimentVariant> = {}): ExperimentVariant {
  return {
    id: 'var-test-123',
    experimentId: 'exp-test-123',
    name: 'Control Hook (Base)',
    description: 'The baseline video hook.',
    variantKey: 'control',
    isControl: true,
    allocationWeight: 50,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  } as any;
}

function getBaseObservation(overrides: Partial<ExperimentObservation> = {}): ExperimentObservation {
  return {
    id: 'obs-test-123',
    experimentId: 'exp-test-123',
    variantId: 'var-test-123',
    metricName: 'ctr',
    metricType: MetricType.RATE,
    value: 0.05,
    sampleSize: 1000,
    capturedAt: new Date().toISOString(),
    metricWindow: '7d',
    source: 'test-source',
    isEstimated: false,
    ...overrides
  } as any;
}

describe('Experimentation Engine Part 2 - Workflows & Integrations', () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => store[key] || null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, val) => {
      store[key] = String(val);
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
      delete store[key];
    });
    vi.spyOn(Storage.prototype, 'clear').mockImplementation(() => {
      store = {};
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('verifies clone-on-edit logic for draft versus non-draft experiments', () => {
    const exp = getBaseExperiment({
      id: 'exp-edit-test',
      status: ExperimentStatus.DRAFT,
      name: 'Original Name',
    });
    saveExperiments([exp]);

    // Editing draft should update in-place
    const resDraft = editDraftExperiment('exp-edit-test', { name: 'Updated In-Place' });
    expect(resDraft.success).toBe(true);
    expect(loadExperiments()[0].name).toBe('Updated In-Place');

    // Editing running experiment should trigger clone-on-edit pattern
    const exps = loadExperiments();
    exps[0].status = ExperimentStatus.RUNNING;
    saveExperiments(exps);

    const resRunning = editDraftExperiment('exp-edit-test', { name: 'Cloned Edit' });
    expect(resRunning.success).toBe(true);
    
    const allExps = loadExperiments();
    expect(allExps.length).toBe(2);
    const cloned = allExps.find(e => e.name === 'Cloned Edit');
    expect(cloned).toBeDefined();
    expect(cloned?.status).toBe(ExperimentStatus.DRAFT);
  });

  it('runs analytics conversion from performance snapshots and prevents duplicate ingestion', () => {
    const exp = getBaseExperiment({
      id: 'exp-anal-1',
      status: ExperimentStatus.RUNNING,
      primaryMetric: 'ctr',
    });
    const variant = getBaseVariant({
      id: 'var-anal-1',
      experimentId: 'exp-anal-1',
      variantKey: 'treatment_suit',
      isControl: false,
    });

    saveExperiments([exp]);
    saveVariants([variant]);

    const snapshot = {
      id: 'perf-snap-100',
      ctr: 0.052,
      impressions: 1000,
      metricWindow: '7d',
      platform: 'tiktok'
    };

    // First conversion succeeds
    const res1 = convertSnapshotToObservations(snapshot, 'var-anal-1');
    expect(res1.success).toBe(true);
    expect(res1.observationsIngested).toBeGreaterThan(0);

    const firstObsCount = loadObservations().length;

    // Second conversion of same snapshot ID skips duplicate observations
    const res2 = convertSnapshotToObservations(snapshot, 'var-anal-1');
    expect(res2.success).toBe(true);
    expect(res2.observationsIngested).toBe(0); // Deduplicated!
    expect(loadObservations().length).toBe(firstObsCount);
  });

  it('generates linked publication drafts for variants uniquely', () => {
    const exp = getBaseExperiment({
      id: 'exp-pub-1',
      status: ExperimentStatus.DRAFT,
    });
    const variant = getBaseVariant({
      id: 'var-pub-1',
      experimentId: 'exp-pub-1',
      variantKey: 'var_pub',
      isControl: false,
    });

    saveExperiments([exp]);
    saveVariants([variant]);

    const res1 = generatePublicationDraftForVariant('exp-pub-1', 'var-pub-1', 'mock');
    expect(res1.success).toBe(true);
    expect(res1.draft).toBeDefined();

    // Secondary calls are idempotent and return the same draft ID without duplicating
    const res2 = generatePublicationDraftForVariant('exp-pub-1', 'var-pub-1', 'mock');
    expect(res2.success).toBe(true);
    expect(res2.draft?.id).toBe(res1.draft?.id);
  });

  it('aggregates digital human experiment results with limitations checks', () => {
    const exp = getBaseExperiment({
      id: 'exp-dh-1',
      status: ExperimentStatus.RUNNING,
      primaryMetric: 'ctr',
      platform: 'tiktok',
    });
    const control = getBaseVariant({
      id: 'var-dh-control',
      experimentId: 'exp-dh-1',
      variantKey: 'casual',
      isControl: true,
      digitalHumanId: 'dh-aurora',
    });
    const treatment = getBaseVariant({
      id: 'var-dh-treatment',
      experimentId: 'exp-dh-1',
      variantKey: 'suit',
      isControl: false,
      digitalHumanId: 'dh-aurora',
    });

    saveExperiments([exp]);
    saveVariants([control, treatment]);

    // Add observations
    const obsControl = getBaseObservation({
      id: 'obs-dh-c',
      experimentId: 'exp-dh-1',
      variantId: 'var-dh-control',
      metricName: 'ctr',
      metricType: MetricType.RATE,
      value: 0.040,
      sampleSize: 500,
    });
    const obsTreatment = getBaseObservation({
      id: 'obs-dh-t',
      experimentId: 'exp-dh-1',
      variantId: 'var-dh-treatment',
      metricName: 'ctr',
      metricType: MetricType.RATE,
      value: 0.060,
      sampleSize: 600,
    });
    saveObservations([obsControl, obsTreatment]);

    const summary = getDigitalHumanExperimentSummary('dh-aurora');
    expect(summary.digitalHumanId).toBe('dh-aurora');
    expect(summary.experimentsParticipated).toBe(1);
    expect(summary.averageLiftVersusControl).toBeCloseTo(0.5, 2); // 0.06 vs 0.04 is +50% lift
    expect(summary.limitations.length).toBeGreaterThan(0); // Due to low sample size / low tests count
  });

  it('supports scaling follow-up campaign generation once decision is committed', () => {
    const exp = getBaseExperiment({
      id: 'exp-scale-1',
      status: ExperimentStatus.EVALUATING,
      campaignId: 'camp-scale-original',
    });
    const control = getBaseVariant({
      id: 'var-scale-control',
      experimentId: 'exp-scale-1',
      variantKey: 'control',
      isControl: true,
      digitalHumanId: 'dh-aurora',
      productId: 'prod-scale-1',
    });
    const winner = getBaseVariant({
      id: 'var-scale-winner',
      experimentId: 'exp-scale-1',
      variantKey: 'winner_outfit',
      isControl: false,
      digitalHumanId: 'dh-aurora',
      productId: 'prod-scale-1',
    });

    saveExperiments([exp]);
    saveVariants([control, winner]);

    // Set decision mock
    const decisions = [
      {
        id: 'dec-scale-1',
        experimentId: 'exp-scale-1',
        recommendationId: 'rec-scale-1',
        decision: 'accept_winner' as const,
        rationale: 'Accept winner based on statistically significant CTR lift',
        selectedVariantId: 'var-scale-winner',
        pVal: 0.012,
        confidence: 0.98,
        createdBy: 'user-admin',
        createdAt: new Date().toISOString()
      }
    ];
    saveDecisions(decisions);

    const followUpRes = createFollowUpCampaignFromWinner('exp-scale-1', 'Scaled Growth Campaign');
    expect(followUpRes.success).toBe(true);
    expect(followUpRes.campaign).toBeDefined();
    expect(followUpRes.campaign?.characterId).toBe('dh-aurora');
    expect(followUpRes.campaign?.productId).toBe('prod-scale-1');
  });

  it('upgrades and validates Version 8 backups with full recursive credential removal', () => {
    // Check deep sanitization
    const payloadWithSecrets = {
      username: 'user123',
      apiConfig: {
        password: 'super-secret-password',
        authToken: 'jwt-refresh-token-here',
        clientId: 'public-id',
        clientSecret: 'secret-key-123'
      },
      imageField: 'data:image/png;base64,iVBORw0KGgoAAAANS...',
      personalEmail: 'johndoe@personal.com'
    };

    const sanitized = deepSanitizeSensitiveKeys(payloadWithSecrets);
    expect(sanitized.username).toBe('user123');
    expect(sanitized.apiConfig.clientId).toBe('public-id');
    expect(sanitized.apiConfig.password).toBeUndefined(); // Stripped!
    expect(sanitized.apiConfig.authToken).toBeUndefined(); // Stripped!
    expect(sanitized.apiConfig.clientSecret).toBeUndefined(); // Stripped!
    expect(sanitized.imageField).toBeUndefined(); // Large base64 stripped!
    expect(sanitized.personalEmail).toBeUndefined(); // Personal fields stripped!

    // Verify workspace v10 backup validation
    const backup = createWorkspaceBackup();
    expect(backup.version).toBe(10);

    const isValid = validateWorkspaceBackup(backup);
    expect(isValid).toBe(true);

    // Verify v1-v7 backward compatibility (lower versions parse safely)
    const legacyBackup = {
      ...backup,
      version: 7,
      experiments: undefined,
      experimentVariants: undefined,
      observations: undefined,
      assignments: undefined,
      analyses: undefined,
      experimentRecommendations: undefined,
      decisions: undefined,
      secureConnectorState: undefined,
      syncJobMetadata: undefined,
      learningSignals: undefined
    };
    expect(validateWorkspaceBackup(legacyBackup)).toBe(true);
  });

  it('enforces strict observation validation limits for count, rate, and score types', () => {
    // 1. Ingestion limits / validation schema
    
    // Rate metric must be between 0 and 1
    const invalidRate = getBaseObservation({
      metricType: MetricType.RATE,
      value: 1.5,
    });
    const parsedRate = experimentObservationSchema.safeParse(invalidRate);
    expect(parsedRate.success).toBe(false);

    // Count metric must be non-negative
    const invalidCount = getBaseObservation({
      metricType: MetricType.COUNT,
      value: -10,
    });
    const parsedCount = experimentObservationSchema.safeParse(invalidCount);
    expect(parsedCount.success).toBe(false);

    // Score metric must be between 0 and 100
    const invalidScore = getBaseObservation({
      metricType: MetricType.SCORE,
      value: 120,
    });
    const parsedScore = experimentObservationSchema.safeParse(invalidScore);
    expect(parsedScore.success).toBe(false);
  });

  it('verifies atomic rollback of storage modifications under QuotaExceededError in applyDecisionWorkflow', () => {
    const exp = getBaseExperiment({ id: 'exp-atomic-1', status: ExperimentStatus.RUNNING, campaignId: 'camp-atomic-1' });
    const control = getBaseVariant({ id: 'var-ctrl-1', experimentId: 'exp-atomic-1', isControl: true });
    const treatment = getBaseVariant({ id: 'var-treat-1', experimentId: 'exp-atomic-1', isControl: false, hook: 'Atomic Hook' });
    
    saveExperiments([exp]);
    saveVariants([control, treatment]);

    // Save initial state
    const originalDrafts = loadPublicationDrafts();

    // Mock setItem to throw QuotaExceededError when saving drafts
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, val) => {
      if (key === 'ai-creator-os.publication-drafts.v1') {
        throw new Error('QuotaExceededError');
      }
      store[key] = String(val);
      return true;
    });

    const res = applyDecisionWorkflow({
      experimentId: 'exp-atomic-1',
      recommendationId: 'rec-atomic-1',
      decision: 'accept_winner',
      rationale: 'Accept winner',
      selectedVariantId: 'var-treat-1',
      createdBy: 'test-admin',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Quota exceeded');

    // Restore spy and verify drafts remains completely unmodified (rolled back!)
    setItemSpy.mockRestore();
    expect(loadPublicationDrafts()).toEqual(originalDrafts);
  });

  it('guarantees that event bus clear (workspace.cleared) purges all keys and leaves no orphans', () => {
    const exp = getBaseExperiment();
    saveExperiments([exp]);
    expect(loadExperiments().length).toBe(1);

    const cleanup = initializeExperimentEventConsumer();

    // Trigger workspace clear event
    publishCreativeEvent('workspace.cleared', {});

    // Expect all storage tables to be completely empty
    expect(loadExperiments().length).toBe(0);
    expect(loadVariants().length).toBe(0);
    expect(loadObservations().length).toBe(0);
    expect(loadDecisions().length).toBe(0);

    cleanup();
  });

  it('proves there is no Math.random in production Experimentation code', () => {
    const fs = require('fs');
    const path = require('path');
    
    function scanDir(dir: string) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          // Skip test files
          if (file.includes('.test.') || file.includes('spec.')) {
            continue;
          }
          const content = fs.readFileSync(fullPath, 'utf8');
          expect(content).not.toContain('Math.random()');
        }
      }
    }
    
    scanDir(path.join(__dirname, '..'));
  });

  it('guarantees deterministic mock observations and deterministic observation IDs', () => {
    const exp = getBaseExperiment();
    const vars = [
      { id: 'var-ctrl', experimentId: exp.id, name: 'Control', variantKey: 'control', isControl: true, allocationWeight: 50, description: '', createdAt: '', updatedAt: '' },
      { id: 'var-treat', experimentId: exp.id, name: 'Treatment', variantKey: 'treatment', isControl: false, allocationWeight: 50, description: '', createdAt: '', updatedAt: '' }
    ];

    const obs1 = MockExperimentAdapter.simulateScenario(exp, vars, 'winner');
    const obs2 = MockExperimentAdapter.simulateScenario(exp, vars, 'winner');

    expect(obs1).toEqual(obs2);
    expect(obs1[0].id).toBe('mock-obs-ctrl-primary-exp-test-123');
  });

  it('guarantees analytics.snapshot.analyzed event creates observations idempotently without auto-evaluating', async () => {
    const exp = getBaseExperiment();
    const variant = { id: 'var-snap-1', experimentId: exp.id, name: 'V1', variantKey: 'v1', isControl: false, allocationWeight: 100, description: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    saveExperiments([exp]);
    saveVariants([variant]);
    saveObservations([]);

    const cleanup = initializeExperimentEventConsumer();

    const snapshotPayload = {
      snapshot: {
        id: 'snap-perf-999',
        campaignId: 'camp-123',
        platform: 'tiktok',
        metricWindow: '7d',
        ctr: 0.082,
        impressions: 5000,
        clicks: 410,
      },
      variantId: 'var-snap-1',
      experimentId: exp.id,
    };

    // 1. First event publish
    publishCreativeEvent('analytics.snapshot.analyzed', snapshotPayload);

    // Give microtasks time to run (since event bus and imports are async)
    await new Promise(resolve => setTimeout(resolve, 50));

    const obsAfterFirst = loadObservations();
    expect(obsAfterFirst.length).toBe(3); // CTR, clicks and impressions
    const ctrObs = obsAfterFirst.find(o => o.metricName === 'ctr');
    expect(ctrObs).toBeDefined();
    expect(ctrObs?.value).toBe(0.082);
    expect(ctrObs?.sampleSize).toBe(5000);
    expect(ctrObs?.performanceSnapshotId).toBe('snap-perf-999');

    // 2. Repeated event publish (idempotency check)
    publishCreativeEvent('analytics.snapshot.analyzed', snapshotPayload);
    await new Promise(resolve => setTimeout(resolve, 50));

    const obsAfterSecond = loadObservations();
    expect(obsAfterSecond.length).toBe(3); // no duplicates created!

    // 3. Event without valid variantId or experimentId creates nothing
    const countBeforeInvalid = loadObservations().length;
    publishCreativeEvent('analytics.snapshot.analyzed', {
      snapshot: { id: 'snap-invalid', ctr: 0.1 },
      variantId: 'non-existent-variant'
    });
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(loadObservations().length).toBe(countBeforeInvalid);

    // 4. Verify no evaluation occurred (status remains READY, does not change to COMPLETED or EVALUATING)
    const currentExp = loadExperiments().find(e => e.id === exp.id);
    expect(currentExp?.status).toBe(ExperimentStatus.DRAFT);

    cleanup();
  });

  it('guarantees publishing events fabricate no performance observations and do not auto-evaluate', async () => {
    const exp = getBaseExperiment();
    const variant = { 
      id: 'var-pub-1', 
      experimentId: exp.id, 
      name: 'V1', 
      variantKey: 'v1', 
      isControl: false, 
      allocationWeight: 100, 
      description: '',
      createdAt: new Date().toISOString(), 
      updatedAt: new Date().toISOString(),
      creativeLibraryAssetId: 'asset-999'
    };
    saveExperiments([exp]);
    saveVariants([variant]);
    saveObservations([]);

    const cleanup = initializeExperimentEventConsumer();

    const fullyCompliantDraft = {
      id: 'pub-draft-999',
      workspaceId: exp.workspaceId || 'ws_test',
      campaignId: exp.campaignId || 'camp_test_123',
      platform: 'generic',
      title: 'Variant Publication',
      caption: 'Testing variant',
      status: 'draft',
      creativeAssetId: 'asset-999',
      experimentId: exp.id,
      variantId: 'var-pub-1',
      hashtags: [],
      mentions: [],
      approvalRequired: false,
      timezone: 'UTC',
      adapterMode: 'mock',
      validation: {
        valid: true,
        issues: [],
        checkedAt: new Date().toISOString(),
        policyVersion: '1.0.0'
      },
      idempotencyKey: 'pub-idempotency-999',
      attemptCount: 0,
      metricsStatus: 'not-requested',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Mock localStorage item representing the publication draft
    localStorage.setItem('ai-creator-os.publication-drafts.v1', JSON.stringify([fullyCompliantDraft]));

    // Publish succeeded event
    publishCreativeEvent('publishing.job.succeeded', { draftId: 'pub-draft-999' });
    await new Promise(resolve => setTimeout(resolve, 50));

    // Verify no performance observations were fabricated
    const obs = loadObservations();
    expect(obs.length).toBe(0);

    // Verify lineage was updated on the variant
    const updatedVariant = loadVariants().find(v => v.id === 'var-pub-1');
    expect(updatedVariant?.publicationDraftId).toBe('pub-draft-999');

    // Verify no evaluation occurred
    const currentExp = loadExperiments().find(e => e.id === exp.id);
    expect(currentExp?.status).toBe(ExperimentStatus.DRAFT);

    cleanup();
  });

  it('guarantees complete workspace clearance of all keys including connector state, sync-job metadata, and learning signals', () => {
    // Seed all 10 keys
    localStorage.setItem('ai_creator_os:experiments', '[]');
    localStorage.setItem('ai_creator_os:experiment_variants', '[]');
    localStorage.setItem('ai_creator_os:experiment_observations', '[]');
    localStorage.setItem('ai_creator_os:experiment_assignments', '[]');
    localStorage.setItem('ai_creator_os:experiment_analyses', '[]');
    localStorage.setItem('ai_creator_os:experiment_recommendations', '[]');
    localStorage.setItem('ai_creator_os:experiment_decisions', '[]');
    localStorage.setItem('ai_creator_os:experiment_secure_connector_state', '{"connected": true}');
    localStorage.setItem('ai_creator_os:experiment_sync_job_metadata', '{"syncing": false}');
    localStorage.setItem('ai_creator_os:experiment_learning_signals', '[]');

    const cleanup = initializeExperimentEventConsumer();

    // Trigger workspace.cleared
    publishCreativeEvent('workspace.cleared', {});

    // Verify all keys are completely removed
    expect(localStorage.getItem('ai_creator_os:experiments')).toBeNull();
    expect(localStorage.getItem('ai_creator_os:experiment_variants')).toBeNull();
    expect(localStorage.getItem('ai_creator_os:experiment_observations')).toBeNull();
    expect(localStorage.getItem('ai_creator_os:experiment_assignments')).toBeNull();
    expect(localStorage.getItem('ai_creator_os:experiment_analyses')).toBeNull();
    expect(localStorage.getItem('ai_creator_os:experiment_recommendations')).toBeNull();
    expect(localStorage.getItem('ai_creator_os:experiment_decisions')).toBeNull();
    expect(localStorage.getItem('ai_creator_os:experiment_secure_connector_state')).toBeNull();
    expect(localStorage.getItem('ai_creator_os:experiment_sync_job_metadata')).toBeNull();
    expect(localStorage.getItem('ai_creator_os:experiment_learning_signals')).toBeNull();

    cleanup();
  });
});
