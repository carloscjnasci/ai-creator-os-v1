import {
  buildExecutionProviderPackage,
  type CreativePlan,
  type ExecutionRun,
  type ExecutionTask,
} from '@/core';
import { optimizePrompt } from '@/core/creative-intelligence/promptOptimizer';
import { createId } from '@/core/id';
import { loadPromptExperiments, savePromptExperiments } from '@/features/prompt-intelligence/lib/promptExperimentStorage';
import type { PromptExperiment } from '@/features/prompt-intelligence/types';
import { loadCreativeAssets, saveCreativeAssets } from '@/features/creative-library/lib/creativeAssetStorage';
import type { CreativeAsset } from '@/features/creative-library/types';
import { loadCampaignWorkflows, saveCampaignWorkflows } from '@/features/campaign-builder/lib/campaignWorkflowStorage';

export interface RegisteredExecutionOutput {
  promptExperimentId?: string;
  creativeAssetId?: string;
}

export function registerExecutionOutput(
  run: ExecutionRun,
  task: ExecutionTask,
  plan: CreativePlan,
): RegisteredExecutionOutput {
  const providerPackage = buildExecutionProviderPackage(plan, task);
  const outputText = task.outputText?.trim() || providerPackage.content;

  if (task.domain === 'prompt' && !task.promptExperimentId) {
    const current = loadPromptExperiments();
    const related = current.filter((item) => item.campaignId === run.campaignId);
    const experiment: PromptExperiment = {
      id: createId('experiment'),
      name: `${run.name} — Provider package`,
      prompt: outputText,
      version: Math.max(0, ...related.map((item) => item.version)) + 1,
      campaignId: run.campaignId,
      model: task.providerModel ?? task.provider,
      optimization: optimizePrompt(outputText),
      viralScore: plan.viralScore,
      createdAt: new Date().toISOString(),
    };
    if (savePromptExperiments([experiment, ...current])) {
      return { promptExperimentId: experiment.id };
    }
  }

  if ((task.domain === 'image' || task.domain === 'video') && task.outputUrl?.trim() && !task.creativeAssetId) {
    const current = loadCreativeAssets();
    const asset: CreativeAsset = {
      id: createId('asset'),
      name: `${run.name} — ${task.domain === 'image' ? 'Key visual' : 'Video output'}`,
      type: task.domain,
      sourceUrl: task.outputUrl.trim(),
      campaignId: run.campaignId,
      digitalHumanId: plan.selectedCharacterId,
      productId: plan.selectedProductId,
      wardrobeItemId: plan.selectedWardrobeItemId,
      sceneId: plan.selectedSceneId,
      promptExperimentId: run.tasks.find((item) => item.domain === 'prompt')?.promptExperimentId,
      promptUsed: outputText,
      model: task.providerModel ?? task.provider,
      tags: [
        `execution:${run.id}`,
        ...(task.providerJobId ? [`provider-job:${task.providerJobId}`] : []),
        plan.intent.platform,
        plan.intent.objective,
      ],
      createdAt: new Date().toISOString(),
    };
    if (saveCreativeAssets([asset, ...current])) {
      return { creativeAssetId: asset.id };
    }
  }

  return {};
}

export function syncCampaignWorkflowFromExecution(run: ExecutionRun): boolean {
  const workflows = loadCampaignWorkflows();
  const index = workflows.findIndex((workflow) =>
    workflow.id === run.workflowId || (run.campaignId && workflow.campaignId === run.campaignId),
  );
  if (index < 0) return false;

  const taskStatus = (domain: ExecutionTask['domain']) =>
    run.tasks.find((task) => task.domain === domain)?.status;
  const prompt = taskStatus('prompt');
  const image = taskStatus('image');
  const video = taskStatus('video');
  const publishing = taskStatus('publishing');
  const analytics = taskStatus('analytics');

  const workflow = workflows[index];
  const next = {
    ...workflow,
    executionRunId: run.id,
    promptStatus: prompt === 'completed' || prompt === 'skipped' ? 'approved' as const : prompt && prompt !== 'blocked' ? 'ready' as const : 'pending' as const,
    imageStatus: image === 'completed' || image === 'skipped' ? 'approved' as const : image && image !== 'blocked' ? 'ready' as const : 'pending' as const,
    videoStatus: video === 'completed' || video === 'skipped' ? 'approved' as const : video && video !== 'blocked' ? 'ready' as const : 'pending' as const,
    publishingStatus: publishing === 'completed' || publishing === 'skipped' ? 'published' as const : publishing && publishing !== 'blocked' ? 'scheduled' as const : 'not-scheduled' as const,
    analyticsStatus: analytics === 'completed' || analytics === 'skipped' ? 'complete' as const : analytics && analytics !== 'blocked' ? 'collecting' as const : 'waiting' as const,
    updatedAt: new Date().toISOString(),
  };
  const updated = workflows.slice();
  updated[index] = next;
  return saveCampaignWorkflows(updated);
}
