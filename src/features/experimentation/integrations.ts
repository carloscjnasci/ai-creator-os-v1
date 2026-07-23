import { 
  Experiment, 
  ExperimentVariant, 
  ExperimentObservation, 
  ExperimentStatus,
  ExperimentType,
  MetricType,
  ExperimentDecision
} from './types';
import { 
  loadExperiments, 
  saveExperiments, 
  loadVariants, 
  saveVariants, 
  loadObservations, 
  saveObservations,
  loadDecisions
} from './experimentStorage';
import { ingestObservationWorkflow, createVariantWorkflow, applyDecisionWorkflow } from './experimentWorkflow';
import { loadPublicationDrafts, savePublicationDrafts } from '@/features/publishing-hub/lib/publishingStorage';
import { PublicationDraft } from '@/features/publishing-hub/types';
import { loadCreativeAssets, saveCreativeAssets } from '@/features/creative-library/lib/creativeAssetStorage';
import { CreativeAsset } from '@/features/creative-library/types';
import { loadCampaignsFromStorage, saveCampaignsToStorage } from '@/features/campaigns/lib/campaignStorage';
import { Campaign } from '@/features/campaigns/types';

/**
 * 2. ANALYTICS FEEDBACK INTEGRATION
 * Connect analyzed Performance Snapshots to experiments.
 */
export function linkSnapshotToVariant(snapshotId: string, variantId: string): boolean {
  const variants = loadVariants();
  const index = variants.findIndex(v => v.id === variantId);
  if (index === -1) return false;

  const metadata = variants[index].metadata || {};
  const snapshotIds = metadata.analyticsSnapshotIds || [];
  if (!snapshotIds.includes(snapshotId)) {
    snapshotIds.push(snapshotId);
  }

  variants[index] = {
    ...variants[index],
    metadata: {
      ...metadata,
      analyticsSnapshotIds: snapshotIds
    },
    updatedAt: new Date().toISOString()
  };

  return saveVariants(variants);
}

export function convertSnapshotToObservations(
  snapshot: {
    id: string;
    campaignId?: string;
    platform?: string;
    metricWindow?: string;
    ctr?: number;
    cvr?: number;
    clicks?: number;
    impressions?: number;
    views?: number;
    retentionRate?: number;
    watchTimeSeconds?: number;
    [key: string]: any;
  },
  variantId: string
): { success: boolean; observationsIngested: number } {
  const variants = loadVariants();
  const variant = variants.find(v => v.id === variantId);
  if (!variant) return { success: false, observationsIngested: 0 };

  const experiments = loadExperiments();
  const exp = experiments.find(e => e.id === variant.experimentId);
  if (!exp) return { success: false, observationsIngested: 0 };

  // Identify metrics we can convert based on what's available in the snapshot
  const metricsToConvert: Array<{ name: string; type: MetricType; value: number; sampleSize?: number }> = [];

  if (snapshot.ctr !== undefined) {
    metricsToConvert.push({
      name: 'ctr',
      type: MetricType.RATE,
      value: snapshot.ctr,
      sampleSize: snapshot.impressions || snapshot.views
    });
  }
  if (snapshot.cvr !== undefined) {
    metricsToConvert.push({
      name: 'cvr',
      type: MetricType.RATE,
      value: snapshot.cvr,
      sampleSize: snapshot.clicks
    });
  }
  if (snapshot.clicks !== undefined) {
    metricsToConvert.push({
      name: 'clicks',
      type: MetricType.COUNT,
      value: snapshot.clicks
    });
  }
  if (snapshot.impressions !== undefined) {
    metricsToConvert.push({
      name: 'impressions',
      type: MetricType.COUNT,
      value: snapshot.impressions
    });
  }
  if (snapshot.views !== undefined) {
    metricsToConvert.push({
      name: 'views',
      type: MetricType.COUNT,
      value: snapshot.views
    });
  }
  if (snapshot.retentionRate !== undefined) {
    metricsToConvert.push({
      name: 'retentionRate',
      type: MetricType.RATE,
      value: snapshot.retentionRate,
      sampleSize: snapshot.views
    });
  }
  if (snapshot.watchTimeSeconds !== undefined) {
    metricsToConvert.push({
      name: 'watchTimeSeconds',
      type: MetricType.DURATION,
      value: snapshot.watchTimeSeconds
    });
  }

  let count = 0;
  for (const m of metricsToConvert) {
    const res = ingestObservationWorkflow({
      experimentId: exp.id,
      variantId,
      metricName: m.name,
      metricType: m.type,
      value: m.value,
      sampleSize: m.sampleSize !== undefined ? m.sampleSize : (snapshot.impressions || snapshot.views || 0),
      metricWindow: snapshot.metricWindow || '24h',
      source: 'performance-snapshot',
      isEstimated: false,
      metadata: {
        platform: snapshot.platform || exp.platform,
        campaignId: snapshot.campaignId || exp.campaignId
      },
      performanceSnapshotId: snapshot.id
    });
    if (res.success && res.newlyIngested) {
      count++;
    }
  }

  // Also link the snapshot to the variant metadata
  linkSnapshotToVariant(snapshot.id, variantId);

  return { success: true, observationsIngested: count };
}

/**
 * 3. PUBLISHING HUB INTEGRATION
 * Generate or link publication drafts for each variant.
 */
export function generatePublicationDraftForVariant(
  experimentId: string,
  variantId: string,
  mode: 'manual' | 'mock' | 'secure' = 'mock'
): { success: boolean; draft?: PublicationDraft; error?: string } {
  const experiments = loadExperiments();
  const exp = experiments.find(e => e.id === experimentId);
  if (!exp) return { success: false, error: 'Experiment not found.' };

  const variants = loadVariants();
  const vIndex = variants.findIndex(v => v.id === variantId);
  if (vIndex === -1) return { success: false, error: 'Variant not found.' };

  const variant = variants[vIndex];

  // Load existing publication drafts
  const drafts = loadPublicationDrafts();

  // Enforce one publication draft per variant
  const existingDraft = drafts.find(d => d.id === variant.publicationDraftId || d.variantId === variantId || d.metadata?.variantId === variantId);
  if (existingDraft) {
    return { success: true, draft: existingDraft };
  }

  const draftId = `pub-draft-${variantId}-${Date.now()}`;
  const validPlatforms = ['tiktok', 'tiktok-shop', 'youtube', 'instagram', 'pinterest', 'generic'];
  const draftPlatform = exp.platform && validPlatforms.includes(exp.platform) ? exp.platform as any : 'generic';
  const adapterMode = mode === 'secure' ? 'secure-backend' : mode === 'manual' ? 'manual' : 'mock';

  const newDraft: PublicationDraft = {
    id: draftId,
    workspaceId: exp.workspaceId,
    campaignId: exp.campaignId || variant.campaignId || 'unassigned',
    platform: draftPlatform,
    title: `${variant.name} Publication`,
    caption: `Testing variant ${variant.variantKey} under hypothesis: ${exp.hypothesis}`,
    scheduledAt: new Date(Date.now() + 86400000).toISOString(), // next day
    status: 'draft',
    creativeAssetId: variant.creativeLibraryAssetId,
    digitalHumanId: variant.digitalHumanId,
    productId: variant.productId,
    experimentId,
    variantId,
    hashtags: [],
    mentions: [],
    approvalRequired: false,
    timezone: 'UTC',
    adapterMode,
    validation: {
      valid: true,
      issues: [],
      checkedAt: new Date().toISOString(),
      policyVersion: '1.0.0'
    },
    idempotencyKey: `pub-idempotency-${draftId}`,
    attemptCount: 0,
    metricsStatus: 'not-requested',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {
      experimentId,
      variantId,
      promptHistoryId: variant.promptHistoryId,
      sceneId: variant.metadata?.sceneId,
      publishingMode: mode
    }
  };

  if (!savePublicationDrafts([...drafts, newDraft])) {
    return { success: false, error: 'Quota exceeded. Failed to save publication draft.' };
  }

  // Update variant with linked publication draft id
  variants[vIndex] = {
    ...variant,
    publicationDraftId: draftId,
    updatedAt: new Date().toISOString()
  };
  saveVariants(variants);

  return { success: true, draft: newDraft };
}

/**
 * 4. PROMPT INTELLIGENCE INTEGRATION
 * Compare prompt versions and build prompt experiments.
 */
export function createVariantFromPromptVersion(
  experimentId: string,
  promptVersionId: string,
  name: string,
  variantKey: string
): { success: boolean; variant?: ExperimentVariant; error?: string } {
  return createVariantWorkflow(experimentId, {
    name,
    description: '',
    variantKey,
    isControl: false,
    allocationWeight: 0,
    promptHistoryId: promptVersionId,
    metadata: {
      promptVersionId
    }
  });
}

export function duplicatePromptIntoExperimentalDraft(
  promptId: string,
  experimentId: string,
  variantName: string
): { success: boolean; variant?: ExperimentVariant; error?: string } {
  // Since we shouldn't overwrite original history, we can select the prompt, and assign it to a new variant
  return createVariantWorkflow(experimentId, {
    name: variantName,
    description: '',
    variantKey: `prompt_dup_${Date.now()}`,
    isControl: false,
    allocationWeight: 0,
    promptHistoryId: promptId,
    metadata: {
      copiedFromPromptId: promptId
    }
  });
}

/**
 * 5. CREATIVE LIBRARY INTEGRATION
 * Update assets in creative library with non-breaking optional experimentation fields.
 */
export function updateCreativeAssetWithExperimentDetails(
  assetId: string,
  experimentId: string,
  variantId: string,
  isWinner: boolean,
  result: 'winner' | 'loser' | 'control' | 'treatment' | 'inconclusive',
  lift?: number,
  confidence?: number
): boolean {
  const assets = loadCreativeAssets();
  const index = assets.findIndex(a => a.id === assetId);
  if (index === -1) return false;

  const current = assets[index];
  const expIds = current.experimentIds || [];
  if (!expIds.includes(experimentId)) {
    expIds.push(experimentId);
  }

  const varIds = current.experimentVariantIds || [];
  if (!varIds.includes(variantId)) {
    varIds.push(variantId);
  }

  assets[index] = {
    ...current,
    experimentIds: expIds,
    experimentVariantIds: varIds,
    isExperimentWinner: current.isExperimentWinner || isWinner,
    experimentResult: result,
    experimentLift: lift !== undefined ? lift : current.experimentLift,
    experimentConfidence: confidence !== undefined ? confidence : current.experimentConfidence,
    lastExperimentEvaluatedAt: new Date().toISOString()
  };

  return saveCreativeAssets(assets);
}

/**
 * 6. DIGITAL HUMAN INTELLIGENCE INTEGRATION
 * Generate aggregate experiment summary metrics for a Digital Human.
 */
export interface DigitalHumanExperimentSummary {
  digitalHumanId: string;
  experimentsParticipated: number;
  wins: number;
  losses: number;
  inconclusiveResults: number;
  strongestMetric?: string;
  strongestPlatform?: string;
  strongestProductCategory?: string;
  averageLiftVersusControl: number;
  sampleSize: number;
  limitations: string[];
}

export function getDigitalHumanExperimentSummary(digitalHumanId: string): DigitalHumanExperimentSummary {
  const experiments = loadExperiments();
  const variants = loadVariants();
  const observations = loadObservations();
  const decisions = loadDecisions();

  // Find all variants containing this digital human
  const matchedVariants = variants.filter(v => v.digitalHumanId === digitalHumanId);
  const participatedExperimentIds = Array.from(new Set(matchedVariants.map(v => v.experimentId)));

  let wins = 0;
  let losses = 0;
  let inconclusiveResults = 0;
  let totalLift = 0;
  let liftCount = 0;
  let sampleSizeSum = 0;

  // Track metrics, platforms, product categories to determine strongest
  const metricLifts: Record<string, { sum: number; count: number }> = {};
  const platformLifts: Record<string, { sum: number; count: number }> = {};

  participatedExperimentIds.forEach(expId => {
    const exp = experiments.find(e => e.id === expId);
    if (!exp) return;

    // Check if there is a decision or completed analysis for this experiment
    const expDecisions = decisions.filter(d => d.experimentId === expId);
    const winDecision = expDecisions.find(d => d.decision === 'accept_winner');

    // Find all variants for this human in this experiment
    const expVars = matchedVariants.filter(v => v.experimentId === expId);
    if (expVars.length === 0) return;

    if (winDecision) {
      const hasWinningVar = expVars.some(v => winDecision.selectedVariantId === v.id);
      if (hasWinningVar) {
        wins++;
      } else {
        losses++;
      }
    } else {
      inconclusiveResults++;
    }

    expVars.forEach(expVar => {
      // Sum up sample size for this variant
      const varObs = observations.filter(o => o.variantId === expVar.id);
      varObs.forEach(o => {
        if (o.sampleSize) {
          sampleSizeSum += o.sampleSize;
        }
      });

      // Capture lift versus control (mock or evaluated lift)
      if (!expVar.isControl) {
        const controlVar = variants.find(v => v.experimentId === expId && v.isControl);
        if (controlVar) {
          const expVarObs = observations.find(o => o.variantId === expVar.id && o.metricName === exp.primaryMetric);
          const controlObs = observations.find(o => o.variantId === controlVar.id && o.metricName === exp.primaryMetric);

          if (expVarObs && controlObs && controlObs.value > 0) {
            const lift = (expVarObs.value - controlObs.value) / controlObs.value;
            totalLift += lift;
            liftCount++;

            // Track per metric
            if (!metricLifts[exp.primaryMetric]) metricLifts[exp.primaryMetric] = { sum: 0, count: 0 };
            metricLifts[exp.primaryMetric].sum += lift;
            metricLifts[exp.primaryMetric].count++;

            // Track per platform
            if (exp.platform) {
              if (!platformLifts[exp.platform]) platformLifts[exp.platform] = { sum: 0, count: 0 };
              platformLifts[exp.platform].sum += lift;
              platformLifts[exp.platform].count++;
            }
          }
        }
      }
    });
  });

  // Calculate strongest fields
  let strongestMetric: string | undefined;
  let maxMetricAvg = -Infinity;
  Object.entries(metricLifts).forEach(([m, stat]) => {
    const avg = stat.sum / stat.count;
    if (avg > maxMetricAvg) {
      maxMetricAvg = avg;
      strongestMetric = m;
    }
  });

  let strongestPlatform: string | undefined;
  let maxPlatformAvg = -Infinity;
  Object.entries(platformLifts).forEach(([p, stat]) => {
    const avg = stat.sum / stat.count;
    if (avg > maxPlatformAvg) {
      maxPlatformAvg = avg;
      strongestPlatform = p;
    }
  });

  const averageLift = liftCount > 0 ? totalLift / liftCount : 0;

  // Disclose sample size and limitations
  const limitations: string[] = [];
  if (sampleSizeSum < 1000) {
    limitations.push('Sample size is low (< 1000 impressions). Statistics are highly volatile.');
  }
  if (participatedExperimentIds.length < 3) {
    limitations.push('Fewer than 3 experiments participated. Insufficient context to rank identity or make structural decisions.');
  }

  return {
    digitalHumanId,
    experimentsParticipated: participatedExperimentIds.length,
    wins,
    losses,
    inconclusiveResults,
    strongestMetric,
    strongestPlatform,
    averageLiftVersusControl: averageLift,
    sampleSize: sampleSizeSum,
    limitations
  };
}

/**
 * 7. CAMPAIGN BUILDER INTEGRATION
 * Manage and display experiments within a campaign.
 */
export function getExperimentsForCampaign(campaignId: string): Experiment[] {
  const experiments = loadExperiments();
  return experiments.filter(e => e.campaignId === campaignId);
}

export function createExperimentForCampaign(
  campaignId: string,
  name: string,
  hypothesis: string,
  objective: string,
  primaryMetric: string,
  platform: 'tiktok' | 'youtube_shorts' | 'instagram_reels' = 'tiktok'
): { success: boolean; experiment?: Experiment; error?: string } {
  const experiments = loadExperiments();
  const id = `exp-${Date.now()}`;
  const newExp: Experiment = {
    id,
    workspaceId: 'workspace-1',
    campaignId,
    name,
    description: '',
    hypothesis,
    objective,
    experimentType: ExperimentType.AB_TEST,
    status: ExperimentStatus.DRAFT,
    primaryMetric,
    secondaryMetrics: [],
    guardrailMetrics: [],
    minimumSampleSize: 100,
    minimumRuntimeHours: 24,
    maximumRuntimeHours: 168,
    confidenceLevel: 0.95,
    minimumDetectableEffect: 0.05,
    allocationStrategy: 'even',
    platform,
    tags: [],
    owner: 'user-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (!saveExperiments([...experiments, newExp])) {
    return { success: false, error: 'Quota exceeded. Failed to save campaign experiment.' };
  }

  return { success: true, experiment: newExp };
}

export function createFollowUpCampaignFromWinner(
  experimentId: string,
  newCampaignName: string
): { success: boolean; campaign?: Campaign; error?: string } {
  const decisions = loadDecisions();
  const winnerDecision = decisions.find(d => d.experimentId === experimentId && d.decision === 'accept_winner');
  if (!winnerDecision) {
    return { success: false, error: 'No winner accepted decision found for this experiment.' };
  }

  const variants = loadVariants();
  const winningVariant = variants.find(v => v.id === winnerDecision.selectedVariantId);
  if (!winningVariant) {
    return { success: false, error: 'Winning variant not found.' };
  }

  const campaigns = loadCampaignsFromStorage();
  const newCampaignId = `camp-${Date.now()}`;
  const newCampaign: Campaign = {
    id: newCampaignId,
    name: newCampaignName,
    description: `Follow-up campaign inheriting optimal configuration from variant: ${winningVariant.name}`,
    status: 'draft',
    createdAt: new Date().toISOString(),
    characterId: winningVariant.digitalHumanId,
    productId: winningVariant.productId,
    wardrobeItemId: winningVariant.metadata?.wardrobeItemId,
    sceneId: winningVariant.metadata?.sceneId,
    poseId: winningVariant.metadata?.poseId
  };

  if (!saveCampaignsToStorage([...campaigns, newCampaign])) {
    return { success: false, error: 'Quota exceeded. Failed to create follow-up campaign.' };
  }

  return { success: true, campaign: newCampaign };
}

/**
 * 8. CREATIVE PLANNER AND AI DIRECTOR
 * Advisory proposals.
 */
export function proposeExperimentWhenEvidenceUncertain(
  campaignId: string,
  primaryMetric: string,
  rationale: string
): { success: boolean; proposal?: { experimentId: string; title: string; rationale: string } } {
  // Generates a mock advisory proposal
  return {
    success: true,
    proposal: {
      experimentId: `prop-exp-${Date.now()}`,
      title: `Advisory Experiment Proposal for ${primaryMetric}`,
      rationale: `${rationale}. Evidence remains advisory. No auto-launch will trigger.`
    }
  };
}
