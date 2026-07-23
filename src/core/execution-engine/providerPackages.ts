import type { ExecutionPlanLike, ExecutionProviderPackage, ExecutionTask } from './types';

function safeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'execution-package';
}

export function buildExecutionProviderPackage(
  plan: ExecutionPlanLike,
  task: ExecutionTask,
): ExecutionProviderPackage {
  let content = task.instruction;
  let title = task.label;

  switch (task.domain) {
    case 'strategy':
      content = `${plan.strategy}\n\nCreative Intent: ${plan.intent.goal}\nAudience: ${plan.intent.targetAudience}\nPlatform: ${plan.intent.platform}\nObjective: ${plan.intent.objective}`;
      break;
    case 'product':
      content = `Selected product ID: ${plan.selectedProductId ?? 'not selected'}\n${task.instruction}`;
      break;
    case 'digital-human':
      content = `Selected Digital Human ID: ${plan.selectedCharacterId ?? 'not selected'}\n${task.instruction}`;
      break;
    case 'wardrobe':
      content = `Selected wardrobe ID: ${plan.selectedWardrobeItemId ?? 'not selected'}\n${task.instruction}`;
      break;
    case 'scene':
      content = `Scene ID: ${plan.selectedSceneId ?? 'not selected'}\nPose ID: ${plan.selectedPoseId ?? 'not selected'}\n${task.instruction}`;
      break;
    case 'prompt':
      title = 'Complete provider prompt package';
      content = [
        `HOOK\n${plan.deliverables.hook}`,
        `SCRIPT\n${plan.deliverables.script.join('\n')}`,
        `IMAGE PROMPT\n${plan.deliverables.imagePrompt}`,
        `FLOW PROMPT\n${plan.deliverables.flowPrompt}`,
        `VEO PROMPT\n${plan.deliverables.veoPrompt}`,
      ].join('\n\n---\n\n');
      break;
    case 'image':
      title = 'Imagen / Gemini image package';
      content = plan.deliverables.imagePrompt;
      break;
    case 'video':
      title = 'Flow / Veo video package';
      content = `${plan.deliverables.veoPrompt}\n\n--- FLOW ALTERNATIVE ---\n\n${plan.deliverables.flowPrompt}`;
      break;
    case 'publishing':
      title = 'Publishing package';
      content = `${plan.deliverables.title}\n\n${plan.deliverables.caption}\n\n${plan.deliverables.hashtags.join(' ')}\n\nThumbnail: ${plan.deliverables.thumbnailConcept}`;
      break;
    case 'analytics':
      title = 'Learning-loop baseline';
      content = JSON.stringify(
        {
          hypothesis: plan.strategy,
          estimatedViralScore: plan.viralScore,
          objective: plan.intent.objective,
          platform: plan.intent.platform,
        },
        null,
        2,
      );
      break;
  }

  return {
    provider: task.provider,
    title,
    content,
    suggestedFileName: `${safeName(plan.campaignName)}-${task.order}-${safeName(task.domain)}.txt`,
  };
}
