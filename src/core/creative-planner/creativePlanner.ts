import { createId } from '../id';
import type {
  CreativeIntent,
  CreativePlan,
  CreativeWorkspaceSnapshot,
  ExecutionPlanStep,
} from '../types';
import { calculateViralScore } from '../creative-intelligence/viralScore';

function choose<T extends { id: string }>(items: T[], preferredId?: string): T | undefined {
  return items.find((item) => item.id === preferredId) ?? items[0];
}

function objectiveLabel(intent: CreativeIntent): string {
  const labels: Record<CreativeIntent['objective'], string> = {
    sales: 'conversion-focused sales',
    virality: 'maximum short-form retention and shareability',
    awareness: 'brand awareness and memorability',
    engagement: 'comments, saves and community interaction',
    ctr: 'click-through rate optimization',
    launch: 'product launch momentum',
    education: 'clear educational value with creator authority',
  };
  return labels[intent.objective];
}

export function createCreativePlan(
  intent: CreativeIntent,
  workspace: CreativeWorkspaceSnapshot,
): CreativePlan {
  const character = choose(workspace.characters, intent.digitalHumanId);
  const product = choose(workspace.products, intent.productId);
  const wardrobe = choose(workspace.wardrobe);
  const scene = choose(workspace.scenes);
  const pose = choose(workspace.poses);
  const audience = intent.targetAudience.trim() || 'the campaign target audience';
  const productName = product?.name || 'the selected product';
  const characterName = character?.name || 'the selected Digital Human';
  const wardrobeName = wardrobe?.name || 'a brand-aligned outfit';
  const sceneName = scene?.name || 'a contextually relevant scene';
  const poseName = pose?.name || 'a natural product-revealing pose';
  const hook = `Stop scrolling: ${productName} solves the problem ${audience} notices first.`;
  const cta = intent.platform === 'tiktok-shop'
    ? 'Tap the orange cart and secure yours before the current availability changes.'
    : 'Take the next action now while the idea is still top of mind.';
  const strategy = `Create a ${objectiveLabel(intent)} campaign for ${intent.platform}. Use ${characterName} as the consistent creative identity, show ${productName} within the first visual beat, and connect the message to ${audience}.`;

  const script = [
    hook,
    `${characterName} demonstrates ${productName} in ${sceneName}, using ${wardrobeName} and ${poseName} to make the benefit instantly visible.`,
    cta,
  ];

  let learningSignalsApplied = '';
  if (typeof localStorage !== 'undefined') {
    try {
      const rawContext = localStorage.getItem('ai_creator_os:learning_context');
      const rawRecs = localStorage.getItem('ai_creator_os:recommendations');
      const context = rawContext ? JSON.parse(rawContext) : null;
      const recs = rawRecs ? JSON.parse(rawRecs) : [];

      if (context && Array.isArray(recs)) {
        const disabledSignals = context.disabledSignals || [];
        
        // accepted recommendations may be considered
        // rejected recommendations must not be reused
        // disabled signals must be ignored
        const acceptedRecs = recs.filter((r: any) => 
          r.status === 'accepted' && 
          !disabledSignals.includes(r.id) &&
          !disabledSignals.includes(r.recommendationType)
        );

        for (const rec of acceptedRecs) {
          if (rec.proposedChange) {
            learningSignalsApplied += ` [Advisory Recommendation: ${rec.proposedChange} (Confidence: ${rec.confidence || 1.0})]`;
          }
        }
      }
    } catch (e) {
      console.error('Error loading learning context in planner:', e);
    }
  }

  const basePrompt = `Feature ${characterName} with ${productName}. Wardrobe: ${wardrobeName}. Scene: ${sceneName}. Pose: ${poseName}. Audience: ${audience}. Goal: ${intent.goal}. Preserve product and Digital Human identity, realistic anatomy, natural movement, accurate materials, and platform-native framing.${learningSignalsApplied}`;

  const executionPlan: ExecutionPlanStep[] = [
    ['strategy', 'Creative strategy', 'Convert the Creative Intent into a measurable campaign hypothesis.'],
    ['product', 'Product selection', product ? `Use ${product.name}.` : 'Select or register a product before production.'],
    ['digital-human', 'Digital Human', character ? `Use ${character.name} and its DNA.` : 'Select or create a Digital Human.'],
    ['wardrobe', 'Wardrobe', wardrobe ? `Use ${wardrobe.name}.` : 'Select a wardrobe item or define styling rules.'],
    ['scene', 'Scene and pose', `${sceneName}; ${poseName}.`],
    ['prompt', 'Prompt package', 'Generate provider-specific image and motion prompts.'],
    ['image', 'Image production', 'Create and review the key visual before motion generation.'],
    ['video', 'Video production', 'Generate short-form motion using the approved image and script.'],
    ['publishing', 'Publishing package', 'Use title, caption, hashtags and thumbnail concept.'],
    ['analytics', 'Learning loop', 'Record results and feed performance back into Prompt Intelligence.'],
  ].map(([domain, label, description], index) => ({
    id: createId('step'),
    order: index + 1,
    domain: domain as ExecutionPlanStep['domain'],
    label,
    description,
    status:
      (domain === 'product' && !product) || (domain === 'digital-human' && !character)
        ? 'blocked'
        : 'ready',
    provider:
      domain === 'image' ? 'Imagen / Gemini' : domain === 'video' ? 'Flow / Veo' : undefined,
  }));

  const viralScore = calculateViralScore({
    goal: intent.goal,
    targetAudience: audience,
    platform: intent.platform,
    objective: intent.objective,
    hook,
    cta,
    story: script.join(' '),
    emotion: 'curiosity confidence urgency desire',
    clothing: wardrobeName,
    trendSignals: [intent.platform, objectiveLabel(intent)],
    productName,
  });

  return {
    id: createId('plan'),
    intent,
    campaignName: `${productName} — ${intent.platform} ${intent.objective}`,
    strategy,
    selectedCharacterId: character?.id,
    selectedProductId: product?.id,
    selectedWardrobeItemId: wardrobe?.id,
    selectedSceneId: scene?.id,
    selectedPoseId: pose?.id,
    deliverables: {
      hook,
      script,
      imagePrompt: `Create an ultra-realistic campaign image. ${basePrompt} Composition must make the product the primary visual subject, with premium editorial lighting, true-to-life textures and no unintended text or logos.`,
      videoPrompt: `Create a short-form ${intent.platform} video. ${basePrompt} Use a strong first-second reveal, controlled camera motion, three clear beats, natural timing and no visual deformation. Narration structure: ${script.join(' / ')}`,
      flowPrompt: `FLOW / VEO MOTION BRIEF\n${basePrompt}\nDuration: 8 seconds per take. Movement: subtle, fluid, sales-oriented. Maintain face, body, wardrobe and product continuity. Avoid extra hands, lip movement unless narration is explicitly enabled, abrupt cuts and overlays.`,
      veoPrompt: `VEO EXECUTION PROMPT\nPlatform: ${intent.platform}.\n${basePrompt}\nHook: ${hook}\nBody: ${script[1]}\nCTA: ${cta}\nUse cinematic realism, natural physics and consistent identity across frames.`,
      thumbnailConcept: `${characterName} holds or demonstrates ${productName} in a clear product-first composition, with one strong emotional expression and high visual contrast.`,
      title: `${productName}: the detail ${audience} needs to see`,
      caption: `${hook} ${cta}`,
      hashtags: ['#AICreatorOS', `#${intent.platform.replace(/-/g, '')}`, '#ConteudoComIA', '#CreativeStrategy'],
    },
    executionPlan,
    viralScore,
    createdAt: new Date().toISOString(),
  };
}
