import { useTranslation } from '@/features/i18n/useTranslation';
import { useMemo, useState } from 'react';
import { Beaker, Copy, GitBranch, Sparkles } from 'lucide-react';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import AppInput from '@/components/ui/AppInput';
import AppSelect from '@/components/ui/AppSelect';
import AppTextarea from '@/components/ui/AppTextarea';
import { CosModuleShell, MetricCard } from '@/components/common';
import { calculateViralScore, createId, optimizePrompt, publishCreativeEvent, type PromptOptimizationResult } from '@/core';
import { loadPromptHistoryFromStorage } from '@/features/prompt-engine/promptHistoryStorage';
import { loadCampaignsFromStorage } from '@/features/campaigns/lib/campaignStorage';
import { loadPromptExperiments, savePromptExperiments } from '../lib/promptExperimentStorage';
import type { PromptExperiment } from '../types';

export function PromptIntelligencePage() {
  const { t } = useTranslation();
  const promptHistory = useMemo(loadPromptHistoryFromStorage, []);
  const campaigns = useMemo(loadCampaignsFromStorage, []);
  const [experiments, setExperiments] = useState<PromptExperiment[]>(loadPromptExperiments);
  const [name, setName] = useState(() => t('pages.promptIntelligence.defaultExperimentName'));
  const [model, setModel] = useState('Flow / Veo');
  const [campaignId, setCampaignId] = useState('');
  const [parentId, setParentId] = useState('');
  const [prompt, setPrompt] = useState(promptHistory[0]?.generatedPrompt ?? '');
  const [optimization, setOptimization] = useState<PromptOptimizationResult | null>(null);
  const [message, setMessage] = useState('');

  const version = parentId ? (experiments.find((item) => item.id === parentId)?.version ?? 0) + 1 : 1;
  const bestExperiment = [...experiments].sort((a, b) => (b.performanceScore ?? b.viralScore.overall) - (a.performanceScore ?? a.viralScore.overall))[0];

  function analyze() {
    if (!prompt.trim()) { setMessage(t('pages.promptIntelligence.enterPromptToAnalyze')); return; }
    const result = optimizePrompt(prompt);
    setOptimization(result); setMessage(t('pages.promptIntelligence.promptReviewed', { count: result.issues.length })); publishCreativeEvent('prompt.optimized', result);
  }

  function saveVersion() {
    const result = optimization ?? optimizePrompt(prompt);
    if (!prompt.trim() || !name.trim()) { setMessage(t('pages.promptIntelligence.nameAndPromptRequired')); return; }
    const viralScore = calculateViralScore({ goal: result.optimizedPrompt, platform: 'generic', objective: 'virality', hook: result.optimizedPrompt, cta: result.optimizedPrompt, story: result.optimizedPrompt, trendSignals: [model] });
    const experiment: PromptExperiment = { id: createId('prompt-exp'), name: name.trim(), prompt: result.optimizedPrompt, version, parentId: parentId || undefined, campaignId: campaignId || undefined, model: model.trim(), optimization: result, viralScore, createdAt: new Date().toISOString() };
    const next = [experiment, ...experiments];
    if (savePromptExperiments(next)) { setExperiments(next); setPrompt(result.optimizedPrompt); setOptimization(result); setParentId(experiment.id); setMessage(t('pages.promptIntelligence.promptVersionSaved', { version })); } else setMessage(t('pages.promptIntelligence.unableToSavePrompt'));
  }

  async function copyOptimized() { if (!optimization) return; try { await navigator.clipboard.writeText(optimization.optimizedPrompt); setMessage(t('pages.promptIntelligence.optimizedPromptCopied')); } catch { setMessage(t('pages.promptIntelligence.clipboardPermissionNotAvailable')); } }

  return <CosModuleShell eyebrow={t('promptIntelligence.eyebrow')} title={t('promptIntelligence.title')} description={t('promptIntelligence.description')}>
    <div className="grid gap-3 sm:grid-cols-4"><MetricCard label={t('pages.promptIntelligence.experiments')} value={experiments.length} /><MetricCard label={t('pages.promptIntelligence.currentVersion')} value={`v${version}`} /><MetricCard label={t('pages.promptIntelligence.currentQuality')} value={optimization ? `${optimization.qualityScore}/100` : '—'} /><MetricCard label={t('pages.promptIntelligence.bestObserved')} value={bestExperiment ? `${bestExperiment.performanceScore ?? bestExperiment.viralScore.overall}/100` : '—'} /></div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]"><div className="space-y-5"><AppCard className="space-y-4 p-5"><div className="grid gap-4 sm:grid-cols-2"><AppInput label={t('pages.promptIntelligence.experimentName')} fullWidth value={name} onChange={(e) => setName(e.target.value)} /><AppInput label={t('pages.promptIntelligence.targetModel')} fullWidth value={model} onChange={(e) => setModel(e.target.value)} /></div><div className="grid gap-4 sm:grid-cols-2"><AppSelect label={t('pages.promptIntelligence.campaign')} value={campaignId} onChange={(e) => setCampaignId(e.target.value)} options={[{ value: '', label: t('pages.promptIntelligence.standalonePrompt') }, ...campaigns.map((item) => ({ value: item.id, label: item.name }))]} /><AppSelect label={t('pages.promptIntelligence.parentVersion')} value={parentId} onChange={(e) => { const id = e.target.value; setParentId(id); const parent = experiments.find((item) => item.id === id); if (parent) { setPrompt(parent.prompt); setOptimization(parent.optimization); } }} options={[{ value: '', label: t('pages.promptIntelligence.startLineage') }, ...experiments.map((item) => ({ value: item.id, label: `${item.name} · ${t('pages.promptIntelligence.versionLabelShort', { version: item.version })}` }))]} /></div><AppTextarea label={t('pages.promptIntelligence.prompt')} rows={16} value={prompt} onChange={(e) => { setPrompt(e.target.value); setOptimization(null); }} /><div className="flex flex-wrap items-center justify-between gap-3"><p aria-live="polite" className="text-xs text-muted-foreground">{message}</p><div className="flex gap-2"><AppButton variant="outline" leftIcon={<Beaker className="h-4 w-4" />} onClick={analyze}>{t('pages.promptIntelligence.analyze')}</AppButton><AppButton leftIcon={<GitBranch className="h-4 w-4" />} onClick={saveVersion}>{t('pages.promptIntelligence.saveVersionBtn', { version })}</AppButton></div></div></AppCard>
      {optimization ? <AppCard className="p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{t('pages.promptIntelligence.optimizedPrompt')}</h2><p className="mt-1 text-xs text-muted-foreground">{optimization.originalLength} → {optimization.optimizedLength} {t('pages.promptIntelligence.charactersLabel')}</p></div><AppButton variant="outline" size="sm" leftIcon={<Copy className="h-4 w-4" />} onClick={copyOptimized}>{t('pages.promptIntelligence.copy')}</AppButton></div><pre className="mt-4 max-h-[480px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/20 p-4 font-sans text-sm leading-6 text-muted-foreground">{optimization.optimizedPrompt}</pre></AppCard> : null}</div>
      <div className="space-y-5">{optimization ? <AppCard className="p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">{t('pages.promptIntelligence.optimizerReview')}</h2><span className="text-2xl font-bold text-primary">{optimization.qualityScore}</span></div><div className="mt-4 space-y-3">{optimization.issues.length === 0 ? <div className="rounded-md bg-success/10 p-3 text-sm text-success">{t('pages.promptIntelligence.noStructuralConflictsDetected')}</div> : optimization.issues.map((issue, index) => <div key={`${issue.type}-${index}`} className={`rounded-md border p-3 ${issue.severity === 'high' ? 'border-destructive/30 bg-destructive/5' : 'bg-muted/20'}`}><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase">{issue.type}</p><span className="text-[10px] uppercase text-muted-foreground">{issue.severity}</span></div><p className="mt-1 text-xs text-muted-foreground">{issue.message}</p></div>)}</div></AppCard> : <AppCard className="p-8 text-center"><Sparkles className="mx-auto h-9 w-9 text-primary" /><p className="mt-3 font-semibold">{t('pages.promptIntelligence.optimizerReady')}</p><p className="mt-1 text-sm text-muted-foreground">{t('pages.promptIntelligence.analyzeThePromptToDetectLengthAmbiguityC')}</p></AppCard>}
      <AppCard className="p-4"><h2 className="font-semibold">{t('pages.promptIntelligence.versionLineage')}</h2><div className="mt-3 space-y-2">{experiments.length === 0 ? <p className="text-sm text-muted-foreground">{t('pages.promptIntelligence.noVersionsSaved')}</p> : experiments.slice(0, 12).map((item) => <button type="button" key={item.id} onClick={() => { setParentId(item.id); setPrompt(item.prompt); setOptimization(item.optimization); }} className="w-full rounded-md border p-3 text-left hover:bg-muted"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold">{item.name}</p><span className="text-xs text-primary">v{item.version}</span></div><p className="mt-1 text-xs text-muted-foreground">{t('pages.promptIntelligence.qualityLabel')} {item.optimization.qualityScore} · {t('pages.promptIntelligence.viralLabel', { score: item.viralScore.overall })}</p></button>)}</div></AppCard></div></div>
  </CosModuleShell>;
}

export default PromptIntelligencePage;
