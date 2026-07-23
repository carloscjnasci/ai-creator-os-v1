import { useTranslation } from '@/features/i18n/useTranslation';
import { useDisplayHelpers } from '@/features/i18n';
import { useMemo, useState } from 'react';
import { Copy, ScanSearch } from 'lucide-react';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import AppInput from '@/components/ui/AppInput';
import AppSelect from '@/components/ui/AppSelect';
import AppTextarea from '@/components/ui/AppTextarea';
import { CosModuleShell, MetricCard, ScoreBar } from '@/components/common';
import { analyzeViralContent, createId, loadCreativeWorkspaceSnapshot, publishCreativeEvent } from '@/core';
import { loadViralAnalyses, saveViralAnalyses } from '../lib/viralAnalysisStorage';
import type { SavedViralAnalysis } from '../types';

export function ViralAnalyzerPage() {
  const { t } = useTranslation();
  const { translatePlatform } = useDisplayHelpers();
  const workspace = useMemo(loadCreativeWorkspaceSnapshot, []);
  const [sourceUrl, setSourceUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [digitalHumanId, setDigitalHumanId] = useState(workspace.characters[0]?.id ?? '');
  const [productId, setProductId] = useState(workspace.products[0]?.id ?? '');
  const [result, setResult] = useState<SavedViralAnalysis | null>(null);
  const [message, setMessage] = useState('');

  function runAnalysis() {
    if (!sourceUrl.trim() || !notes.trim()) { setMessage(t('pages.viralAnalyzer.addContentUrlError')); return; }
    const human = workspace.characters.find((item) => item.id === digitalHumanId);
    const product = workspace.products.find((item) => item.id === productId);
    const analysis = analyzeViralContent({ sourceUrl: sourceUrl.trim(), notes: notes.trim(), digitalHumanName: human?.name, productName: product?.name });
    const saved: SavedViralAnalysis = { ...analysis, id: createId('analysis'), notes: notes.trim(), digitalHumanId: digitalHumanId || undefined, productId: productId || undefined, createdAt: new Date().toISOString() };
    const next = [saved, ...loadViralAnalyses()];
    saveViralAnalyses(next); setResult(saved); setMessage(t('pages.viralAnalyzer.analysisSavedSuccess')); publishCreativeEvent('viral.analysis.completed', saved);
  }

  async function copyPrompt() { if (!result) return; try { await navigator.clipboard.writeText(result.adaptedPrompt); setMessage(t('pages.viralAnalyzer.adaptedPromptCopiedSuccess')); } catch { setMessage(t('pages.viralAnalyzer.clipboardPermissionError')); } }

  return <CosModuleShell eyebrow={t('viralAnalyzer.eyebrow')} title={t('viralAnalyzer.title')} description={t('viralAnalyzer.description')}>
    <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <AppCard className="space-y-4 p-5"><AppInput label={t('pages.viralAnalyzer.contentUrl')} fullWidth value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder={t('pages.viralAnalyzer.tiktokInstagramOrYoutubeUrl')} /><AppTextarea label={t('pages.viralAnalyzer.transcriptCaptionOrObservations')} rows={10} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('pages.viralAnalyzer.pasteTheHookStoryCtaCameraNotesCaptionAn')} /><AppSelect label={t('pages.viralAnalyzer.adaptForDigitalHuman')} value={digitalHumanId} onChange={(e) => setDigitalHumanId(e.target.value)} options={[{ value: '', label: t('pages.viralAnalyzer.noDigitalHumanSelected') }, ...workspace.characters.map((item) => ({ value: item.id, label: item.name }))]} /><AppSelect label={t('pages.viralAnalyzer.adaptForProduct')} value={productId} onChange={(e) => setProductId(e.target.value)} options={[{ value: '', label: t('pages.viralAnalyzer.noProductSelected') }, ...workspace.products.map((item) => ({ value: item.id, label: item.name }))]} /><AppButton fullWidth leftIcon={<ScanSearch className="h-4 w-4" />} onClick={runAnalysis}>{t('pages.viralAnalyzer.analyzeAndAdapt')}</AppButton><p aria-live="polite" className="text-xs text-muted-foreground">{message}</p></AppCard>
      {!result ? <AppCard className="flex min-h-[560px] items-center justify-center p-8 text-center"><div><ScanSearch className="mx-auto h-12 w-12 text-primary" /><h2 className="mt-4 text-xl font-semibold">{t('pages.viralAnalyzer.readyToReverseengineer')}</h2><p className="mt-2 max-w-lg text-sm text-muted-foreground">{t('pages.viralAnalyzer.theAnalyzerEvaluatesHookStorytellingCtaC')}</p></div></AppCard> : <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-3"><MetricCard label={t('pages.viralAnalyzer.viralScore')} value={`${result.viralScore.overall}/100`} /><MetricCard label={t('pages.viralAnalyzer.platform')} value={translatePlatform(result.platform)} /><MetricCard label={t('pages.viralAnalyzer.hashtags')} value={result.hashtags.length} /></div><div className="grid gap-5 lg:grid-cols-2"><AppCard className="p-5"><h2 className="font-semibold">{t('pages.viralAnalyzer.creativeBreakdown')}</h2><dl className="mt-4 space-y-3">{([[t('pages.viralAnalyzer.breakdownHook'), result.hook], [t('pages.viralAnalyzer.breakdownStorytelling'), result.storytelling], [t('pages.viralAnalyzer.breakdownCta'), result.cta], [t('pages.viralAnalyzer.breakdownCamera'), result.camera], [t('pages.viralAnalyzer.breakdownLighting'), result.lighting], [t('pages.viralAnalyzer.breakdownEmotion'), result.emotion], [t('pages.viralAnalyzer.breakdownScene'), result.scene], [t('pages.viralAnalyzer.breakdownClothing'), result.clothing], [t('pages.viralAnalyzer.breakdownExpression'), result.expression], [t('pages.viralAnalyzer.breakdownPose'), result.pose], [t('pages.viralAnalyzer.breakdownRhythm'), result.rhythm]] as const).map(([label, value]) => <div key={label} className="rounded-md border p-3"><dt className="text-xs font-semibold uppercase text-primary">{label}</dt><dd className="mt-1 text-sm text-muted-foreground">{value}</dd></div>)}</dl></AppCard><AppCard className="p-5"><h2 className="font-semibold">{t('pages.viralAnalyzer.scoreDetail')}</h2><div className="mt-4 space-y-3">{Object.entries(result.viralScore.breakdown).map(([key, value]) => <ScoreBar key={key} label={key} value={value} />)}</div></AppCard></div><AppCard className="p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">{t('pages.viralAnalyzer.adaptedPrompt')}</h2><AppButton variant="outline" size="sm" leftIcon={<Copy className="h-4 w-4" />} onClick={copyPrompt}>{t('pages.viralAnalyzer.copy')}</AppButton></div><p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{result.adaptedPrompt}</p></AppCard></div>}
    </div>
  </CosModuleShell>;
}

export default ViralAnalyzerPage;
