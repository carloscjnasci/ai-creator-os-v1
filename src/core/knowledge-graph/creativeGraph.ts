import type { Campaign } from '@/features/campaigns/types';
import type { PromptHistoryEntry } from '@/features/prompt-engine/types';
import type { CreativeAsset } from '@/features/creative-library/types';
import type { CampaignWorkflow } from '@/features/campaign-builder/types';
import type { ExecutionRun } from '@/core/execution-engine';
import type { ProviderJob } from '@/core/provider-gateway';
import type { CloudAssetRecord } from '@/features/asset-pipeline/types';
import type { PublicationDraft, PublishingJob } from '@/features/publishing-hub/types';

export interface CreativeGraphNode {
  id: string;
  type:
    | 'campaign'
    | 'character'
    | 'product'
    | 'asset'
    | 'prompt'
    | 'workflow'
    | 'execution-run'
    | 'execution-task'
    | 'provider-job'
    | 'cloud-asset'
    | 'publication'
    | 'publishing-job'
    | 'performance-snapshot'
    | 'scorecard'
    | 'insight'
    | 'recommendation'
    | 'feedback-decision'
    | 'calibration-record'
    | 'experiment'
    | 'experiment-variant'
    | 'experiment-observation'
    | 'experiment-analysis'
    | 'experiment-recommendation'
    | 'experiment-decision'
    | 'recipe'
    | 'recipe-version'
    | 'recipe-evidence'
    | 'recipe-scorecard'
    | 'recipe-recommendation'
    | 'recipe-application';
  label: string;
}

export interface CreativeGraphEdge {
  source: string;
  target: string;
  relation: string;
}

export interface CreativeGraph {
  nodes: CreativeGraphNode[];
  edges: CreativeGraphEdge[];
}

export function buildCreativeGraph(input: {
  campaigns: Campaign[];
  promptHistory: PromptHistoryEntry[];
  assets: CreativeAsset[];
  workflows: CampaignWorkflow[];
  executionRuns?: ExecutionRun[];
  providerJobs?: ProviderJob[];
  cloudAssets?: CloudAssetRecord[];
  publications?: PublicationDraft[];
  publishingJobs?: PublishingJob[];
  performanceSnapshots?: any[];
  scorecards?: any[];
  insights?: any[];
  recommendations?: any[];
  feedbackDecisions?: any[];
  calibrationRecords?: any[];
  experiments?: any[];
  experimentVariants?: any[];
  observations?: any[];
  analyses?: any[];
  experimentRecommendations?: any[];
  decisions?: any[];
  recipes?: any[];
  recipeVersions?: any[];
  recipeEvidence?: any[];
  recipeScorecards?: any[];
  recipeRecommendations?: any[];
  recipeApplications?: any[];
}): CreativeGraph {
  const nodes = new Map<string, CreativeGraphNode>();
  const uniqueEdges: CreativeGraphEdge[] = [];
  const edgeKeys = new Set<string>();

  function addEdge(source: string, target: string, relation: string) {
    const key = `${source}->${relation}->${target}`;
    if (!edgeKeys.has(key)) {
      edgeKeys.add(key);
      uniqueEdges.push({ source, target, relation });
    }
  }

  for (const campaign of input.campaigns) {
    nodes.set(`campaign:${campaign.id}`, { id: `campaign:${campaign.id}`, type: 'campaign', label: campaign.name });
    const relationships = [
      ['character', campaign.characterId],
      ['product', campaign.productId],
    ] as const;
    for (const [type, id] of relationships) {
      if (!id) continue;
      nodes.set(`${type}:${id}`, { id: `${type}:${id}`, type, label: `${type} ${id}` });
      addEdge(`campaign:${campaign.id}`, `${type}:${id}`, `uses-${type}`);
    }
  }

  for (const prompt of input.promptHistory) {
    nodes.set(`prompt:${prompt.id}`, { id: `prompt:${prompt.id}`, type: 'prompt', label: prompt.generatedPrompt.slice(0, 50) });
    if (prompt.campaignId) {
      addEdge(`prompt:${prompt.id}`, `campaign:${prompt.campaignId}`, 'belongs-to');
    }
  }

  for (const asset of input.assets) {
    nodes.set(`asset:${asset.id}`, { id: `asset:${asset.id}`, type: 'asset', label: asset.name });
    if (asset.campaignId) {
      addEdge(`asset:${asset.id}`, `campaign:${asset.campaignId}`, 'produced-for');
    }
  }

  for (const workflow of input.workflows) {
    nodes.set(`workflow:${workflow.id}`, { id: `workflow:${workflow.id}`, type: 'workflow', label: workflow.name });
    if (workflow.campaignId) {
      addEdge(`workflow:${workflow.id}`, `campaign:${workflow.campaignId}`, 'orchestrates');
    }
  }

  for (const run of input.executionRuns ?? []) {
    const runNodeId = `execution-run:${run.id}`;
    nodes.set(runNodeId, { id: runNodeId, type: 'execution-run', label: run.name });
    if (run.campaignId) {
      addEdge(runNodeId, `campaign:${run.campaignId}`, 'executes');
    }
    if (run.workflowId) {
      addEdge(runNodeId, `workflow:${run.workflowId}`, 'implements');
    }
    for (const task of run.tasks) {
      const taskNodeId = `execution-task:${task.id}`;
      nodes.set(taskNodeId, { id: taskNodeId, type: 'execution-task', label: task.label });
      addEdge(taskNodeId, runNodeId, 'part-of');
      if (task.creativeAssetId) {
        addEdge(taskNodeId, `asset:${task.creativeAssetId}`, 'produced');
      }
    }
  }

  for (const job of input.providerJobs ?? []) {
    const jobNodeId = `provider-job:${job.id}`;
    nodes.set(jobNodeId, {
      id: jobNodeId,
      type: 'provider-job',
      label: `${job.providerId}/${job.model} · ${job.status}`,
    });
    addEdge(jobNodeId, `execution-task:${job.executionTaskId}`, 'executes');
  }

  for (const cloudAsset of input.cloudAssets ?? []) {
    const cloudNodeId = `cloud-asset:${cloudAsset.id}`;
    nodes.set(cloudNodeId, {
      id: cloudNodeId,
      type: 'cloud-asset',
      label: cloudAsset.displayName || cloudAsset.originalFilename || 'Cloud Asset',
    });

    if (cloudAsset.parentAssetId) {
      addEdge(`cloud-asset:${cloudAsset.parentAssetId}`, cloudNodeId, 'derives');
    }

    if (cloudAsset.providerJobId) {
      addEdge(`provider-job:${cloudAsset.providerJobId}`, cloudNodeId, 'produced-asset');
    }

    if (cloudAsset.executionTaskId) {
      addEdge(`execution-task:${cloudAsset.executionTaskId}`, cloudNodeId, 'generated');
    }

    if (cloudAsset.creativeLibraryAssetId) {
      addEdge(cloudNodeId, `asset:${cloudAsset.creativeLibraryAssetId}`, 'registers');
    }

    if (cloudAsset.campaignId) {
      addEdge(`campaign:${cloudAsset.campaignId}`, cloudNodeId, 'owns-asset');
    }
  }


  for (const publication of input.publications ?? []) {
    const publicationNodeId = `publication:${publication.id}`;
    nodes.set(publicationNodeId, {
      id: publicationNodeId,
      type: 'publication',
      label: `${publication.platform} · ${publication.title || publication.caption.slice(0, 40) || 'Publication'}`,
    });
    if (publication.campaignId) addEdge(publicationNodeId, `campaign:${publication.campaignId}`, 'publishes-for');
    if (publication.executionTaskId) addEdge(`execution-task:${publication.executionTaskId}`, publicationNodeId, 'prepares-publication');
    if (publication.creativeAssetId) addEdge(`asset:${publication.creativeAssetId}`, publicationNodeId, 'published-as');
    if (publication.cloudAssetId) addEdge(`cloud-asset:${publication.cloudAssetId}`, publicationNodeId, 'source-for-publication');
  }

  for (const job of input.publishingJobs ?? []) {
    const jobNodeId = `publishing-job:${job.id}`;
    nodes.set(jobNodeId, {
      id: jobNodeId,
      type: 'publishing-job',
      label: `${job.platform} · ${job.status}`,
    });
    addEdge(jobNodeId, `publication:${job.publicationId}`, 'executes-publication');
  }

  // Performance analytics entities loops (Idempotent relations)
  for (const snapshot of input.performanceSnapshots ?? []) {
    const snapId = `performance-snapshot:${snapshot.id}`;
    nodes.set(snapId, { id: snapId, type: 'performance-snapshot', label: `Snapshot · ${snapshot.platform} · ${snapshot.metricWindow}` });

    if (snapshot.publicationDraftId) addEdge(`publication:${snapshot.publicationDraftId}`, snapId, 'tracked-performance');
    if (snapshot.campaignId) addEdge(`campaign:${snapshot.campaignId}`, snapId, 'campaign-performance');
    if (snapshot.creativeLibraryAssetId) addEdge(`asset:${snapshot.creativeLibraryAssetId}`, snapId, 'asset-performance');
    if (snapshot.promptHistoryId) addEdge(`prompt:${snapshot.promptHistoryId}`, snapId, 'prompt-performance');
    if (snapshot.digitalHumanId) addEdge(`character:${snapshot.digitalHumanId}`, snapId, 'human-performance');
  }

  for (const scorecard of input.scorecards ?? []) {
    const scId = `scorecard:${scorecard.id}`;
    nodes.set(scId, { id: scId, type: 'scorecard', label: `Scorecard · Score: ${scorecard.overallScore}` });
    addEdge(`performance-snapshot:${scorecard.snapshotId}`, scId, 'evaluated-by');
  }

  for (const insight of input.insights ?? []) {
    const insId = `insight:${insight.id}`;
    nodes.set(insId, { id: insId, type: 'insight', label: `Insight · ${insight.title}` });
    for (const snapId of insight.relatedSnapshotIds ?? []) {
      addEdge(`scorecard:${snapId}`, insId, 'triggers-insight');
    }
  }

  for (const rec of input.recommendations ?? []) {
    const recId = `recommendation:${rec.id}`;
    nodes.set(recId, { id: recId, type: 'recommendation', label: `Recommendation · ${rec.proposedChange.slice(0, 50)}` });
    for (const [entityType, entityId] of Object.entries(rec.targetEntities ?? {})) {
      addEdge(recId, `${entityType}:${entityId}`, 'targets');
    }
  }

  for (const dec of input.feedbackDecisions ?? []) {
    const decId = `feedback-decision:${dec.id}`;
    nodes.set(decId, { id: decId, type: 'feedback-decision', label: `Decision · ${dec.action}` });
    addEdge(`recommendation:${dec.recommendationId}`, decId, 'resolved-by');
    addEdge(decId, `${dec.targetEntityType}:${dec.targetEntityId}`, 'modified');
  }

  for (const cal of input.calibrationRecords ?? []) {
    const calId = `calibration-record:${cal.id}`;
    nodes.set(calId, { id: calId, type: 'calibration-record', label: `Calibration · Gap: ${cal.predictionGap.toFixed(1)}` });
    addEdge(`performance-snapshot:${cal.predictionId}`, calId, 'calibrated-against');
  }

  // Idempotent Experimentation Nodes and Edges
  for (const exp of input.experiments ?? []) {
    const expId = `experiment:${exp.id}`;
    nodes.set(expId, { id: expId, type: 'experiment', label: exp.name });
    if (exp.campaignId) {
      addEdge(expId, `campaign:${exp.campaignId}`, 'TESTS');
    }
  }

  for (const variant of input.experimentVariants ?? []) {
    const varId = `experiment-variant:${variant.id}`;
    nodes.set(varId, { id: varId, type: 'experiment-variant', label: variant.name });
    if (variant.experimentId) {
      addEdge(varId, `experiment:${variant.experimentId}`, 'BELONGS_TO');
    }
  }

  for (const obs of input.observations ?? []) {
    const obsId = `experiment-observation:${obs.id}`;
    nodes.set(obsId, { id: obsId, type: 'experiment-observation', label: `${obs.metricName} · ${obs.value}` });
    if (obs.variantId) {
      addEdge(obsId, `experiment-variant:${obs.variantId}`, 'EVALUATES');
    }
  }

  for (const an of input.analyses ?? []) {
    const anId = `experiment-analysis:${an.id}`;
    nodes.set(anId, { id: anId, type: 'experiment-analysis', label: `Analysis · Winner: ${an.winnerVariantId || 'None'}` });
    if (an.experimentId) {
      addEdge(anId, `experiment:${an.experimentId}`, 'EVALUATES');
    }
  }

  for (const rec of input.experimentRecommendations ?? []) {
    const recId = `experiment-recommendation:${rec.id}`;
    nodes.set(recId, { id: recId, type: 'experiment-recommendation', label: rec.recommendationText || 'Experiment Recommendation' });
    if (rec.analysisId) {
      addEdge(recId, `experiment-analysis:${rec.analysisId}`, 'SOLVES');
    }
  }

  for (const dec of input.decisions ?? []) {
    const decId = `experiment-decision:${dec.id}`;
    nodes.set(decId, { id: decId, type: 'experiment-decision', label: `Decision · ${dec.decision}` });
    if (dec.recommendationId) {
      addEdge(decId, `experiment-recommendation:${dec.recommendationId}`, 'APPLIES_TO');
    }
  }

  // Creative Recipes Nodes and Edges
  for (const recipe of input.recipes ?? []) {
    const recNodeId = `recipe:${recipe.id}`;
    nodes.set(recNodeId, { id: recNodeId, type: 'recipe', label: recipe.name });
  }

  for (const ver of input.recipeVersions ?? []) {
    const verNodeId = `recipe-version:${ver.id}`;
    nodes.set(verNodeId, { id: verNodeId, type: 'recipe-version', label: `Version ${ver.versionLabel}` });
    if (ver.recipeId) {
      addEdge(verNodeId, `recipe:${ver.recipeId}`, 'VERSION_OF');
    }
  }

  for (const ev of input.recipeEvidence ?? []) {
    const evNodeId = `recipe-evidence:${ev.id}`;
    nodes.set(evNodeId, { id: evNodeId, type: 'recipe-evidence', label: `Evidence: +${ev.relativeLift}% ${ev.metricName}` });
    if (ev.recipeId) addEdge(evNodeId, `recipe:${ev.recipeId}`, 'EVIDENCE_FOR');
    if (ev.recipeVersionId) addEdge(evNodeId, `recipe-version:${ev.recipeVersionId}`, 'OBSERVED_ON');
  }

  for (const sc of input.recipeScorecards ?? []) {
    const scNodeId = `recipe-scorecard:${sc.id}`;
    nodes.set(scNodeId, { id: scNodeId, type: 'recipe-scorecard', label: `Scorecard · Score: ${sc.overallScore}` });
    if (sc.recipeId) addEdge(scNodeId, `recipe:${sc.recipeId}`, 'EVALUATES_RECIPE');
    if (sc.recipeVersionId) addEdge(scNodeId, `recipe-version:${sc.recipeVersionId}`, 'EVALUATES_VERSION');
  }

  for (const rec of input.recipeRecommendations ?? []) {
    const recNodeId = `recipe-recommendation:${rec.id}`;
    nodes.set(recNodeId, { id: recNodeId, type: 'recipe-recommendation', label: rec.title });
    if (rec.recipeId) addEdge(recNodeId, `recipe:${rec.recipeId}`, 'RECOMMENDS');
  }

  for (const app of input.recipeApplications ?? []) {
    const appNodeId = `recipe-application:${app.id}`;
    nodes.set(appNodeId, { id: appNodeId, type: 'recipe-application', label: `Application · ${app.status}` });
    if (app.recipeId) addEdge(appNodeId, `recipe:${app.recipeId}`, 'APPLIES_RECIPE');
    if (app.recipeVersionId) addEdge(appNodeId, `recipe-version:${app.recipeVersionId}`, 'APPLIES_VERSION');
  }

  return { nodes: Array.from(nodes.values()), edges: uniqueEdges };
}
