import { useTranslation } from './useTranslation';

const ENUM_LABEL_KEYS: Record<string, string> = {
  new: 'common.enumLabels.new',
  reviewed: 'common.enumLabels.reviewed',
  accepted: 'common.enumLabels.accepted',
  dismissed: 'common.enumLabels.dismissed',
  proposed: 'common.enumLabels.proposed',
  applied: 'common.enumLabels.applied',
  superseded: 'common.enumLabels.superseded',
  queued: 'common.enumLabels.queued',
  processing: 'common.enumLabels.processing',
  'in-progress': 'common.enumLabels.inProgress',
  in_progress: 'common.enumLabels.inProgress',
  review: 'common.enumLabels.review',
  blocked: 'common.enumLabels.blocked',
  evaluating: 'common.enumLabels.evaluating',
  stopped: 'common.enumLabels.stopped',
  waiting: 'common.enumLabels.waiting',
  collecting: 'common.enumLabels.collecting',
  'not-scheduled': 'common.enumLabels.notScheduled',
  not_scheduled: 'common.enumLabels.notScheduled',
  previewed: 'common.enumLabels.previewed',
  preview: 'common.enumLabels.previewed',
  applying: 'common.enumLabels.applying',
  normalized: 'common.enumLabels.normalized',
  attributed: 'common.enumLabels.attributed',
  analyzed: 'common.enumLabels.analyzed',
  hook: 'common.enumLabels.hook',
  script: 'common.enumLabels.script',
  prompt: 'common.enumLabels.prompt',
  visual_style: 'common.enumLabels.visualStyle',
  product_demo: 'common.enumLabels.productDemo',
  campaign: 'common.enumLabels.campaign',
  publication: 'common.enumLabels.publication',
  experimentation: 'common.enumLabels.experimentation',
  full_workflow: 'common.enumLabels.fullWorkflow',
  other: 'common.enumLabels.other',
  improve_hook: 'common.enumLabels.improveHook',
  shorten_intro: 'common.enumLabels.shortenIntro',
  strengthen_cta: 'common.enumLabels.strengthenCta',
  reuse_prompt_structure: 'common.enumLabels.reusePromptStructure',
  test_other_digital_human: 'common.enumLabels.testOtherDigitalHuman',
  preserve_wardrobe_combination: 'common.enumLabels.preserveWardrobeCombination',
  test_new_scene: 'common.enumLabels.testNewScene',
  adjust_publishing_time: 'common.enumLabels.adjustPublishingTime',
  adapt_for_platform: 'common.enumLabels.adaptForPlatform',
  create_ab_variation: 'common.enumLabels.createAbVariation',
  stop_repeating_weak_structure: 'common.enumLabels.stopRepeatingWeakStructure',
  retention: 'common.enumLabels.retention',
  storytelling: 'common.enumLabels.storytelling',
  cta: 'common.enumLabels.cta',
  emotion: 'common.enumLabels.emotion',
  'product fit': 'common.enumLabels.productFit',
  digital_human: 'common.enumLabels.digitalHuman',
  'digital human': 'common.enumLabels.digitalHuman',
  wardrobe: 'common.enumLabels.wardrobe',
  scene: 'common.enumLabels.scene',
  'prompt structure': 'common.enumLabels.promptStructure',
  platform: 'common.enumLabels.platform',
  timing: 'common.enumLabels.timing',
  conversion: 'common.enumLabels.conversion',
  'publishing cadence': 'common.enumLabels.publishingCadence',
  'audience response': 'common.enumLabels.audienceResponse',
  anomaly: 'common.enumLabels.anomaly',
  outlier: 'common.enumLabels.outlier',
  first_hour: 'common.enumLabels.firstHour',
  first_24_hours: 'common.enumLabels.first24Hours',
  first_7_days: 'common.enumLabels.first7Days',
  first_30_days: 'common.enumLabels.first30Days',
  lifetime: 'common.enumLabels.lifetime',
  custom: 'common.enumLabels.custom',
  'mock-ready': 'common.enumLabels.mockReady',
  mock_ready: 'common.enumLabels.mockReady',
  disconnected: 'common.enumLabels.disconnected',
  connected: 'common.enumLabels.connected',
  disabled: 'common.enumLabels.disabled',
};

export function useDisplayHelpers() {
  const { t } = useTranslation();

  const translateEnumLabel = (value?: string): string => {
    if (!value) return '';
    const normalized = value.trim().toLowerCase();
    const key = ENUM_LABEL_KEYS[normalized];
    if (key) return t(key);
    return value
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  const translateStatus = (status?: string): string => {
    if (!status) return '';
    const lower = status.toLowerCase();
    switch (lower) {
      case 'in-review':
      case 'in_review':
      case 'pending_review':
        return t('pages.publishingHub.awaitingReview');
      case 'publishing':
        return t('common.running');
      case 'active':
        return t('common.active');
      case 'draft':
        return t('common.draft');
      case 'ready':
        return t('common.ready');
      case 'deprecated':
        return t('common.deprecated');
      case 'archived':
        return t('common.archived');
      case 'failed':
        return t('common.failed');
      case 'validating':
        return t('common.validating');
      case 'paused':
        return t('common.paused');
      case 'running':
        return t('common.running');
      case 'completed':
      case 'complete':
      case 'succeeded':
        return t('common.completed');
      case 'pending':
        return t('common.pending');
      case 'approved':
        return t('common.approved');
      case 'rejected':
        return t('common.rejected');
      case 'scheduled':
        return t('common.scheduled');
      case 'published':
        return t('common.published');
      case 'cancelled':
      case 'cancelled_by_user':
        return t('common.cancelled');
      case 'interrupted':
        return t('common.interrupted');
      default:
        return translateEnumLabel(status);
    }
  };

  const translatePlatform = (platform?: string): string => {
    if (!platform) return '';
    const lower = platform.toLowerCase();
    switch (lower) {
      case 'instagram':
        return 'Instagram';
      case 'instagram_reels':
      case 'instagram-reels':
        return 'Instagram Reels';
      case 'tiktok':
        return 'TikTok';
      case 'tiktok_shop':
      case 'tiktok-shop':
        return 'TikTok Shop';
      case 'facebook':
        return 'Facebook';
      case 'youtube':
        return 'YouTube';
      case 'youtube_shorts':
      case 'youtube-shorts':
        return 'YouTube Shorts';
      case 'linkedin':
        return 'LinkedIn';
      case 'pinterest':
        return 'Pinterest';
      case 'twitter':
      case 'x':
        return 'X / Twitter';
      case 'veo-3':
        return 'Google Veo 3';
      case 'grok':
        return 'Grok';
      case 'nano-banana':
        return 'Nano Banana';
      case 'generic':
        return t('common.genericAiGenerator');
      case 'all':
        return t('pages.publishingHub.allPlatforms');
      case 'other':
        return t('common.enumLabels.other');
      default:
        return translateEnumLabel(platform);
    }
  };

  const translateObjective = (objective: string): string => {
    if (!objective) return '';
    const lower = objective.toLowerCase();
    switch (lower) {
      case 'sales':
      case 'vendas':
        return t('common.sales');
      case 'leads':
        return t('common.leads');
      case 'awareness':
      case 'reconhecimento':
        return t('common.awareness');
      case 'traffic':
      case 'tráfego':
      case 'tráfico':
        return t('common.traffic');
      case 'virality':
      case 'viralidade':
      case 'viralidad':
        return t('common.virality');
      case 'engagement':
      case 'engajamento':
      case 'interacción':
        return t('common.engagement');
      case 'ctr':
        return t('common.ctr');
      case 'launch':
      case 'lançamento':
      case 'lanzamiento':
        return t('common.launch');
      case 'education':
      case 'educação':
      case 'educación':
        return t('common.education');
      default:
        return translateEnumLabel(objective);
    }
  };

  const translateOutputType = (outputType: string): string => {
    if (!outputType) return '';
    const lower = outputType.toLowerCase();
    switch (lower) {
      case 'image':
      case 'images':
        return t('pages.assetPipeline.images');
      case 'video':
      case 'videos':
        return t('pages.assetPipeline.videos');
      case 'document':
      case 'documents':
        return t('pages.assetPipeline.documents');
      case 'audio':
        return t('pages.assetPipeline.audioTracks');
      default:
        return translateEnumLabel(outputType);
    }
  };

  const translateAspectRatio = (aspectRatio: string): string => {
    if (!aspectRatio) return '';
    const lower = aspectRatio.toLowerCase();
    switch (lower) {
      case '16:9':
      case 'landscape':
        return `16:9 (${t('common.landscape')})`;
      case '9:16':
      case 'portrait':
        return `9:16 (${t('common.portrait')})`;
      case '1:1':
      case 'square':
        return `1:1 (${t('common.square')})`;
      case '4:3':
        return '4:3';
      case '4:5':
        return '4:5';
      default:
        return aspectRatio;
    }
  };

  const translatePublicationMode = (mode: string): string => {
    if (!mode) return '';
    const lower = mode.toLowerCase();
    switch (lower) {
      case 'mock':
        return t('pages.publishingHub.mockSimulation');
      case 'manual':
        return t('pages.publishingHub.manualExport');
      case 'secure-backend':
      case 'secure_backend':
        return t('pages.publishingHub.secureBackend');
      default:
        return translateEnumLabel(mode);
    }
  };

  const translateFilter = (filter: string): string => {
    if (!filter) return '';
    return filter.toLowerCase() === 'all' ? t('common.all') : translateEnumLabel(filter);
  };

  const translateExperimentDecision = (decision: string): string => {
    if (!decision) return '';
    const lower = decision.toLowerCase();
    switch (lower) {
      case 'accept_winner':
      case 'acceptwinner':
        return t('pages.experimentation.acceptWinner');
      case 'reject_winner':
      case 'rejectwinner':
        return t('pages.experimentation.rejectWinner');
      case 'continue_experiment':
        return t('pages.experimentation.continueExperiment');
      case 'stop_experiment':
        return t('pages.experimentation.stopExperiment');
      case 'create_follow_up':
        return t('pages.experimentation.createFollowUp');
      case 'archive_without_action':
        return t('pages.experimentation.archiveWithoutAction');
      default:
        return translateEnumLabel(decision);
    }
  };

  return {
    translateStatus,
    getStatusLabel: translateStatus,
    translatePlatform,
    getPlatformLabel: translatePlatform,
    translateObjective,
    translateOutputType,
    translateAspectRatio,
    translatePublicationMode,
    translateFilter,
    translateExperimentDecision,
    translateEnumLabel,
    translateCreativeRecipeCategory: translateEnumLabel,
    translateAnalyticsRecommendationType: translateEnumLabel,
    translateInsightCategory: translateEnumLabel,
  };
}
