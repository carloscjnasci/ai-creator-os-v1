import { useTranslation } from '@/features/i18n/useTranslation';
import { useDisplayHelpers } from '@/features/i18n';
import { useMemo, useState } from 'react';
import { Plus, Radar, TrendingUp } from 'lucide-react';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import AppInput from '@/components/ui/AppInput';
import AppSelect from '@/components/ui/AppSelect';
import AppTextarea from '@/components/ui/AppTextarea';
import { CosModuleShell, MetricCard } from '@/components/common';
import { CREATIVE_PLATFORMS, createId, type CreativePlatform } from '@/core';
import { loadResearchSignals, saveResearchSignals } from '../lib/researchStorage';
import type { TrendSignal } from '../types';

export function ResearchHubPage() {
  const { t, formatNumber } = useTranslation();
  const { translatePlatform } = useDisplayHelpers();
  const [signals, setSignals] = useState<TrendSignal[]>(loadResearchSignals);
  const [platform, setPlatform] = useState<CreativePlatform>('tiktok');
  const [topic, setTopic] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [summary, setSummary] = useState('');
  const [views, setViews] = useState('');
  const [baselineViews, setBaselineViews] = useState('');
  const [tags, setTags] = useState('');
  const [message, setMessage] = useState('');

  const sortedSignals = useMemo(() => [...signals].sort((a, b) => b.outlierMultiplier - a.outlierMultiplier), [signals]);
  const topSignal = sortedSignals[0];
  const averageOutlier = signals.length ? signals.reduce((sum, item) => sum + item.outlierMultiplier, 0) / signals.length : 0;

  function addSignal() {
    if (!topic.trim()) { setMessage(t('pages.researchHub.topicRequired')); return; }
    const parsedViews = Math.max(0, Number(views) || 0);
    const parsedBaseline = Math.max(0, Number(baselineViews) || 0);
    const multiplier = parsedBaseline > 0 ? Number((parsedViews / parsedBaseline).toFixed(2)) : 0;
    const signal: TrendSignal = {
      id: createId('trend'), platform, topic: topic.trim(), sourceUrl: sourceUrl.trim(), summary: summary.trim(), views: parsedViews,
      baselineViews: parsedBaseline, outlierMultiplier: multiplier, tags: tags.split(',').map((item) => item.trim()).filter(Boolean), capturedAt: new Date().toISOString(),
    };
    const next = [signal, ...signals];
    if (saveResearchSignals(next)) {
      setSignals(next); setTopic(''); setSourceUrl(''); setSummary(''); setViews(''); setBaselineViews(''); setTags(''); setMessage(t('pages.researchHub.signalSaved'));
    } else setMessage(t('pages.researchHub.unableToSaveSignal'));
  }

  return (
    <CosModuleShell eyebrow={t('researchHub.eyebrow')} title={t('researchHub.title')} description={t('researchHub.description')}>
      <div className="grid gap-3 sm:grid-cols-3"><MetricCard label={t('pages.researchHub.signals')} value={signals.length} detail={t('pages.researchHub.storedInThisWorkspace')} /><MetricCard label={t('pages.researchHub.averageOutlier')} value={`${averageOutlier.toFixed(1)}×`} detail={t('pages.researchHub.viewsVersusBaseline')} /><MetricCard label={t('pages.researchHub.strongestSignal')} value={topSignal ? `${topSignal.outlierMultiplier.toFixed(1)}×` : '—'} detail={topSignal?.topic ?? t('pages.researchHub.addResearchData')} /></div>
      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <AppCard className="space-y-4 p-5"><div className="flex items-center gap-2"><Radar className="h-5 w-5 text-primary" /><h2 className="font-semibold">{t('pages.researchHub.addResearchSignal')}</h2></div>
          <AppSelect label={t('pages.researchHub.platform')} value={platform} onChange={(e) => setPlatform(e.target.value as CreativePlatform)} options={CREATIVE_PLATFORMS.map((value) => ({ value, label: translatePlatform(value) }))} />
          <AppInput label={t('pages.researchHub.topicOrPattern')} fullWidth value={topic} onChange={(e) => setTopic(e.target.value)} />
          <AppInput label={t('pages.researchHub.sourceUrl')} fullWidth value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
          <AppTextarea label={t('pages.researchHub.whatIsWorking')} rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} />
          <div className="grid grid-cols-2 gap-3"><AppInput label={t('pages.researchHub.contentViews')} type="number" fullWidth value={views} onChange={(e) => setViews(e.target.value)} /><AppInput label={t('pages.researchHub.channelBaseline')} type="number" fullWidth value={baselineViews} onChange={(e) => setBaselineViews(e.target.value)} /></div>
          <AppInput label={t('pages.researchHub.tags')} helperText={t('pages.researchHub.commaSeparated')} fullWidth value={tags} onChange={(e) => setTags(e.target.value)} />
          <AppButton fullWidth leftIcon={<Plus className="h-4 w-4" />} onClick={addSignal}>{t('pages.researchHub.saveSignal')}</AppButton><p aria-live="polite" className="text-xs text-muted-foreground">{message}</p>
        </AppCard>
        <div className="space-y-4">
          <AppCard className="p-5"><div className="flex items-start gap-3"><TrendingUp className="mt-0.5 h-5 w-5 text-primary" /><div><h2 className="font-semibold">{t('pages.researchHub.workspaceResearchBrief')}</h2><p className="mt-1 text-sm text-muted-foreground">{topSignal ? t('pages.researchHub.strongestSignalBrief').replace('{topic}', topSignal.topic).replace('{multiplier}', topSignal.outlierMultiplier.toFixed(1)) : t('pages.researchHub.noTrendDataBrief')}</p></div></div></AppCard>
          {sortedSignals.length === 0 ? (
            <AppCard className="p-10 text-center">
              <Radar className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-semibold">{t('pages.researchHub.noResearchSignalsYet')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('pages.researchHub.hubIntentionallyNoInvent')}</p>
            </AppCard>
          ) : (
            sortedSignals.map((signal) => (
              <AppCard key={signal.id} className="p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{translatePlatform(signal.platform)}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {t('pages.researchHub.outlierLabel').replace('{multiplier}', signal.outlierMultiplier.toFixed(1))}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold">{signal.topic}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{signal.summary || t('pages.researchHub.noSummaryProvided')}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {signal.tags.map((tag) => (
                        <span key={tag} className="text-xs text-muted-foreground">#{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{t('pages.researchHub.viewsLabel').replace('{count}', formatNumber(signal.views))}</p>
                    <p>{t('pages.researchHub.baselineLabel').replace('{count}', formatNumber(signal.baselineViews))}</p>
                  </div>
                </div>
              </AppCard>
            ))
          )}
        </div>
      </div>
    </CosModuleShell>
  );
}

export default ResearchHubPage;
