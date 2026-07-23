import { useTranslation } from '@/features/i18n/useTranslation';
import { useDisplayHelpers } from '@/features/i18n';
import { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Plus, Workflow } from 'lucide-react';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import AppInput from '@/components/ui/AppInput';
import AppSelect from '@/components/ui/AppSelect';
import AppTextarea from '@/components/ui/AppTextarea';
import { CosModuleShell, MetricCard } from '@/components/common';
import { CREATIVE_PLATFORMS, calculateViralScore, createId, loadCreativeWorkspaceSnapshot, publishCreativeEvent, type CreativePlatform } from '@/core';
import { loadCampaignsFromStorage } from '@/features/campaigns/lib/campaignStorage';
import { loadCampaignWorkflows, saveCampaignWorkflows } from '../lib/campaignWorkflowStorage';
import type { CampaignWorkflow } from '../types';

export function CampaignBuilderPage() {
  const { t } = useTranslation();
  const { translatePlatform } = useDisplayHelpers();
  const workspace = useMemo(loadCreativeWorkspaceSnapshot, []);
  const campaigns = useMemo(loadCampaignsFromStorage, []);
  const [workflows, setWorkflows] = useState<CampaignWorkflow[]>(loadCampaignWorkflows);
  const [selectedId, setSelectedId] = useState(workflows[0]?.id ?? '');
  const current = workflows.find((item) => item.id === selectedId);
  const [name, setName] = useState(current?.name ?? '');
  const [objective, setObjective] = useState(current?.objective ?? '');
  const [platform, setPlatform] = useState<CreativePlatform>(current?.platform ?? 'tiktok-shop');
  const [campaignId, setCampaignId] = useState(current?.campaignId ?? '');
  const [productId, setProductId] = useState(current?.productId ?? workspace.products[0]?.id ?? '');
  const [digitalHumanId, setDigitalHumanId] = useState(current?.digitalHumanId ?? workspace.characters[0]?.id ?? '');
  const [wardrobeItemId, setWardrobeItemId] = useState(current?.wardrobeItemId ?? workspace.wardrobe[0]?.id ?? '');
  const [sceneId, setSceneId] = useState(current?.sceneId ?? workspace.scenes[0]?.id ?? '');
  const [poseId, setPoseId] = useState(current?.poseId ?? workspace.poses[0]?.id ?? '');
  const [promptStatus, setPromptStatus] = useState<CampaignWorkflow['promptStatus']>(current?.promptStatus ?? 'pending');
  const [imageStatus, setImageStatus] = useState<CampaignWorkflow['imageStatus']>(current?.imageStatus ?? 'pending');
  const [videoStatus, setVideoStatus] = useState<CampaignWorkflow['videoStatus']>(current?.videoStatus ?? 'pending');
  const [publishingStatus, setPublishingStatus] = useState<CampaignWorkflow['publishingStatus']>(current?.publishingStatus ?? 'not-scheduled');
  const [analyticsStatus, setAnalyticsStatus] = useState<CampaignWorkflow['analyticsStatus']>(current?.analyticsStatus ?? 'waiting');
  const [message, setMessage] = useState('');

  const statusOptions = (values: string[]) => values.map((value) => ({
    value,
    label: t(`pages.campaignBuilder.statusOption_${value}`)
  }));

  function loadWorkflow(workflow: CampaignWorkflow) {
    setSelectedId(workflow.id); setName(workflow.name); setObjective(workflow.objective); setPlatform(workflow.platform); setCampaignId(workflow.campaignId ?? ''); setProductId(workflow.productId ?? ''); setDigitalHumanId(workflow.digitalHumanId ?? ''); setWardrobeItemId(workflow.wardrobeItemId ?? ''); setSceneId(workflow.sceneId ?? ''); setPoseId(workflow.poseId ?? ''); setPromptStatus(workflow.promptStatus); setImageStatus(workflow.imageStatus); setVideoStatus(workflow.videoStatus); setPublishingStatus(workflow.publishingStatus); setAnalyticsStatus(workflow.analyticsStatus); setMessage('');
  }
  function reset() { setSelectedId(''); setName(''); setObjective(''); setCampaignId(''); setProductId(workspace.products[0]?.id ?? ''); setDigitalHumanId(workspace.characters[0]?.id ?? ''); setWardrobeItemId(workspace.wardrobe[0]?.id ?? ''); setSceneId(workspace.scenes[0]?.id ?? ''); setPoseId(workspace.poses[0]?.id ?? ''); setPromptStatus('pending'); setImageStatus('pending'); setVideoStatus('pending'); setPublishingStatus('not-scheduled'); setAnalyticsStatus('waiting'); }
  function saveWorkflow() {
    if (!name.trim() || !objective.trim()) { setMessage(t('pages.campaignBuilder.nameAndObjectiveRequired')); return; }
    const productName = workspace.products.find((item) => item.id === productId)?.name;
    const score = calculateViralScore({ goal: objective, targetAudience: 'Campaign audience', platform, objective: 'sales', productName, clothing: workspace.wardrobe.find((item) => item.id === wardrobeItemId)?.name, trendSignals: [platform] });
    const now = new Date().toISOString();
    const existing = workflows.find((item) => item.id === selectedId);
    const workflow: CampaignWorkflow = { id: existing?.id ?? createId('workflow'), campaignId: campaignId || undefined, name: name.trim(), objective: objective.trim(), platform, productId: productId || undefined, digitalHumanId: digitalHumanId || undefined, wardrobeItemId: wardrobeItemId || undefined, sceneId: sceneId || undefined, poseId: poseId || undefined, promptStatus, imageStatus, videoStatus, publishingStatus, analyticsStatus, viralScore: score, createdAt: existing?.createdAt ?? now, updatedAt: now };
    const next = [workflow, ...workflows.filter((item) => item.id !== workflow.id)];
    if (saveCampaignWorkflows(next)) { setWorkflows(next); setSelectedId(workflow.id); setMessage(t('pages.campaignBuilder.campaignWorkflowSaved')); publishCreativeEvent('campaign.workflow.updated', workflow); } else setMessage(t('pages.campaignBuilder.unableToSaveWorkflow'));
  }

  const completedStages = [promptStatus === 'approved', imageStatus === 'approved', videoStatus === 'approved', publishingStatus === 'published', analyticsStatus === 'complete'].filter(Boolean).length;
  const flow = [
    [t('pages.campaignBuilder.objectiveLabel'), objective || t('pages.campaignBuilder.defineGoal'), Boolean(objective)],
    [t('pages.campaignBuilder.productLabel'), workspace.products.find((i) => i.id === productId)?.name || t('pages.campaignBuilder.selectProduct'), Boolean(productId)],
    [t('pages.campaignBuilder.digitalHumanLabel'), workspace.characters.find((i) => i.id === digitalHumanId)?.name || t('pages.campaignBuilder.selectIdentity'), Boolean(digitalHumanId)],
    [t('pages.campaignBuilder.wardrobeLabel'), workspace.wardrobe.find((i) => i.id === wardrobeItemId)?.name || t('pages.campaignBuilder.selectWardrobe'), Boolean(wardrobeItemId)],
    [t('pages.campaignBuilder.sceneLabel'), workspace.scenes.find((i) => i.id === sceneId)?.name || t('pages.campaignBuilder.selectScene'), Boolean(sceneId)],
    [t('pages.campaignBuilder.promptLabel'), t(`pages.campaignBuilder.statusOption_${promptStatus}`), promptStatus !== 'pending'],
    [t('pages.campaignBuilder.imageLabel'), t(`pages.campaignBuilder.statusOption_${imageStatus}`), imageStatus !== 'pending'],
    [t('pages.campaignBuilder.videoLabel'), t(`pages.campaignBuilder.statusOption_${videoStatus}`), videoStatus !== 'pending'],
    [t('pages.campaignBuilder.publishingLabel'), t(`pages.campaignBuilder.statusOption_${publishingStatus}`), publishingStatus !== 'not-scheduled'],
    [t('pages.campaignBuilder.analyticsLabel'), t(`pages.campaignBuilder.statusOption_${analyticsStatus}`), analyticsStatus !== 'waiting'],
  ] as const;

  return <CosModuleShell eyebrow={t('campaignBuilder.eyebrow')} title={t('campaignBuilder.title')} description={t('campaignBuilder.description')}>
    <div className="grid gap-3 sm:grid-cols-3"><MetricCard label={t('pages.campaignBuilder.workflows')} value={workflows.length} /><MetricCard label={t('pages.campaignBuilder.approvedStages')} value={`${completedStages}/5`} /><MetricCard label={t('pages.campaignBuilder.currentViralScore')} value={current?.viralScore ? `${current.viralScore.overall}/100` : '—'} /></div>
    <AppCard className="overflow-x-auto p-5"><div className="flex min-w-max items-center gap-2">{flow.map(([label, value, ready], index) => <div key={label} className="flex items-center gap-2"><div className={`w-36 rounded-lg border p-3 ${ready ? 'border-primary/40 bg-primary/5' : 'bg-muted/20'}`}><div className="flex items-center gap-2">{ready ? <CheckCircle2 className="h-4 w-4 text-success" /> : <span className="h-4 w-4 rounded-full border" />}<p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p></div><p className="mt-2 truncate text-sm font-medium">{value}</p></div>{index < flow.length - 1 ? <ArrowRight className="h-4 w-4 text-muted-foreground" /> : null}</div>)}</div></AppCard>
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]"><AppCard className="p-3"><div className="flex items-center justify-between px-2 pb-2"><p className="text-xs font-semibold uppercase text-muted-foreground">{t('pages.campaignBuilder.savedWorkflows')}</p><button type="button" onClick={reset} className="rounded p-1 text-primary hover:bg-muted" aria-label={t('pages.campaignBuilder.newWorkflow')}><Plus className="h-4 w-4" /></button></div><div className="space-y-1">{workflows.length === 0 ? <p className="p-3 text-sm text-muted-foreground">{t('pages.campaignBuilder.noWorkflowsYet')}</p> : workflows.map((item) => <button key={item.id} type="button" onClick={() => loadWorkflow(item)} className={`w-full rounded-md p-3 text-left ${selectedId === item.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}><p className="text-sm font-semibold">{item.name}</p><p className={`mt-1 text-xs ${selectedId === item.id ? 'text-primary-foreground/75' : 'text-muted-foreground'}`}>{translatePlatform(item.platform)} · {item.viralScore?.overall ?? '—'}/100</p></button>)}</div></AppCard><AppCard className="space-y-4 p-5"><div className="flex items-center gap-2"><Workflow className="h-5 w-5 text-primary" /><h2 className="font-semibold">{t('pages.campaignBuilder.workflowConfiguration')}</h2></div><div className="grid gap-4 md:grid-cols-2"><AppInput label={t('pages.campaignBuilder.workflowName')} fullWidth value={name} onChange={(e) => setName(e.target.value)} /><AppSelect label={t('pages.campaignBuilder.platform')} value={platform} onChange={(e) => setPlatform(e.target.value as CreativePlatform)} options={CREATIVE_PLATFORMS.map((value) => ({ value, label: translatePlatform(value) }))} /></div><AppTextarea label={t('pages.campaignBuilder.businessObjective')} rows={4} value={objective} onChange={(e) => setObjective(e.target.value)} /><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"><AppSelect label={t('pages.campaignBuilder.existingCampaign')} value={campaignId} onChange={(e) => setCampaignId(e.target.value)} options={[{ value: '', label: t('pages.campaignBuilder.notLinked') }, ...campaigns.map((item) => ({ value: item.id, label: item.name }))]} /><AppSelect label={t('pages.campaignBuilder.product')} value={productId} onChange={(e) => setProductId(e.target.value)} options={[{ value: '', label: t('pages.campaignBuilder.notSelected') }, ...workspace.products.map((item) => ({ value: item.id, label: item.name }))]} /><AppSelect label={t('pages.campaignBuilder.digitalHuman')} value={digitalHumanId} onChange={(e) => setDigitalHumanId(e.target.value)} options={[{ value: '', label: t('pages.campaignBuilder.notSelected') }, ...workspace.characters.map((item) => ({ value: item.id, label: item.name }))]} /><AppSelect label={t('pages.campaignBuilder.wardrobe')} value={wardrobeItemId} onChange={(e) => setWardrobeItemId(e.target.value)} options={[{ value: '', label: t('pages.campaignBuilder.notSelected') }, ...workspace.wardrobe.map((item) => ({ value: item.id, label: item.name }))]} /><AppSelect label={t('pages.campaignBuilder.scene')} value={sceneId} onChange={(e) => setSceneId(e.target.value)} options={[{ value: '', label: t('pages.campaignBuilder.notSelected') }, ...workspace.scenes.map((item) => ({ value: item.id, label: item.name }))]} /><AppSelect label={t('pages.campaignBuilder.pose')} value={poseId} onChange={(e) => setPoseId(e.target.value)} options={[{ value: '', label: t('pages.campaignBuilder.notSelected') }, ...workspace.poses.map((item) => ({ value: item.id, label: item.name }))]} /></div><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5"><AppSelect label={t('pages.campaignBuilder.prompt')} value={promptStatus} onChange={(e) => setPromptStatus(e.target.value as CampaignWorkflow['promptStatus'])} options={statusOptions(['pending','ready','approved'])} /><AppSelect label={t('pages.campaignBuilder.image')} value={imageStatus} onChange={(e) => setImageStatus(e.target.value as CampaignWorkflow['imageStatus'])} options={statusOptions(['pending','ready','approved'])} /><AppSelect label={t('pages.campaignBuilder.video')} value={videoStatus} onChange={(e) => setVideoStatus(e.target.value as CampaignWorkflow['videoStatus'])} options={statusOptions(['pending','ready','approved'])} /><AppSelect label={t('pages.campaignBuilder.publishing')} value={publishingStatus} onChange={(e) => setPublishingStatus(e.target.value as CampaignWorkflow['publishingStatus'])} options={statusOptions(['not-scheduled','scheduled','published'])} /><AppSelect label={t('pages.campaignBuilder.analytics')} value={analyticsStatus} onChange={(e) => setAnalyticsStatus(e.target.value as CampaignWorkflow['analyticsStatus'])} options={statusOptions(['waiting','collecting','complete'])} /></div><div className="flex items-center justify-between gap-3"><p aria-live="polite" className="text-xs text-muted-foreground">{message}</p><AppButton onClick={saveWorkflow}>{t('pages.campaignBuilder.saveWorkflow')}</AppButton></div></AppCard></div>
  </CosModuleShell>;
}

export default CampaignBuilderPage;
