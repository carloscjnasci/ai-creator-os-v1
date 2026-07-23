import { publishCreativeEvent } from '@/core/events/creativeEventBus';
import { 
  loadSnapshots, 
  saveSnapshots, 
  loadScorecards, 
  saveScorecards, 
  loadInsights, 
  saveInsights, 
  loadRecommendations, 
  saveRecommendations, 
  loadDecisions, 
  saveDecisions, 
  loadCalibrations, 
  saveCalibrations, 
  loadLearningContext, 
  saveLearningContext 
} from './analyticsFeedbackStorage';
import { 
  PerformanceSnapshot, 
  AnalyticsPlatform, 
  AnalyticsSourceType, 
  SnapshotStatus, 
  MetricWindow,
  PerformanceScorecard,
  AnalyticsInsight,
  AnalyticsRecommendation,
  InsightStatus,
  RecommendationStatus,
  InsightCategory,
  InsightSeverity,
  RecommendationType,
  FeedbackDecision,
  CalibrationRecord,
  LearningContext,
  AttributionResult,
  OutlierResult
} from './types';
import { performanceSnapshotSchema } from './analyticsFeedbackSchemas';
import { loadPromptHistoryFromStorage, savePromptHistoryToStorage } from '../prompt-engine/promptHistoryStorage';

// Import deterministic analytics engines
import { normalizeAndDeriveMetrics } from './metricNormalizer';
import { executeAttribution } from './attributionEngine';
import { generateScorecard } from './scorecardEngine';
import { detectOutliers } from './outlierEngine';
import { generateInsights } from './insightEngine';
import { generateRecommendations } from './recommendationEngine';

// Import Creative Assets Storage
import { loadCreativeAssets, saveCreativeAssets } from '../creative-library/lib/creativeAssetStorage';
import { loadCreativePlans } from '../ai-director/lib/creativePlanStorage';
import { loadViralAnalyses } from '../viral-analyzer/lib/viralAnalysisStorage';

// --------------------------------------------------------
// 1. PUBLICATION INTEGRATION
// --------------------------------------------------------

export function trackPublicationSuccess(
  draftId: string,
  jobId: string,
  externalId?: string,
  permalink?: string,
  campaignId?: string,
  creativeLibraryAssetId?: string,
  promptHistoryId?: string,
  digitalHumanId?: string,
  platform?: AnalyticsPlatform,
  workspaceId?: string
): boolean {
  const snapshots = loadSnapshots();
  
  // Idempotent: avoid duplicate tracking records
  const exists = snapshots.some(
    s => (s.publicationDraftId === draftId && s.publicationJobId === jobId) ||
         (externalId && s.externalPublicationId === externalId)
  );
  if (exists) {
    return true;
  }

  // Use unique deterministic snapshot ID based on draft and job IDs to prevent duplicate tracking records
  const snapshotId = `snapshot_pub_${draftId}_${jobId}`;

  const newSnapshot: PerformanceSnapshot = {
    id: snapshotId,
    workspaceId: workspaceId || 'system_workspace',
    platform: platform || AnalyticsPlatform.OTHER,
    sourceType: AnalyticsSourceType.PUBLISHING_RESULT,
    status: SnapshotStatus.DRAFT,
    publicationDraftId: draftId,
    publicationJobId: jobId,
    externalPublicationId: externalId,
    campaignId,
    creativeLibraryAssetId,
    promptHistoryId,
    digitalHumanId,
    metricWindow: MetricWindow.FIRST_24_HOURS,
    periodStart: new Date().toISOString(),
    periodEnd: new Date(Date.now() + 86400000).toISOString(),
    capturedAt: new Date().toISOString(),
    currency: 'USD',
    metadata: permalink ? { permalink } : {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  snapshots.push(newSnapshot);
  return saveSnapshots(snapshots);
}

// Helper to resolve predicted viral score
function resolvePredictedViralScore(snapshot: PerformanceSnapshot): number | undefined {
  if (snapshot.metadata?.predictedViralScore !== undefined && typeof snapshot.metadata.predictedViralScore === 'number') {
    return snapshot.metadata.predictedViralScore;
  }
  if (snapshot.metadata?.preProductionViralScore !== undefined && typeof snapshot.metadata.preProductionViralScore === 'number') {
    return snapshot.metadata.preProductionViralScore;
  }
  if (snapshot.creativePlanId) {
    const plans = loadCreativePlans();
    const plan = plans.find(p => p.id === snapshot.creativePlanId);
    if (plan && plan.viralScore?.overall !== undefined) {
      return plan.viralScore.overall;
    }
  }
  const viralAnalysisId = snapshot.metadata?.viralAnalysisId;
  if (viralAnalysisId) {
    const analyses = loadViralAnalyses();
    const analysis = analyses.find(a => a.id === viralAnalysisId);
    if (analysis && analysis.viralScore?.overall !== undefined) {
      return analysis.viralScore.overall;
    }
  }
  return undefined;
}

// Non-destructively updates the linked Creative Library Asset
export function updateCreativeLibraryAssetWithPerformance(
  assetId: string,
  snapshotId: string,
  scorecard: PerformanceScorecard,
  outliers: OutlierResult[]
): boolean {
  const assets = loadCreativeAssets();
  const idx = assets.findIndex(a => a.id === assetId);
  if (idx < 0) return true; // Legacy asset or not found is supported

  const asset = assets[idx];
  const snapshotIds = asset.analyticsSnapshotIds || [];
  if (!snapshotIds.includes(snapshotId)) {
    snapshotIds.push(snapshotId);
  }

  const engagementScore = scorecard.dimensions.find(d => d.dimension.toLowerCase() === 'engagement')?.value;
  const retentionScore = scorecard.dimensions.find(d => d.dimension.toLowerCase() === 'retention')?.value;
  const conversionScore = scorecard.dimensions.find(d => d.dimension.toLowerCase() === 'conversion')?.value;

  let outlierStatus: 'positive' | 'negative' | 'none' = 'none';
  if (outliers.some(o => o.isPositiveOutlier)) {
    outlierStatus = 'positive';
  } else if (outliers.some(o => o.isNegativeOutlier)) {
    outlierStatus = 'negative';
  }

  assets[idx] = {
    ...asset,
    analyticsSnapshotIds: snapshotIds,
    observedPerformanceScore: scorecard.overallScore,
    engagementScore,
    retentionScore,
    conversionScore,
    outlierStatus,
    lastMetricsCapturedAt: new Date().toISOString()
  };

  return saveCreativeAssets(assets);
}

// --------------------------------------------------------
// 2. PERFORMANCE INGESTION WORKFLOW
// --------------------------------------------------------

export function ingestPerformanceSnapshot(snapshot: PerformanceSnapshot): { 
  success: boolean; 
  error?: string; 
  snapshot?: PerformanceSnapshot;
  scorecard?: PerformanceScorecard;
} {
  // Save initial state for atomic rollback
  const initialSnapshots = loadSnapshots();
  const initialScorecards = loadScorecards();
  const initialCalibrations = loadCalibrations();
  const initialInsights = loadInsights();
  const initialRecommendations = loadRecommendations();
  const initialAssets = loadCreativeAssets();

  const rollback = () => {
    saveSnapshots(initialSnapshots);
    saveScorecards(initialScorecards);
    saveCalibrations(initialCalibrations);
    saveInsights(initialInsights);
    saveRecommendations(initialRecommendations);
    saveCreativeAssets(initialAssets);
  };

  // A. Validation
  const parseResult = performanceSnapshotSchema.safeParse(snapshot);
  if (!parseResult.success) {
    const failedSnapshot: PerformanceSnapshot = {
      ...snapshot,
      status: SnapshotStatus.FAILED,
      errorMessage: parseResult.error.message,
      updatedAt: new Date().toISOString()
    };
    const snapshots = loadSnapshots();
    const idx = snapshots.findIndex(s => s.id === snapshot.id);
    if (idx >= 0) {
      snapshots[idx] = failedSnapshot;
    } else {
      snapshots.push(failedSnapshot);
    }
    const saved = saveSnapshots(snapshots);
    if (!saved) {
      // rollback is unnecessary since we only save failed state, but we return explicit error
      return { success: false, error: 'Failed to write failed snapshot status to storage.', snapshot: failedSnapshot };
    }
    return { success: false, error: parseResult.error.message, snapshot: failedSnapshot };
  }

  let current = { ...parseResult.data };

  // B. Normalization and derivative metric computation using dedicated metricNormalizer
  const normResult = normalizeAndDeriveMetrics(current);
  current = normResult.normalized;
  current.status = SnapshotStatus.NORMALIZED;

  // C. Attribution using dedicated attributionEngine
  const attrResult = executeAttribution(current);
  current = attrResult.attributedSnapshot;
  const attribution = attrResult.result;

  // Save updated snapshot back safely
  const snapshots = loadSnapshots();
  const idx = snapshots.findIndex(s => s.id === current.id);
  if (idx >= 0) {
    snapshots[idx] = current;
  } else {
    snapshots.push(current);
  }
  const savedSnap = saveSnapshots(snapshots);
  if (!savedSnap) {
    rollback();
    return { success: false, error: 'LocalStorage QuotaExceeded or write failure on snapshots.' };
  }

  // D. Generate Scorecard using dedicated scorecardEngine and resolved predicted score
  const predictedViralScore = resolvePredictedViralScore(current);
  const scorecard = generateScorecard(current, predictedViralScore);

  const scorecards = loadScorecards();
  const scIdx = scorecards.findIndex(sc => sc.id === scorecard.id);
  if (scIdx >= 0) {
    scorecards[scIdx] = scorecard;
  } else {
    scorecards.push(scorecard);
  }
  const savedScorecard = saveScorecards(scorecards);
  if (!savedScorecard) {
    rollback();
    return { success: false, error: 'LocalStorage QuotaExceeded or write failure on scorecards.' };
  }

  // E. Calibrate Viral Score if a real prediction exists
  if (predictedViralScore !== undefined) {
    const calibration = calibrateViralScore(current.id, predictedViralScore, current.id);
    if (!calibration) {
      rollback();
      return { success: false, error: 'Failed to persist calibration record.' };
    }
  }

  // F. Outliers, Insights and Recommendations
  const history = loadSnapshots();
  const outlierResults: OutlierResult[] = [
    ...detectOutliers(current, history, 'views'),
    ...detectOutliers(current, history, 'engagementRate'),
    ...detectOutliers(current, history, 'ctr'),
    ...detectOutliers(current, history, 'cvr'),
    ...detectOutliers(current, history, 'roas'),
  ];

  const insights = generateInsights(current, scorecard, outlierResults);
  const savedInsightsList = loadInsights();
  for (const insight of insights) {
    const insightIdx = savedInsightsList.findIndex(i => i.id === insight.id);
    if (insightIdx >= 0) {
      savedInsightsList[insightIdx] = insight;
    } else {
      savedInsightsList.push(insight);
    }
  }
  const savedInsights = saveInsights(savedInsightsList);
  if (!savedInsights) {
    rollback();
    return { success: false, error: 'LocalStorage QuotaExceeded or write failure on insights.' };
  }

  const recommendations = generateRecommendations(insights);
  const savedRecommendationsList = loadRecommendations();
  for (const rec of recommendations) {
    const recIdx = savedRecommendationsList.findIndex(r => r.id === rec.id);
    if (recIdx >= 0) {
      savedRecommendationsList[recIdx] = rec;
    } else {
      savedRecommendationsList.push(rec);
    }
  }
  const savedRecs = saveRecommendations(savedRecommendationsList);
  if (!savedRecs) {
    rollback();
    return { success: false, error: 'LocalStorage QuotaExceeded or write failure on recommendations.' };
  }

  // G. Update Creative Library Asset Non-Destructively
  if (current.creativeLibraryAssetId) {
    const savedAsset = updateCreativeLibraryAssetWithPerformance(
      current.creativeLibraryAssetId,
      current.id,
      scorecard,
      outlierResults
    );
    if (!savedAsset) {
      rollback();
      return { success: false, error: 'LocalStorage QuotaExceeded or write failure on Creative Library Asset.' };
    }
  }

  // H. Publish Event Bus events only after successful atomic persistence
  try {
    publishCreativeEvent('analytics.snapshot.normalized', current);
    publishCreativeEvent('analytics.snapshot.attributed', { snapshot: current, attribution });
    publishCreativeEvent('analytics.scorecard.generated', scorecard);
  } catch (e) {
    console.error('Failed to trigger creative event bus notifications:', e);
  }

  return { success: true, snapshot: current, scorecard };
}

// --------------------------------------------------------
// 3. FEEDBACK DECISION WORKFLOW
// --------------------------------------------------------

export function reviewInsight(insightId: string): boolean {
  const insights = loadInsights();
  const idx = insights.findIndex(i => i.id === insightId);
  if (idx >= 0) {
    insights[idx].status = InsightStatus.REVIEWED;
    insights[idx].updatedAt = new Date().toISOString();
    return saveInsights(insights);
  }
  return false;
}

export function acceptInsight(insightId: string): boolean {
  const insights = loadInsights();
  const idx = insights.findIndex(i => i.id === insightId);
  if (idx >= 0) {
    insights[idx].status = InsightStatus.ACCEPTED;
    insights[idx].updatedAt = new Date().toISOString();
    return saveInsights(insights);
  }
  return false;
}

export function dismissInsight(insightId: string): boolean {
  const insights = loadInsights();
  const idx = insights.findIndex(i => i.id === insightId);
  if (idx >= 0) {
    insights[idx].status = InsightStatus.DISMISSED;
    insights[idx].updatedAt = new Date().toISOString();
    return saveInsights(insights);
  }
  return false;
}

export function acceptRecommendation(recId: string, reason?: string): boolean {
  const recs = loadRecommendations();
  const idx = recs.findIndex(r => r.id === recId);
  if (idx >= 0) {
    recs[idx].status = RecommendationStatus.ACCEPTED;
    recs[idx].userDecision = {
      action: 'accept',
      timestamp: new Date().toISOString(),
      reason
    };
    recs[idx].updatedAt = new Date().toISOString();
    
    // Advisory Learning Context Update
    const context = loadLearningContext();
    if (!context.acceptedRecommendationIds.includes(recId)) {
      context.acceptedRecommendationIds.push(recId);
      // Derive positive patterns if high confidence
      if (recs[idx].confidence > 0.8) {
        context.highPerformingPatterns.push({
          pattern: recs[idx].proposedChange,
          type: 'prompt',
          score: Math.round(recs[idx].confidence * 100),
          confidence: recs[idx].confidence
        });
      }
      context.updatedAt = new Date().toISOString();
      saveLearningContext(context);
    }
    
    return saveRecommendations(recs);
  }
  return false;
}

export function rejectRecommendation(recId: string, reason?: string): boolean {
  const recs = loadRecommendations();
  const idx = recs.findIndex(r => r.id === recId);
  if (idx >= 0) {
    recs[idx].status = RecommendationStatus.REJECTED;
    recs[idx].userDecision = {
      action: 'reject',
      timestamp: new Date().toISOString(),
      reason
    };
    recs[idx].updatedAt = new Date().toISOString();

    const context = loadLearningContext();
    if (!context.rejectedRecommendationIds.includes(recId)) {
      context.rejectedRecommendationIds.push(recId);
      context.weakPatterns.push({
        pattern: recs[idx].proposedChange,
        type: 'prompt',
        score: 30,
        confidence: recs[idx].confidence
      });
      context.updatedAt = new Date().toISOString();
      saveLearningContext(context);
    }

    return saveRecommendations(recs);
  }
  return false;
}

export function applyRecommendation(recId: string, rationale?: string): boolean {
  const recs = loadRecommendations();
  const rec = recs.find(r => r.id === recId);
  if (!rec) return false;

  rec.status = RecommendationStatus.APPLIED;
  rec.updatedAt = new Date().toISOString();
  saveRecommendations(recs);

  // Preserve historical lineage: create a clean FeedbackDecision record
  const decisions = loadDecisions();
  const targetType = rec.targetEntities.prompt ? 'prompt' : 'campaign';
  const targetId = rec.targetEntities.prompt || rec.targetEntities.campaign || '';

  const decision: FeedbackDecision = {
    id: `decision_${Math.random().toString(36).substr(2, 9)}`,
    recommendationId: recId,
    workspaceId: rec.workspaceId || 'system_workspace',
    targetEntityType: targetType,
    targetEntityId: targetId,
    action: 'accept',
    appliedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    user: 'system_workspace_user', // Frontend-only preset workspace user
    rationale: rationale || 'Applied via the Analytics Feedback loop decision panel.'
  };

  decisions.push(decision);
  saveDecisions(decisions);

  // Apply actual patch/prompt variation securely
  if (targetType === 'prompt' && targetId) {
    createPromptVersionFromRecommendation(recId, rec.proposedChange);
  }

  return true;
}

export function undoRecommendation(decisionId: string): boolean {
  const decisions = loadDecisions();
  const decisionIdx = decisions.findIndex(d => d.id === decisionId);
  if (decisionIdx < 0) return false;

  const decision = decisions[decisionIdx];
  const recs = loadRecommendations();
  const recIdx = recs.findIndex(r => r.id === decision.recommendationId);
  if (recIdx >= 0) {
    recs[recIdx].status = RecommendationStatus.ACCEPTED;
    recs[recIdx].updatedAt = new Date().toISOString();
    saveRecommendations(recs);
  }

  // Safe undo from Prompt history versioning
  if (decision.targetEntityType === 'prompt') {
    const promptHistory = loadPromptHistoryFromStorage();
    const cleanHistory = promptHistory.filter(entry => entry.id !== decision.targetEntityId);
    savePromptHistoryToStorage(cleanHistory);
  }

  decisions.splice(decisionIdx, 1);
  return saveDecisions(decisions);
}

// --------------------------------------------------------
// 4. PROMPT INTELLIGENCE INTEGRATION
// --------------------------------------------------------

export function getPromptPerformanceSummary(promptId: string) {
  const snapshots = loadSnapshots();
  const matchingSnapshots = snapshots.filter(s => s.promptHistoryId === promptId);

  if (matchingSnapshots.length === 0) {
    return { count: 0, avgEngagement: 0, avgCtr: 0, avgCvr: 0 };
  }

  const totals = matchingSnapshots.reduce(
    (acc, cur) => {
      acc.engagement += cur.engagementRate || 0;
      acc.ctr += cur.ctr || 0;
      acc.cvr += cur.cvr || 0;
      return acc;
    },
    { engagement: 0, ctr: 0, cvr: 0 }
  );

  const len = matchingSnapshots.length;
  return {
    count: len,
    avgEngagement: Number((totals.engagement / len).toFixed(4)),
    avgCtr: Number((totals.ctr / len).toFixed(4)),
    avgCvr: Number((totals.cvr / len).toFixed(4))
  };
}

export function getPromptStructurePerformance() {
  const history = loadPromptHistoryFromStorage();
  const summaries = history.map(entry => {
    const perf = getPromptPerformanceSummary(entry.id);
    return {
      promptId: entry.id,
      promptText: entry.generatedPrompt,
      platform: entry.configuration?.platform || 'other',
      ...perf
    };
  });
  return summaries.sort((a, b) => b.avgEngagement - a.avgEngagement);
}

export function getBestWorstPromptVersions() {
  const structured = getPromptStructurePerformance();
  if (structured.length === 0) return { best: null, worst: null };
  return {
    best: structured[0],
    worst: structured[structured.length - 1]
  };
}

export function getPlatformPromptPerformance(platform: string) {
  const structured = getPromptStructurePerformance();
  return structured.filter(s => s.platform.toLowerCase() === platform.toLowerCase());
}

export function getCampaignPromptPerformance(campaignId: string) {
  const history = loadPromptHistoryFromStorage().filter(h => h.campaignId === campaignId);
  return history.map(entry => ({
    promptId: entry.id,
    promptText: entry.generatedPrompt,
    ...getPromptPerformanceSummary(entry.id)
  }));
}

export function createPromptVersionFromRecommendation(recId: string, patch: string): boolean {
  const recs = loadRecommendations();
  const rec = recs.find(r => r.id === recId);
  if (!rec || !rec.targetEntities.prompt) return false;

  const promptHistory = loadPromptHistoryFromStorage();
  const original = promptHistory.find(p => p.id === rec.targetEntities.prompt);
  if (!original) return false;

  // Create a new version/draft without mutating historical data directly
  const newId = `prompt_version_opt_${recId}_${Date.now()}`;
  const newEntry = {
    ...original,
    id: newId,
    generatedPrompt: `${original.generatedPrompt}\n\n[Optimization]: ${patch}`,
    createdAt: new Date().toISOString(),
    campaignName: original.campaignName ? `${original.campaignName} (Optimized)` : 'Optimized Campaign'
  };

  promptHistory.push(newEntry);
  return savePromptHistoryToStorage(promptHistory);
}

// --------------------------------------------------------
// 5. DIGITAL HUMAN INTELLIGENCE INTEGRATION
// --------------------------------------------------------

export function getDigitalHumanPerformanceSummary(digitalHumanId: string) {
  const snapshots = loadSnapshots();
  const matching = snapshots.filter(s => s.digitalHumanId === digitalHumanId);
  const scorecards = loadScorecards();

  // Find snapshots with scorecard overall score
  const measuredSnapshots = matching.filter(s => {
    const sc = scorecards.find(scard => scard.snapshotId === s.id);
    return sc !== undefined && sc.overallScore !== undefined;
  });

  if (measuredSnapshots.length === 0) {
    return {
      status: 'insufficient_data',
      campaignCount: new Set(matching.map(s => s.campaignId).filter(Boolean)).size,
      publicationCount: new Set(matching.map(s => s.publicationDraftId).filter(Boolean)).size,
      avgEngagement: 0,
      avgRetention: 0,
      conversionContribution: 0,
      strongestPlatform: 'Insufficient data',
      strongestProductCategory: 'Insufficient data',
      strongestWardrobeCombinations: 'Insufficient data',
      strongestSceneCombinations: 'Insufficient data'
    };
  }

  const campaignIds = new Set(matching.map(s => s.campaignId).filter(Boolean));
  const publicationIds = new Set(matching.map(s => s.publicationDraftId).filter(Boolean));

  let totalEngagement = 0;
  let totalCompletion = 0;
  let totalPurchases = 0;

  // Track scores for platform, product, wardrobe, scene
  const platformScores: Record<string, { sum: number; count: number }> = {};
  const productScores: Record<string, { sum: number; count: number }> = {};
  const wardrobeScores: Record<string, { sum: number; count: number }> = {};
  const sceneScores: Record<string, { sum: number; count: number }> = {};

  for (const s of matching) {
    totalEngagement += s.engagementRate || 0;
    totalCompletion += s.completionRate || 0;
    totalPurchases += s.purchases || 0;
  }

  for (const s of measuredSnapshots) {
    const sc = scorecards.find(scard => scard.snapshotId === s.id)!;
    const score = sc.overallScore;

    if (s.platform) {
      if (!platformScores[s.platform]) platformScores[s.platform] = { sum: 0, count: 0 };
      platformScores[s.platform].sum += score;
      platformScores[s.platform].count++;
    }
    if (s.productId) {
      if (!productScores[s.productId]) productScores[s.productId] = { sum: 0, count: 0 };
      productScores[s.productId].sum += score;
      productScores[s.productId].count++;
    }
    if (s.wardrobeItemId) {
      if (!wardrobeScores[s.wardrobeItemId]) wardrobeScores[s.wardrobeItemId] = { sum: 0, count: 0 };
      wardrobeScores[s.wardrobeItemId].sum += score;
      wardrobeScores[s.wardrobeItemId].count++;
    }
    if (s.sceneId) {
      if (!sceneScores[s.sceneId]) sceneScores[s.sceneId] = { sum: 0, count: 0 };
      sceneScores[s.sceneId].sum += score;
      sceneScores[s.sceneId].count++;
    }
  }

  const getStrongest = (scores: Record<string, { sum: number; count: number }>) => {
    const entries = Object.entries(scores);
    if (entries.length === 0) return 'Insufficient data';
    const sorted = entries.map(([key, val]) => ({ key, avg: val.sum / val.count }))
                         .sort((a, b) => b.avg - a.avg);
    return sorted[0].key;
  };

  const strongestPlatform = getStrongest(platformScores);
  const strongestProductCategory = getStrongest(productScores);
  const strongestWardrobeCombinations = getStrongest(wardrobeScores);
  const strongestSceneCombinations = getStrongest(sceneScores);

  return {
    status: 'measured_data',
    campaignCount: campaignIds.size,
    publicationCount: publicationIds.size,
    avgEngagement: Number((totalEngagement / matching.length).toFixed(4)),
    avgRetention: Number((totalCompletion / matching.length).toFixed(4)),
    conversionContribution: totalPurchases,
    strongestPlatform,
    strongestProductCategory,
    strongestWardrobeCombinations,
    strongestSceneCombinations
  };
}

// --------------------------------------------------------
// 6. CAMPAIGN BUILDER INTEGRATION
// --------------------------------------------------------

export function getCampaignAnalyticsSummary(campaignId: string) {
  const snapshots = loadSnapshots();
  const matching = snapshots.filter(s => s.campaignId === campaignId);
  const recs = loadRecommendations();
  const recCount = recs.filter(r => r.targetEntities.campaign === campaignId).length;

  if (matching.length === 0) {
    return {
      status: 'no_data',
      publicationCount: 0,
      totalViews: 0,
      totalEngagement: 0,
      totalClicks: 0,
      totalConversions: 0,
      revenue: 0,
      spend: 0,
      roas: undefined,
      bestPerformingPublication: 'N/A',
      bestPerformingAsset: 'N/A',
      bestPerformingPrompt: 'N/A',
      predictionGap: 0,
      recommendationCount: recCount
    };
  }

  // Check if we have measured data (at least one snapshot with impressions > 0 or views > 0)
  const hasMeasuredData = matching.some(s => (s.impressions && s.impressions > 0) || (s.views && s.views > 0));

  let totalViews = 0;
  let totalEngagementCount = 0;
  let totalClicks = 0;
  let totalConversions = 0;
  let totalRevenue = 0;
  let totalSpend = 0;
  let bestPubScore = -1;
  let bestPerformingPublication = 'N/A';
  let bestPerformingAsset = 'N/A';
  let bestPerformingPrompt = 'N/A';
  let totalGap = 0;
  let gapCount = 0;

  const scorecards = loadScorecards();

  for (const s of matching) {
    totalViews += s.views || 0;
    totalEngagementCount += (s.likes || 0) + (s.comments || 0) + (s.shares || 0) + (s.saves || 0);
    totalClicks += s.clicks || 0;
    totalConversions += s.purchases || 0;
    totalRevenue += s.revenue || 0;
    totalSpend += s.spend || 0;

    const sc = scorecards.find(score => score.snapshotId === s.id);
    if (sc) {
      if (sc.predictionGap !== undefined) {
        totalGap += sc.predictionGap;
        gapCount++;
      }
      if (sc.overallScore > bestPubScore) {
        bestPubScore = sc.overallScore;
        bestPerformingPublication = s.externalPublicationId || s.publicationDraftId || s.id;
        bestPerformingAsset = s.creativeLibraryAssetId || 'N/A';
        bestPerformingPrompt = s.promptHistoryId || 'N/A';
      }
    }
  }

  const avgGap = gapCount > 0 ? Number((totalGap / gapCount).toFixed(1)) : 0;
  const calculatedROAS = totalSpend > 0 ? Number((totalRevenue / totalSpend).toFixed(2)) : undefined;

  return {
    status: hasMeasuredData ? 'measured_data' : 'insufficient_data',
    publicationCount: matching.length,
    totalViews,
    totalEngagement: totalEngagementCount,
    totalClicks,
    totalConversions,
    revenue: totalRevenue,
    spend: totalSpend,
    roas: calculatedROAS,
    bestPerformingPublication,
    bestPerformingAsset,
    bestPerformingPrompt,
    predictionGap: avgGap,
    recommendationCount: recCount
  };
}

// --------------------------------------------------------
// 7. CREATIVE PLANNER & AI DIRECTOR FEEDBACK
// --------------------------------------------------------

export function getAdvisoryLearningContext(): LearningContext {
  return loadLearningContext();
}

// --------------------------------------------------------
// 8. VIRAL SCORE CALIBRATION
// --------------------------------------------------------

export function calibrateViralScore(
  predictionId: string,
  predictedScore: number,
  snapshotId: string
): CalibrationRecord | null {
  // Require a real prediction ID and a valid prediction score
  if (!predictionId || predictedScore === undefined || predictedScore === null) {
    return null;
  }

  const scorecards = loadScorecards();
  const scorecard = scorecards.find(sc => sc.snapshotId === snapshotId);
  // Require a real observed score; do not default to score 50
  if (!scorecard || scorecard.overallScore === undefined) {
    return null;
  }
  const observedScore = scorecard.overallScore;

  const snapshots = loadSnapshots();
  const snap = snapshots.find(s => s.id === snapshotId);
  if (!snap) {
    return null;
  }

  // Require real measured sample size; do not default to 1000 impressions
  const sampleSize = snap.impressions !== undefined ? snap.impressions : (snap.views !== undefined ? snap.views : undefined);
  if (sampleSize === undefined) {
    return null;
  }

  const calibrations = loadCalibrations();
  
  // Use unique deterministic calibration IDs based on prediction and snapshot
  const calibrationId = `calibration_${predictionId}_${snapshotId}`;

  // Idempotent calibration matching
  const existing = calibrations.find(c => c.id === calibrationId);
  if (existing) {
    return existing;
  }

  const predictionGap = Number((predictedScore - observedScore).toFixed(1));

  const newCal: CalibrationRecord = {
    id: calibrationId,
    predictionId,
    predictedScore,
    observedScore,
    predictionGap,
    platform: snap.platform || 'other',
    campaign: snap.campaignId || 'uncategorized',
    sampleSize,
    confidence: scorecard.dimensions[0]?.confidence || 0.85,
    createdAt: new Date().toISOString()
  };

  calibrations.push(newCal);
  const saved = saveCalibrations(calibrations);
  if (!saved) {
    return null;
  }
  return newCal;
}

// --------------------------------------------------------
// 9. WORKSPACE DATA RESET
// --------------------------------------------------------

export function clearAllAnalyticsFeedbackData(): boolean {
  if (typeof localStorage === 'undefined') return false;

  // Clear the analytics feedback storage keys
  localStorage.removeItem('ai_creator_os:performance_snapshots');
  localStorage.removeItem('ai_creator_os:scorecards');
  localStorage.removeItem('ai_creator_os:insights');
  localStorage.removeItem('ai_creator_os:recommendations');
  localStorage.removeItem('ai_creator_os:feedback_decisions');
  localStorage.removeItem('ai_creator_os:calibration_records');
  localStorage.removeItem('ai_creator_os:learning_context');

  // Filter out loop-generated prompt versions, keeping the original ones
  try {
    const promptHistory = loadPromptHistoryFromStorage();
    const cleanHistory = promptHistory.filter(p => !p.id.startsWith('prompt_version_opt_') && !p.id.startsWith('prompt_version_'));
    savePromptHistoryToStorage(cleanHistory);
  } catch (err) {
    console.error('Failed to clean prompt version history:', err);
  }

  return true;
}
