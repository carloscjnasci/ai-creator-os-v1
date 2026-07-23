import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { 
  AnalyticsPlatform, 
  AnalyticsSourceType, 
  MetricWindow, 
  SnapshotStatus, 
  PerformanceSnapshot, 
  RecommendationStatus 
} from '../types';
import { 
  performanceSnapshotSchema 
} from '../analyticsFeedbackSchemas';
import { 
  isValidTransition, 
  transitionSnapshot 
} from '../analyticsFeedback';
import { 
  loadSnapshots, 
  saveSnapshots, 
  subscribeToStorageChanges, 
  SNAPSHOTS_KEY 
} from '../analyticsFeedbackStorage';
import { 
  normalizeAndDeriveMetrics 
} from '../metricNormalizer';
import { 
  attributeSnapshot 
} from '../attributionEngine';
import { 
  generateScorecard 
} from '../scorecardEngine';
import { 
  detectOutliers 
} from '../outlierEngine';
import { 
  generateInsights 
} from '../insightEngine';
import { 
  generateRecommendations, 
  isValidRecommendationTransition 
} from '../recommendationEngine';
import { 
  MockAnalyticsAdapter 
} from '../adapters/mockAnalyticsAdapter';
import { 
  ManualAnalyticsAdapter 
} from '../adapters/manualAnalyticsAdapter';
import { 
  SecureAnalyticsAdapter 
} from '../adapters/secureAnalyticsAdapter';
import {
  trackPublicationSuccess,
  ingestPerformanceSnapshot,
  acceptRecommendation,
  rejectRecommendation,
  applyRecommendation,
  undoRecommendation,
  clearAllAnalyticsFeedbackData,
  calibrateViralScore
} from '../analyticsFeedbackWorkflow';

// Create a helper to generate a robust baseline snapshot for test usage
const getBaseSnapshot = (overrides?: Partial<PerformanceSnapshot>): PerformanceSnapshot => ({
  id: 'snap-123',
  workspaceId: 'work-abc',
  platform: AnalyticsPlatform.TIKTOK,
  sourceType: AnalyticsSourceType.MOCK_CONNECTOR,
  status: SnapshotStatus.DRAFT,
  metricWindow: MetricWindow.FIRST_24_HOURS,
  periodStart: '2026-07-16T00:00:00.000Z',
  periodEnd: '2026-07-16T12:00:00.000Z',
  capturedAt: '2026-07-16T12:05:00.000Z',
  currency: 'USD',
  createdAt: '2026-07-16T12:05:00.000Z',
  updatedAt: '2026-07-16T12:05:00.000Z',
  ...overrides,
});

describe('Analytics Feedback Loop - Part 1 Unit Tests', () => {
  
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return (this as any).store[key] || null;
      },
      setItem(key: string, value: string) {
        (this as any).store[key] = value.toString();
      },
      removeItem(key: string) {
        delete (this as any).store[key];
      },
      clear() {
        (this as any).store = {};
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // 1. Snapshot schema validation
  it('passes schema validation for correctly structured snapshots', () => {
    const valid = getBaseSnapshot({
      impressions: 5000,
      likes: 120,
      ctr: 0.05,
    });
    const parsed = performanceSnapshotSchema.parse(valid);
    expect(parsed.id).toBe('snap-123');
    expect(parsed.ctr).toBe(0.05);
  });

  // 2. Invalid negative metrics
  it('rejects snapshots containing negative metric values', () => {
    const invalid = getBaseSnapshot({
      impressions: -100, // Invalid negative counter
    });
    const parsed = performanceSnapshotSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  // 3. Invalid dates
  it('rejects snapshots where periodEnd is prior to periodStart', () => {
    const invalid = getBaseSnapshot({
      periodStart: '2026-07-16T12:00:00.000Z',
      periodEnd: '2026-07-16T00:00:00.000Z', // Prior!
    });
    const parsed = performanceSnapshotSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  // 4. Derived metric formulas
  it('correctly calculates derived engagement rate, CTR, CVR, and ROAS formulas', () => {
    const snap = getBaseSnapshot({
      impressions: 10000,
      views: 8000,
      likes: 400,
      comments: 50,
      shares: 30,
      saves: 20,
      clicks: 500,
      purchases: 25,
      spend: 200,
      revenue: 1000,
    });
    const { normalized } = normalizeAndDeriveMetrics(snap);
    // Engagement rate = (400+50+30+20)/8000 = 500/8000 = 0.0625 (6.25%)
    expect(normalized.engagementRate).toBeCloseTo(0.0625);
    // CTR = 500 / 10000 = 0.05
    expect(normalized.ctr).toBe(0.05);
    // CVR = 25 / 500 = 0.05
    expect(normalized.cvr).toBe(0.05);
    // ROAS = 1000 / 200 = 5
    expect(normalized.roas).toBe(5);
  });

  // 5. Division-by-zero protection
  it('safely handles zero-denominators without throwing division by zero errors', () => {
    const zeroDenominator = getBaseSnapshot({
      impressions: 0,
      views: 0,
      clicks: 0,
      spend: 0,
    });
    expect(() => {
      const { normalized } = normalizeAndDeriveMetrics(zeroDenominator);
      expect(normalized.ctr).toBeUndefined();
      expect(normalized.cvr).toBeUndefined();
      expect(normalized.roas).toBeUndefined();
    }).not.toThrow();
  });

  // 6. Estimated metric labeling
  it('labels derived metrics as estimated when falling back to suboptimal inputs', () => {
    const fallbackSnap = getBaseSnapshot({
      views: 1000,
      clicks: 50,
      likes: 20,
      // impressions is undefined! CTR will fall back to using views as denominator
    });
    const { formulasApplied } = normalizeAndDeriveMetrics(fallbackSnap);
    expect(formulasApplied.ctr).toBeDefined();
    expect(formulasApplied.ctr.isExact).toBe(false); // labeled as estimate
    expect(formulasApplied.ctr.confidence).toBeLessThan(1.0);
  });

  // 7. Attribution with complete lineage
  it('returns high confidence and complete list of entities for fully populated lineage paths', () => {
    const complete = getBaseSnapshot({
      publicationDraftId: 'draft-1',
      publicationJobId: 'job-1',
      campaignId: 'camp-1',
      creativeIntentId: 'intent-1',
      creativePlanId: 'plan-1',
      executionId: 'exec-1',
      executionTaskId: 'task-1',
      providerJobId: 'prov-1',
      cloudAssetId: 'asset-1',
      creativeLibraryAssetId: 'lib-1',
      promptHistoryId: 'prompt-1',
      digitalHumanId: 'human-1',
      productId: 'prod-1',
      wardrobeItemId: 'ward-1',
      sceneId: 'scene-1',
    });
    const result = attributeSnapshot(complete);
    expect(result.confidence).toBe(1.0);
    expect(result.unresolvedEntities).toHaveLength(0);
    expect(result.resolvedEntities.digitalHuman).toBe(true);
  });

  // 8. Attribution with incomplete lineage
  it('reports missing lineage links and low confidence for sparse lineage paths', () => {
    const incomplete = getBaseSnapshot({
      campaignId: 'camp-1',
      digitalHumanId: 'human-1',
    });
    const result = attributeSnapshot(incomplete);
    expect(result.confidence).toBeLessThan(0.5);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.resolvedEntities.campaign).toBe(true);
    expect(result.resolvedEntities.product).toBe(false);
  });

  // 9. Score boundaries
  it('enforces overall scorecard output boundaries to remain within 0 to 100 inclusive', () => {
    const lowSnap = getBaseSnapshot({ views: 0, likes: 0, clicks: 0 });
    const lowScorecard = generateScorecard(lowSnap);
    expect(lowScorecard.overallScore).toBeGreaterThanOrEqual(0);
    expect(lowScorecard.overallScore).toBeLessThanOrEqual(100);

    const highSnap = getBaseSnapshot({
      views: 500000,
      impressions: 500000,
      likes: 120000,
      comments: 10000,
      shares: 40000,
      saves: 50000,
      completionRate: 0.99,
      engagementRate: 0.99,
      clicks: 80000,
      purchases: 12000,
      revenue: 50000,
      spend: 2000,
      roas: 25.0,
    });
    const highScorecard = generateScorecard(highSnap);
    expect(highScorecard.overallScore).toBeGreaterThanOrEqual(0);
    expect(highScorecard.overallScore).toBeLessThanOrEqual(100);
  });

  // 10. Predicted versus observed gap
  it('calculates the prediction gap, overprediction, and underprediction fields on scorecard creation', () => {
    const snap = getBaseSnapshot({
      metadata: { predictedViralScore: 85 }
    });
    // This snapshot will yield some moderate scorecard overallScore, let's say 50.
    const scorecard = generateScorecard(snap);
    expect(scorecard.predictedViralScore).toBe(85);
    expect(scorecard.observedPerformanceScore).toBe(scorecard.overallScore);
    expect(scorecard.predictionGap).toBe(Math.abs(85 - scorecard.overallScore));
    if (85 > scorecard.overallScore) {
      expect(scorecard.overprediction).toBe(true);
      expect(scorecard.underprediction).toBe(false);
    } else {
      expect(scorecard.overprediction).toBe(false);
      expect(scorecard.underprediction).toBe(true);
    }
  });

  // 11. Insufficient-history outlier handling
  it('makes no outlier claims when matching historical baseline size is below threshold', () => {
    const current = getBaseSnapshot({ views: 10000, campaignId: 'camp-1' });
    const sparseHistory = [
      getBaseSnapshot({ id: 'hist-1', views: 50, campaignId: 'camp-1' }),
    ]; // Only 1 historical match, threshold is 3
    const outliers = detectOutliers(current, sparseHistory, 'views', { minSampleSize: 3 });
    expect(outliers).toHaveLength(0);
  });

  // 12. Positive outlier
  it('detects a positive outlier when metric exceeds baseline by configurable threshold', () => {
    const current = getBaseSnapshot({ views: 10000, campaignId: 'camp-1' });
    const history = [
      getBaseSnapshot({ id: 'hist-1', views: 1000, campaignId: 'camp-1' }),
      getBaseSnapshot({ id: 'hist-2', views: 1200, campaignId: 'camp-1' }),
      getBaseSnapshot({ id: 'hist-3', views: 800, campaignId: 'camp-1' }),
    ]; // Baseline average = 1000. 10000 / 1000 = 10x lift.
    const outliers = detectOutliers(current, history, 'views', { minSampleSize: 3 });
    expect(outliers.length).toBeGreaterThan(0);
    const result = outliers.find(o => o.comparisonGroup === 'campaign_baseline');
    expect(result).toBeDefined();
    expect(result?.isPositiveOutlier).toBe(true);
    expect(result?.relativeLift).toBe(10);
  });

  // 13. Negative outlier
  it('detects a negative outlier when metric drop-off is below configurable threshold', () => {
    const current = getBaseSnapshot({ views: 100, campaignId: 'camp-1' });
    const history = [
      getBaseSnapshot({ id: 'hist-1', views: 1000, campaignId: 'camp-1' }),
      getBaseSnapshot({ id: 'hist-2', views: 1200, campaignId: 'camp-1' }),
      getBaseSnapshot({ id: 'hist-3', views: 800, campaignId: 'camp-1' }),
    ]; // Baseline = 1000. Observed = 100. Lift = 0.1 (10% of baseline).
    const outliers = detectOutliers(current, history, 'views', { minSampleSize: 3 });
    expect(outliers.length).toBeGreaterThan(0);
    const result = outliers.find(o => o.comparisonGroup === 'campaign_baseline');
    expect(result).toBeDefined();
    expect(result?.isNegativeOutlier).toBe(true);
    expect(result?.relativeLift).toBe(0.1);
  });

  // 14. Deterministic mock adapter
  it('returns exact static deterministic metrics for MockAnalyticsAdapter scenarios', async () => {
    const successSnapshots = await MockAnalyticsAdapter.fetchSnapshots('VIRAL_SUCCESS', 'work-123');
    expect(successSnapshots).toHaveLength(1);
    expect(successSnapshots[0].views).toBe(100000);
    expect(successSnapshots[0].spend).toBe(1500);

    const failSnapshots = await MockAnalyticsAdapter.fetchSnapshots('FAILED_INGESTION', 'work-123');
    expect(failSnapshots).toHaveLength(1);
    expect(failSnapshots[0].status).toBe(SnapshotStatus.FAILED);
  });

  // 15. Manual adapter validation
  it('parses manual user entry, validates with schema, and throws on invalid attributes', () => {
    // Valid entry
    const valid = ManualAnalyticsAdapter.processManualEntry({
      id: 'manual-1',
      workspaceId: 'work-abc',
      platform: AnalyticsPlatform.INSTAGRAM_REELS,
      metricWindow: MetricWindow.FIRST_24_HOURS,
      periodStart: '2026-07-16T00:00:00.000Z',
      periodEnd: '2026-07-16T12:00:00.000Z',
      currency: 'USD',
      views: 5000,
      likes: 200,
    });
    expect(valid.views).toBe(5000);
    expect(valid.status).toBe(SnapshotStatus.VALIDATED);

    // Invalid negative entry - should throw Zod error
    expect(() => {
      ManualAnalyticsAdapter.processManualEntry({
        id: 'manual-1',
        workspaceId: 'work-abc',
        platform: AnalyticsPlatform.INSTAGRAM_REELS,
        metricWindow: MetricWindow.FIRST_24_HOURS,
        periodStart: '2026-07-16T00:00:00.000Z',
        periodEnd: '2026-07-16T12:00:00.000Z',
        currency: 'USD',
        views: -50, // Negative!
      });
    }).toThrow();
  });

  // 16. Secure adapter contract
  it('enforces REST interface request structure for future backend connection integration', async () => {
    const mockConnection = { id: 'conn-1', platform: AnalyticsPlatform.YOUTUBE, externalChannelId: 'yt-abc', channelName: 'YT Test', connectionStatus: 'active', connectedAt: '2026-07-16' };
    const mockFetch = vi.fn().mockImplementation(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve(mockConnection),
    }));
    vi.stubGlobal('fetch', mockFetch);

    const adapter = new SecureAnalyticsAdapter('/api/analytics');
    const result = await adapter.createConnectionRequest({
      platform: AnalyticsPlatform.YOUTUBE,
      workspaceId: 'work-123',
      authorizationCode: 'auth-123',
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/analytics/connections', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ platform: AnalyticsPlatform.YOUTUBE, workspaceId: 'work-123', authorizationCode: 'auth-123' }),
    }));
    expect(result.id).toBe('conn-1');
  });

  // 17. No OAuth token persistence
  it('ensures no OAuth credentials, access tokens, refresh tokens or secrets exist in classes or data structures', () => {
    // Audit types and values returned in Mock and Manual adapters
    const mockSnap = MockAnalyticsAdapter.getScenarioSnapshot('VIRAL_SUCCESS', 'work-123');
    const manualSnap = ManualAnalyticsAdapter.processManualEntry({
      id: 'm-1',
      workspaceId: 'w-1',
      platform: AnalyticsPlatform.TIKTOK,
      metricWindow: MetricWindow.FIRST_HOUR,
      periodStart: '2026-07-16T00:00:00.000Z',
      periodEnd: '2026-07-16T12:00:00.000Z',
      currency: 'USD',
    });

    // Check all values deep down for terms resembling tokens or credentials
    const inspectForTokens = (obj: any) => {
      const keysStr = JSON.stringify(obj).toLowerCase();
      expect(keysStr).not.toContain('accesstoken');
      expect(keysStr).not.toContain('refreshtoken');
      expect(keysStr).not.toContain('clientsecret');
      expect(keysStr).not.toContain('bearer');
    };

    inspectForTokens(mockSnap);
    inspectForTokens(manualSnap);
  });

  // 18. Storage failures
  it('safely catches quota exceptions on write failure and returns false instead of throwing', () => {
    // Stub localStorage to throw a QuotaExceededError
    vi.stubGlobal('localStorage', {
      setItem() {
        throw new Error('QuotaExceededError: LocalStorage limit reached');
      },
      getItem() { return null; }
    });

    const success = saveSnapshots([getBaseSnapshot()]);
    expect(success).toBe(false); // Handles write failure safely!
  });

  // 19. Storage subscription cleanup
  it('attaches storage listeners and cleans them up correctly', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const callback = vi.fn();
    const unsubscribe = subscribeToStorageChanges(SNAPSHOTS_KEY, callback);

    expect(addSpy).toHaveBeenCalledWith('storage', expect.any(Function));

    unsubscribe();
    expect(removeSpy).toHaveBeenCalledWith('storage', expect.any(Function));
  });

  // 20. Insight evidence
  it('generates insights with evidence fields containing metric descriptors, observed values, and baselines', () => {
    // Snapshot with hookRatio = 10% (30/300) -> Hook dropping!
    const snap = getBaseSnapshot({
      views: 300,
      threeSecondViews: 30,
    });
    const insights = generateInsights(snap);
    const hookInsight = insights.find(i => i.category === 'hook');
    expect(hookInsight).toBeDefined();
    expect(hookInsight?.evidence.metric).toBe('hookRatio');
    expect(hookInsight?.evidence.value).toBe(0.1);
    expect(hookInsight?.evidence.baseline).toBe(0.4);
    expect(hookInsight?.evidence.description).toContain('viewer');
  });

  // 21. Recommendation status transitions
  it('correctly validates permissible and impermissible recommendation status transitions', () => {
    // proposed -> accepted is valid
    expect(isValidRecommendationTransition(RecommendationStatus.PROPOSED, RecommendationStatus.ACCEPTED)).toBe(true);
    // accepted -> applied is valid
    expect(isValidRecommendationTransition(RecommendationStatus.ACCEPTED, RecommendationStatus.APPLIED)).toBe(true);
    // applied -> proposed is invalid
    expect(isValidRecommendationTransition(RecommendationStatus.APPLIED, RecommendationStatus.PROPOSED)).toBe(false);
    // proposed -> applied is invalid without being accepted first
    expect(isValidRecommendationTransition(RecommendationStatus.PROPOSED, RecommendationStatus.APPLIED)).toBe(false);
  });

  // 22. Idempotent trackPublicationSuccess
  it('tracks publication success idempotently and avoids duplicate snapshots', () => {
    const draftId = 'draft-id-123';
    const jobId = 'job-id-555';
    
    // First tracking call
    const track1 = trackPublicationSuccess(draftId, jobId, 'ext-post-888', 'https://permalink.com', 'camp-999');
    expect(track1).toBe(true);
    
    const snapshots1 = loadSnapshots();
    const match = snapshots1.filter(s => s.publicationDraftId === draftId && s.publicationJobId === jobId);
    expect(match).toHaveLength(1);
    expect(match[0].campaignId).toBe('camp-999');
    expect(match[0].status).toBe(SnapshotStatus.DRAFT);

    // Second tracking call with identical lineage
    const track2 = trackPublicationSuccess(draftId, jobId, 'ext-post-888', 'https://permalink.com', 'camp-999');
    expect(track2).toBe(true);

    const snapshots2 = loadSnapshots();
    const match2 = snapshots2.filter(s => s.publicationDraftId === draftId && s.publicationJobId === jobId);
    expect(match2).toHaveLength(1); // No duplicates!
  });

  // 23. Ingest Performance Snapshot Workflow end-to-end
  it('ingests a performance snapshot, normalizes, attributes, scorecards, and triggers events', () => {
    const freshSnap = getBaseSnapshot({
      id: 'snap-ingest-test',
      views: 20000,
      likes: 800,
      comments: 100,
      shares: 100,
      clicks: 500,
      purchases: 10,
      revenue: 500,
      spend: 100,
      campaignId: 'camp-xyz',
      promptHistoryId: 'prompt-abc',
      digitalHumanId: 'human-xyz'
    });

    const result = ingestPerformanceSnapshot(freshSnap);
    expect(result.success).toBe(true);
    expect(result.snapshot).toBeDefined();
    expect(result.scorecard).toBeDefined();

    // Verify normalization
    expect(result.snapshot?.engagementRate).toBe(0.05); // (800+100+100)/20000 = 1000/20000 = 0.05
    expect(result.snapshot?.status).toBe(SnapshotStatus.ATTRIBUTED);

    // Verify scorecard saving
    const scorecards = loadSnapshots();
    const storedSnap = scorecards.find(s => s.id === 'snap-ingest-test');
    expect(storedSnap).toBeDefined();
    expect(storedSnap?.status).toBe(SnapshotStatus.ATTRIBUTED);
  });

  // 24. Explicit User Decisions, Learning Context Sync, and Recommendations Patches
  it('synchronizes user accept/reject decisions with the Learning Context and creates applied decisions', () => {
    // Save a dummy recommendation to storage
    const recId = 'test-rec-999';
    const workspaceId = 'work-abc';
    const mockRec = {
      id: recId,
      workspaceId,
      recommendationType: 'strengthen_cta',
      evidence: ['Dummy evidence'],
      expectedEffect: 'Improve retention',
      confidence: 0.85,
      targetEntities: { prompt: 'prompt-xxx' },
      proposedChange: 'Shorten intro sequence',
      risk: 'Low',
      status: 'proposed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem('ai_creator_os:recommendations', JSON.stringify([mockRec]));

    // Accept recommendation
    const accepted = acceptRecommendation(recId, 'Looks highly reasonable');
    expect(accepted).toBe(true);

    const recsAfterAccept = JSON.parse(localStorage.getItem('ai_creator_os:recommendations') || '[]');
    expect(recsAfterAccept[0].status).toBe('accepted');
    expect(recsAfterAccept[0].userDecision.action).toBe('accept');

    const contextAfterAccept = JSON.parse(localStorage.getItem('ai_creator_os:learning_context') || '{}');
    expect(contextAfterAccept.acceptedRecommendationIds).toContain(recId);
    expect(contextAfterAccept.highPerformingPatterns).toHaveLength(1);
    expect(contextAfterAccept.highPerformingPatterns[0].pattern).toBe('Shorten intro sequence');

    // Apply recommendation
    const applied = applyRecommendation(recId, 'Execute decision');
    expect(applied).toBe(true);

    const recsAfterApply = JSON.parse(localStorage.getItem('ai_creator_os:recommendations') || '[]');
    expect(recsAfterApply[0].status).toBe('applied');

    const decisions = JSON.parse(localStorage.getItem('ai_creator_os:feedback_decisions') || '[]');
    expect(decisions).toHaveLength(1);
    expect(decisions[0].recommendationId).toBe(recId);
    expect(decisions[0].targetEntityId).toBe('prompt-xxx');
  });

  // 25. Undo Decision operation
  it('rolls back applied recommendations, removes decision history, and restores accepted status', () => {
    const recId = 'test-rec-undo';
    const decisionId = 'test-decision-undo';
    
    // Setup state
    const mockRec = {
      id: recId,
      workspaceId: 'work-123',
      recommendationType: 'strengthen_cta',
      evidence: ['Dummy'],
      expectedEffect: 'Improve',
      confidence: 0.9,
      targetEntities: { prompt: 'prompt-123' },
      proposedChange: 'Shorten',
      risk: 'Low',
      status: 'applied',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const mockDecision = {
      id: decisionId,
      recommendationId: recId,
      workspaceId: 'work-123',
      targetEntityType: 'prompt',
      targetEntityId: 'prompt-123',
      action: 'accept',
      appliedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      user: 'test_user',
      rationale: 'Applied'
    };

    localStorage.setItem('ai_creator_os:recommendations', JSON.stringify([mockRec]));
    localStorage.setItem('ai_creator_os:feedback_decisions', JSON.stringify([mockDecision]));

    // Execute Undo
    const undone = undoRecommendation(decisionId);
    expect(undone).toBe(true);

    // Verify recommendations restored to accepted
    const recs = JSON.parse(localStorage.getItem('ai_creator_os:recommendations') || '[]');
    expect(recs[0].status).toBe('accepted');

    // Verify decision record removed
    const decisions = JSON.parse(localStorage.getItem('ai_creator_os:feedback_decisions') || '[]');
    expect(decisions).toHaveLength(0);
  });

  // 26. Faulty Input handling & graceful fails
  it('gracefully handles faulty snapshots during ingestion and labels them as FAILED', () => {
    const faultySnap = getBaseSnapshot({
      id: 'faulty-snap-1',
      periodStart: '2026-07-16T12:00:00.000Z',
      periodEnd: '2026-07-16T00:00:00.000Z', // END before START! Invalid.
    });

    const result = ingestPerformanceSnapshot(faultySnap);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.snapshot?.status).toBe(SnapshotStatus.FAILED);

    // Verify raw storage contains the failed record
    const rawSnapshots = JSON.parse(localStorage.getItem('ai_creator_os:performance_snapshots') || '[]');
    const stored = rawSnapshots.find((s: any) => s.id === 'faulty-snap-1');
    expect(stored).toBeDefined();
    expect(stored.status).toBe(SnapshotStatus.FAILED);
  });

  // 27. Calibration triggers and verification boundaries
  it('correctly calibrates viral predictions when real observed and predicted scores are available', () => {
    const freshSnap = getBaseSnapshot({
      id: 'snap-cal-test',
      impressions: 15000,
      views: 12000,
      likes: 600,
    });
    
    // Set up a scorecard
    const scorecard = generateScorecard(freshSnap, 88);
    // Write snap and scorecard to storage
    localStorage.setItem('ai_creator_os:performance_snapshots', JSON.stringify([freshSnap]));
    localStorage.setItem('ai_creator_os:scorecards', JSON.stringify([scorecard]));

    const calibration = calibrateViralScore('pred-999', 88, 'snap-cal-test');
    expect(calibration).not.toBeNull();
    expect(calibration?.predictedScore).toBe(88);
    expect(calibration?.observedScore).toBe(scorecard.overallScore);
    expect(calibration?.predictionGap).toBe(88 - scorecard.overallScore);
    expect(calibration?.sampleSize).toBe(15000);

    // Assert that we do not generate calibration when predictionId is missing
    const nullCal = calibrateViralScore('', 88, 'snap-cal-test');
    expect(nullCal).toBeNull();
  });

  // 28. Recommendation evidence structure enforcement
  it('structures recommendation evidence elements with explicit indicators citing specific metrics and baseline performance', () => {
    const freshSnap = getBaseSnapshot({
      id: 'snap-rec-structure-test',
      views: 5000,
      threeSecondViews: 400, // Hook Ratio = 400/5000 = 0.08 (8%)
    });

    const scorecard = generateScorecard(freshSnap);
    const insights = generateInsights(freshSnap, scorecard);
    const recommendations = generateRecommendations(insights);

    const hookRec = recommendations.find(r => r.recommendationType === 'improve_hook');
    expect(hookRec).toBeDefined();
    expect(hookRec?.evidence).toHaveLength(2);
    expect(hookRec?.evidence[0]).toContain('drop-off');
    expect(hookRec?.evidence[1]).toContain('benchmark 0.4');
  });

  // 29. Event propagation correctness verification
  it('dispatches expected events on the window event bus when snapshot ingestion executes successfully', () => {
    const eventSpy = vi.fn();
    window.addEventListener('ai-creator-os:creative-event', eventSpy);

    const freshSnap = getBaseSnapshot({
      id: 'snap-event-test',
      views: 1000,
      likes: 50,
    });

    ingestPerformanceSnapshot(freshSnap);

    expect(eventSpy).toHaveBeenCalled();
    const eventDetails = eventSpy.mock.calls.map(call => (call[0] as CustomEvent).detail);
    const normalizedEvent = eventDetails.find(e => e.name === 'analytics.snapshot.normalized');
    expect(normalizedEvent).toBeDefined();
    expect(normalizedEvent.payload.id).toBe('snap-event-test');

    const scorecardEvent = eventDetails.find(e => e.name === 'analytics.scorecard.generated');
    expect(scorecardEvent).toBeDefined();

    window.removeEventListener('ai-creator-os:creative-event', eventSpy);
  });

  // 30. Atomic rollback recovery under storage failure
  it('completely rolls back storage modifications to their initial state when a write quota exception occurs during ingestion', () => {
    const freshSnap = getBaseSnapshot({
      id: 'snap-rollback-test',
      views: 1000,
    });

    // Seed some initial data using fully schema-compliant snapshot
    const existingSnap = getBaseSnapshot({ id: 'snap-existing', views: 50 });
    localStorage.setItem('ai_creator_os:performance_snapshots', JSON.stringify([existingSnap]));

    // Spy on setItem to throw simulated quota error when saving scorecards
    const originalSetItem = localStorage.setItem;
    vi.spyOn(localStorage, 'setItem').mockImplementation(function (this: any, key: string, value: string) {
      if (key === 'ai_creator_os:scorecards') {
        throw new Error('QuotaExceededError: simulated limits reached');
      }
      return originalSetItem.call(this, key, value);
    });

    const result = ingestPerformanceSnapshot(freshSnap);
    expect(result.success).toBe(false);
    expect(result.error).toContain('LocalStorage QuotaExceeded');

    // Verify storage was rolled back: the newly added snapshot should not exist in performance_snapshots
    const snapshots = JSON.parse(localStorage.getItem('ai_creator_os:performance_snapshots') || '[]');
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].id).toBe('snap-existing');
  });

  // 31. Clearing logic and non-destructiveness contract
  it('clears all loop-generated collections but guarantees preservation of original brand, products and templates', () => {
    // Seed some test data
    const existingSnap = getBaseSnapshot({ id: 'snap-test' });
    localStorage.setItem('ai_creator_os:performance_snapshots', JSON.stringify([existingSnap]));
    localStorage.setItem('ai_creator_os:scorecards', JSON.stringify([{ id: 'sc-test' }]));
    
    // Seed some template prompts with required fields and config to pass promptHistorySchema
    const promptTemplates = [
      { 
        id: 'original_template_1', 
        generatedPrompt: 'Write a tech ad video', 
        createdAt: '2026-07-16T12:00:00Z',
        configuration: {
          outputType: 'video',
          platform: 'veo-3',
          aspectRatio: '9:16',
          durationSeconds: 15,
          characterId: 'char-1',
          productId: 'prod-1',
          wardrobeItemId: 'ward-1',
          sceneId: 'scene-1',
          poseId: 'pose-1',
          customInstructions: ''
        }
      },
      { 
        id: 'prompt_version_opt_rec_1', 
        generatedPrompt: 'Optimized video prompt', 
        createdAt: '2026-07-16T12:00:00Z',
        configuration: {
          outputType: 'video',
          platform: 'veo-3',
          aspectRatio: '9:16',
          durationSeconds: 15,
          characterId: 'char-1',
          productId: 'prod-1',
          wardrobeItemId: 'ward-1',
          sceneId: 'scene-1',
          poseId: 'pose-1',
          customInstructions: ''
        }
      }
    ];
    localStorage.setItem('ai-creator-os.prompt-history.v1', JSON.stringify(promptTemplates));

    const cleared = clearAllAnalyticsFeedbackData();
    expect(cleared).toBe(true);

    // Verify feedback loop data is cleared
    expect(localStorage.getItem('ai_creator_os:performance_snapshots')).toBeNull();
    expect(localStorage.getItem('ai_creator_os:scorecards')).toBeNull();

    // Verify original templates are preserved while loop-generated variants are cleaned
    const promptHistory = JSON.parse(localStorage.getItem('ai-creator-os.prompt-history.v1') || '[]');
    expect(promptHistory).toHaveLength(1);
    expect(promptHistory[0].id).toBe('original_template_1');
  });

  // 32. Event Bus lifecycle and subscription resilience
  it('proves subscription cleanup and avoids detached callback trees on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const callback = vi.fn();
    const unsubscribe = subscribeToStorageChanges(SNAPSHOTS_KEY, callback);

    expect(addSpy).toHaveBeenCalled();
    unsubscribe();
    expect(removeSpy).toHaveBeenCalled();
  });
});
