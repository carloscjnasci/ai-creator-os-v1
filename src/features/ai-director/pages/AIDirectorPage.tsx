import { useTranslation } from '@/features/i18n/useTranslation';
import { useDisplayHelpers } from '@/features/i18n';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, PlayCircle, Save, Sparkles, WandSparkles } from 'lucide-react';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import AppSelect from '@/components/ui/AppSelect';
import AppTextarea from '@/components/ui/AppTextarea';
import AppInput from '@/components/ui/AppInput';
import { CosModuleShell, MetricCard, ScoreBar } from '@/components/common';
import {
  CREATIVE_OBJECTIVES,
  CREATIVE_PLATFORMS,
  createCreativePlan,
  createExecutionRun,
  createId,
  loadCreativeWorkspaceSnapshot,
  publishCreativeEvent,
  type CreativeIntent,
  type CreativeObjective,
  type CreativePlan,
  type CreativePlatform,
} from '@/core';
import { loadCreativePlans, saveCreativePlans } from '../lib/creativePlanStorage';
import { loadCampaignsFromStorage, saveCampaignsToStorage } from '@/features/campaigns/lib/campaignStorage';
import type { Campaign } from '@/features/campaigns/types';
import { loadCampaignWorkflows, saveCampaignWorkflows } from '@/features/campaign-builder/lib/campaignWorkflowStorage';
import type { CampaignWorkflow } from '@/features/campaign-builder/types';
import { loadExecutionRuns, saveExecutionRuns } from '@/features/execution-center/lib/executionRunStorage';

export function AIDirectorPage() {
  const { t } = useTranslation();
  const { getPlatformLabel, translateStatus, translateObjective } = useDisplayHelpers();
  const navigate = useNavigate();
  const workspace = useMemo(loadCreativeWorkspaceSnapshot, []);
  const [goal, setGoal] = useState('Quero vender este produto com um vídeo curto de alta conversão.');
  const [targetAudience, setTargetAudience] = useState('Mulheres de 30 a 45 anos');
  const [platform, setPlatform] = useState<CreativePlatform>('tiktok-shop');
  const [objective, setObjective] = useState<CreativeObjective>('sales');
  const [productId, setProductId] = useState(workspace.products[0]?.id ?? '');
  const [digitalHumanId, setDigitalHumanId] = useState(workspace.characters[0]?.id ?? '');
  const [plan, setPlan] = useState<CreativePlan | null>(null);
  const [message, setMessage] = useState('');

  const productOptions = [{ value: '', label: t('pages.aIDirector.autoSelectProduct') }, ...workspace.products.map((item) => ({ value: item.id, label: item.name }))];
  const humanOptions = [{ value: '', label: t('pages.aIDirector.autoSelectDigitalHuman') }, ...workspace.characters.map((item) => ({ value: item.id, label: item.name }))];

  function generatePlan() {
    if (!goal.trim()) {
      setMessage(t('pages.aIDirector.describeGoalRequired'));
      return;
    }
    const intent: CreativeIntent = {
      id: createId('intent'), goal: goal.trim(), targetAudience: targetAudience.trim(), platform, objective,
      productId: productId || undefined, digitalHumanId: digitalHumanId || undefined, createdAt: new Date().toISOString(),
    };
    const nextPlan = createCreativePlan(intent, workspace);
    setPlan(nextPlan);
    setMessage(t('pages.aIDirector.executionPlanGenerated'));
    publishCreativeEvent('intent.created', intent);
    publishCreativeEvent('plan.created', nextPlan);
  }

  function savePlan() {
    if (!plan) return;
    const current = loadCreativePlans();
    const next = [plan, ...current.filter((item) => item.id !== plan.id)];
    setMessage(saveCreativePlans(next) ? t('pages.aIDirector.planSaved') : t('pages.aIDirector.planSaveError'));
  }

  function createCampaign() {
    if (!plan) return;
    const campaigns = loadCampaignsFromStorage();
    const campaignId = createId('campaign');
    const campaign: Campaign = {
      id: campaignId,
      name: plan.campaignName,
      description: plan.strategy,
      status: 'draft',
      createdAt: new Date().toISOString(),
      characterId: plan.selectedCharacterId,
      productId: plan.selectedProductId,
      wardrobeItemId: plan.selectedWardrobeItemId,
      sceneId: plan.selectedSceneId,
      poseId: plan.selectedPoseId,
    };
    if (!saveCampaignsToStorage([campaign, ...campaigns])) {
      setMessage(t('pages.aIDirector.campaignCreateError'));
      return;
    }
    const workflows = loadCampaignWorkflows();
    const workflowId = createId('workflow');
    const run = createExecutionRun(plan, { campaignId, workflowId });
    const workflow: CampaignWorkflow = {
      id: workflowId, campaignId, planId: plan.id, executionRunId: run.id, name: plan.campaignName, objective: plan.intent.goal,
      platform: plan.intent.platform, productId: plan.selectedProductId, digitalHumanId: plan.selectedCharacterId,
      wardrobeItemId: plan.selectedWardrobeItemId, sceneId: plan.selectedSceneId, poseId: plan.selectedPoseId,
      promptStatus: 'pending', imageStatus: 'pending', videoStatus: 'pending', publishingStatus: 'not-scheduled', analyticsStatus: 'waiting',
      viralScore: plan.viralScore, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    if (!saveCampaignWorkflows([workflow, ...workflows])) {
      setMessage(t('pages.aIDirector.workflowSaveError'));
      return;
    }
    const executionRuns = loadExecutionRuns();
    if (!saveExecutionRuns([run, ...executionRuns])) {
      saveCampaignWorkflows(workflows);
      setMessage(t('pages.aIDirector.productionRunSaveError'));
      return;
    }
    savePlan();
    publishCreativeEvent('execution.run.created', run);
    setMessage(t('pages.aIDirector.campaignAndWorkflowSuccess'));
    navigate(`/execution-center?run=${encodeURIComponent(run.id)}`);
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(t('pages.aIDirector.copiedToClipboard'));
    } catch {
      setMessage(t('pages.aIDirector.clipboardError'));
    }
  }

  return (
    <CosModuleShell eyebrow={t('aiDirector.eyebrow')} title={t('aiDirector.title')} description={t('aiDirector.description')}>
      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <AppCard className="space-y-4 p-5">
          <div className="flex items-center gap-2"><WandSparkles className="h-5 w-5 text-primary" /><h2 className="font-semibold">{t('pages.aIDirector.whatDoYouWantToAchieveToday')}</h2></div>
          <AppTextarea label={t('pages.aIDirector.creativeIntent')} rows={5} value={goal} onChange={(event) => setGoal(event.target.value)} />
          <AppInput label={t('pages.aIDirector.targetAudience')} fullWidth value={targetAudience} onChange={(event) => setTargetAudience(event.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <AppSelect label={t('pages.aIDirector.platform')} value={platform} onChange={(event) => setPlatform(event.target.value as CreativePlatform)} options={CREATIVE_PLATFORMS.map((value) => ({ value, label: getPlatformLabel(value) }))} />
            <AppSelect label={t('pages.aIDirector.objective')} value={objective} onChange={(event) => setObjective(event.target.value as CreativeObjective)} options={CREATIVE_OBJECTIVES.map((value) => ({ value, label: translateObjective(value) }))} />
          </div>
          <AppSelect label={t('pages.aIDirector.product')} value={productId} onChange={(event) => setProductId(event.target.value)} options={productOptions} />
          <AppSelect label={t('pages.aIDirector.digitalHuman')} value={digitalHumanId} onChange={(event) => setDigitalHumanId(event.target.value)} options={humanOptions} />
          <AppButton fullWidth leftIcon={<Sparkles className="h-4 w-4" />} onClick={generatePlan}>{t('pages.aIDirector.generateCompletePlan')}</AppButton>
          <p aria-live="polite" className="text-xs text-muted-foreground">{message}</p>
        </AppCard>

        {!plan ? (
          <AppCard className="flex min-h-[520px] items-center justify-center p-8 text-center">
            <div><PlayCircle className="mx-auto h-12 w-12 text-primary" /><h2 className="mt-4 text-xl font-semibold">{t('pages.aIDirector.creativePlannerReady')}</h2><p className="mt-2 max-w-lg text-sm text-muted-foreground">{t('pages.aIDirector.thePlanWillConnectStrategyDigitalHumanPr')}</p></div>
          </AppCard>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard label={t('pages.aIDirector.viralScore')} value={`${plan.viralScore.overall}/100`} detail={t('pages.aIDirector.preproductionEstimate')} />
              <MetricCard label={t('pages.aIDirector.executionSteps')} value={plan.executionPlan.length} detail={t('pages.aIDirector.blockedCount', { count: plan.executionPlan.filter((step) => step.status === 'blocked').length })} />
              <MetricCard label={t('pages.aIDirector.deliverables')} value="10" detail={t('pages.aIDirector.promptsScriptAndPublishing')} />
            </div>
            <AppCard className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div><p className="text-xs font-semibold uppercase text-primary">{t('pages.aIDirector.campaignStrategy')}</p><h2 className="mt-1 text-xl font-bold">{plan.campaignName}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{plan.strategy}</p></div>
                <div className="flex gap-2"><AppButton variant="outline" size="sm" leftIcon={<Save className="h-4 w-4" />} onClick={savePlan}>{t('pages.aIDirector.savePlan')}</AppButton><AppButton size="sm" onClick={createCampaign}>{t('pages.aIDirector.createCampaignAndStartProduction')}</AppButton></div>
              </div>
            </AppCard>
            <div className="grid gap-6 lg:grid-cols-2">
              <AppCard className="p-5"><h3 className="font-semibold">{t('pages.aIDirector.executionPlan')}</h3><ol className="mt-4 space-y-3">{plan.executionPlan.map((step) => <li key={step.id} className="flex gap-3 rounded-md border p-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{step.order}</span><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{step.label}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${step.status === 'blocked' ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>{translateStatus(step.status)}</span></div><p className="mt-1 text-xs text-muted-foreground">{step.description}</p></div></li>)}</ol></AppCard>
              <AppCard className="p-5"><div className="flex items-center justify-between"><h3 className="font-semibold">{t('pages.aIDirector.viralScore')}</h3><span className="text-2xl font-bold text-primary">{plan.viralScore.overall}</span></div><div className="mt-5 space-y-3">{Object.entries(plan.viralScore.breakdown).map(([key, value]) => <ScoreBar key={key} label={key} value={value} />)}</div></AppCard>
            </div>
            <AppCard className="p-5"><h3 className="font-semibold">{t('pages.aIDirector.connectedDeliverables')}</h3><div className="mt-4 grid gap-4 lg:grid-cols-2">{[
              [t('pages.aIDirector.deliverableHook'), plan.deliverables.hook],
              [t('pages.aIDirector.deliverableScript'), plan.deliverables.script.join('\n')],
              [t('pages.aIDirector.deliverableImagePrompt'), plan.deliverables.imagePrompt],
              [t('pages.aIDirector.deliverableFlowPrompt'), plan.deliverables.flowPrompt],
              [t('pages.aIDirector.deliverableVeoPrompt'), plan.deliverables.veoPrompt],
              [t('pages.aIDirector.deliverablePublishingPackage'), `${plan.deliverables.title}\n\n${plan.deliverables.caption}\n${plan.deliverables.hashtags.join(' ')}`],
            ].map(([label, value]) => <div key={label} className="rounded-md border bg-muted/20 p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">{label}</p><button type="button" aria-label={`${t('common.copy')} ${label}`} onClick={() => copyText(value)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><Copy className="h-4 w-4" /></button></div><pre className="mt-3 whitespace-pre-wrap font-sans text-xs leading-5 text-muted-foreground">{value}</pre></div>)}</div></AppCard>
          </div>
        )}
      </div>
    </CosModuleShell>
  );
}

export default AIDirectorPage;
