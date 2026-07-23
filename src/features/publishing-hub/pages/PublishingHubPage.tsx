import { useTranslation, useDisplayHelpers } from '@/features/i18n';
import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  FileOutput,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { CosModuleShell, MetricCard } from '@/components/common';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppSelect } from '@/components/ui/AppSelect';
import { AppTextarea } from '@/components/ui/AppTextarea';
import { loadCampaignWorkflows } from '@/features/campaign-builder/lib/campaignWorkflowStorage';
import { loadCreativeAssets } from '@/features/creative-library/lib/creativeAssetStorage';
import type { PublicationDraft, PublicationStatus, PublishingConnectionPreference } from '../types';
import {
  approvePublication,
  archivePublication,
  cancelPublication,
  createDraftFromWorkflow,
  ensurePublishingConnections,
  publishPublication,
  rejectPublication,
  requestPublicationReview,
  restorePublication,
  retryPublication,
  runDueScheduledPublications,
  schedulePublication,
  updatePublicationDraft,
} from '../lib/publishingService';
import {
  loadPublicationDrafts,
  loadPublishingConnections,
  loadPublishingJobs,
  savePublishingConnections,
  subscribeToPublicationDrafts,
} from '../lib/publishingStorage';

function statusVariant(status: PublicationStatus) {
  if (status === 'published' || status === 'approved') return 'success' as const;
  if (status === 'failed') return 'danger' as const;
  if (status === 'scheduled' || status === 'in-review') return 'warning' as const;
  if (status === 'publishing') return 'primary' as const;
  return 'outline' as const;
}

function toLocalInput(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

export function PublishingHubPage() {
  const { t, locale, formatDate, formatDateTime } = useTranslation();
  const { translateStatus, translatePlatform, translatePublicationMode } = useDisplayHelpers();
  const workflows = useMemo(loadCampaignWorkflows, []);
  const assets = useMemo(loadCreativeAssets, []);
  const [drafts, setDrafts] = useState<PublicationDraft[]>(loadPublicationDrafts);
  const [connections, setConnections] = useState<PublishingConnectionPreference[]>(() => ensurePublishingConnections());
  const [selectedId, setSelectedId] = useState('');
  const [workflowId, setWorkflowId] = useState(workflows[0]?.id ?? '');
  const [assetId, setAssetId] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PublicationStatus>('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [scheduleValue, setScheduleValue] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeToPublicationDrafts(setDrafts), []);

  const selected = drafts.find((item) => item.id === selectedId) ?? drafts[0];
  useEffect(() => {
    if (!selectedId && drafts[0]) setSelectedId(drafts[0].id);
  }, [drafts, selectedId]);
  useEffect(() => setScheduleValue(toLocalInput(selected?.scheduledAt)), [selected?.id, selected?.scheduledAt]);

  const filteredDrafts = drafts.filter((draft) => {
    if (statusFilter !== 'all' && draft.status !== statusFilter) return false;
    if (platformFilter !== 'all' && draft.platform !== platformFilter) return false;
    const haystack = `${draft.title} ${draft.caption} ${draft.platform}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });
  const scheduled = drafts.filter((item) => item.status === 'scheduled').sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''));
  const jobs = loadPublishingJobs();

  function refreshConnections() {
    setConnections(loadPublishingConnections());
  }

  function createDraft() {
    try {
      const draft = createDraftFromWorkflow({ workflowId, creativeAssetId: assetId || undefined });
      setSelectedId(draft.id);
      setMessage(t('publishingHub.draftCreated'));
    } catch {
      setMessage(t('publishingHub.draftCreateError'));
    }
  }

  function updateSelected(patch: Parameters<typeof updatePublicationDraft>[1]) {
    if (!selected) return;
    try {
      const draft = updatePublicationDraft(selected.id, patch);
      setDrafts(loadPublicationDrafts());
      setSelectedId(draft.id);
      setMessage(t('publishingHub.draftUpdated'));
    } catch {
      setMessage(t('publishingHub.draftUpdateError'));
    }
  }

  async function runAction(action: string) {
    if (!selected) return;
    const actionLabels: Record<string, string> = {
      review: t('pages.publishingHub.requestReview'),
      approve: t('pages.publishingHub.approve'),
      reject: t('pages.publishingHub.requestChanges'),
      schedule: t('pages.publishingHub.schedule'),
      publish: t('pages.publishingHub.publish'),
      cancel: t('pages.publishingHub.cancel'),
      retry: t('pages.publishingHub.prepareRetry'),
      archive: t('pages.publishingHub.archive'),
      restore: t('pages.publishingHub.restore'),
      due: t('pages.publishingHub.runDueSchedule'),
    };
    setBusy(true);
    try {
      let result: PublicationDraft | PublicationDraft[];
      if (action === 'review') result = requestPublicationReview(selected.id);
      else if (action === 'approve') result = approvePublication(selected.id);
      else if (action === 'reject') result = rejectPublication(selected.id, t('publishingHub.requestChanges'));
      else if (action === 'schedule') {
        if (!scheduleValue) throw new Error(t('publishingHub.chooseFutureSchedule'));
        result = schedulePublication(selected.id, fromLocalInput(scheduleValue), selected.timezone);
      } else if (action === 'publish') result = await publishPublication(selected.id);
      else if (action === 'cancel') result = cancelPublication(selected.id);
      else if (action === 'retry') result = retryPublication(selected.id);
      else if (action === 'archive') result = archivePublication(selected.id);
      else if (action === 'restore') result = restorePublication(selected.id);
      else result = await runDueScheduledPublications();
      setDrafts(loadPublicationDrafts());
      if (Array.isArray(result)) {
        setMessage(t('publishingHub.duePublicationsProcessed', { count: result.length }));
      } else {
        setSelectedId(result.id);
        setMessage(t('publishingHub.publishingActionCompleted', { action: actionLabels[action] ?? action }));
      }
    } catch {
      setMessage(t('publishingHub.publishingActionFailed'));
    } finally {
      setBusy(false);
    }
  }

  function updateConnection(id: string, patch: Partial<PublishingConnectionPreference>) {
    const now = new Date().toISOString();
    const next = connections.map((item) => item.id === id ? { ...item, ...patch, updatedAt: now } : item);
    if (savePublishingConnections(next)) {
      setConnections(next);
      setMessage(t('publishingHub.connectionSaved'));
    } else setMessage(t('publishingHub.connectionSaveError'));
    refreshConnections();
  }

  return (
    <CosModuleShell eyebrow={t('publishingHub.eyebrow')} title={t('publishingHub.title')} description={t('publishingHub.description')}
      actions={<AppButton variant="outline" leftIcon={<PlayCircle className="h-4 w-4" />} onClick={() => runAction('run-due')} loading={busy}>{t('pages.publishingHub.runDueSchedule')}</AppButton>}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label={t('pages.publishingHub.publicationDrafts')} value={drafts.length} />
        <MetricCard label={t('pages.publishingHub.awaitingReview')} value={drafts.filter((item) => item.status === 'in-review').length} />
        <MetricCard label={t('pages.publishingHub.scheduled')} value={scheduled.length} />
        <MetricCard label={t('pages.publishingHub.published')} value={drafts.filter((item) => item.status === 'published').length} />
        <MetricCard label={t('pages.publishingHub.publishingJobs')} value={jobs.length} detail={t('pages.publishingHub.failedJobs', { count: jobs.filter((item) => item.status === 'failed').length })} />
      </div>

      <AppCard className="p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold">{t('pages.publishingHub.securePublishingBoundary')}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('pages.publishingHub.mockModeSimulatesACompletedPostAndManual')}</p>
          </div>
        </div>
      </AppCard>

      <div className="grid gap-6 xl:grid-cols-[350px_minmax(0,1fr)]">
        <div className="space-y-4">
          <AppCard className="space-y-4 p-4">
            <h2 className="font-semibold">{t('pages.publishingHub.createFromCampaign')}</h2>
            <AppSelect label={t('pages.publishingHub.campaignWorkflow')} value={workflowId} onChange={(event) => setWorkflowId(event.target.value)} options={workflows.length ? workflows.map((item) => ({ value: item.id, label: item.name })) : [{ value: '', label: t('pages.publishingHub.noWorkflowsAvailable') }]} />
            <AppSelect label={t('pages.publishingHub.creativeAsset')} value={assetId} onChange={(event) => setAssetId(event.target.value)} options={[{ value: '', label: t('pages.publishingHub.autoSelectCampaignAsset') }, ...assets.map((item) => ({ value: item.id, label: `${item.name} · ${item.type}` }))]} />
            <AppButton fullWidth disabled={!workflowId} leftIcon={<FileOutput className="h-4 w-4" />} onClick={createDraft}>{t('pages.publishingHub.createPublishingDraft')}</AppButton>
          </AppCard>

          <AppCard className="space-y-3 p-4">
            <h2 className="font-semibold">{t('pages.publishingHub.draftQueue')}</h2>
            <AppInput label={t('pages.publishingHub.search')} fullWidth value={search} onChange={(event) => setSearch(event.target.value)} />
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <AppSelect label={t('pages.publishingHub.status')} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} options={[{ value: 'all', label: t('pages.publishingHub.allStatuses') }, ...['draft','in-review','approved','scheduled','publishing','published','failed','cancelled','archived'].map((value) => ({ value, label: translateStatus(value) }))]} />
              <AppSelect label={t('pages.publishingHub.platform')} value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value)} options={[{ value: 'all', label: t('pages.publishingHub.allPlatforms') }, ...connections.map((item) => ({ value: item.platform, label: translatePlatform(item.platform) }))]} />
            </div>
            <div className="max-h-[420px] space-y-2 overflow-auto pr-1">
              {filteredDrafts.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">{t('pages.publishingHub.noPublicationDraftsMatchTheFilters')}</p> : filteredDrafts.map((draft) => (
                <button key={draft.id} type="button" onClick={() => setSelectedId(draft.id)} className={`w-full rounded-md border p-3 text-left transition ${selected?.id === draft.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}`}>
                  <div className="flex items-start justify-between gap-2"><p className="line-clamp-1 text-sm font-semibold">{draft.title || t('pages.publishingHub.untitledPublication')}</p><AppBadge size="sm" variant={statusVariant(draft.status)}>{translateStatus(draft.status)}</AppBadge></div>
                  <p className="mt-1 text-xs text-muted-foreground">{translatePlatform(draft.platform)}{draft.scheduledAt ? ` · ${formatDateTime(draft.scheduledAt)}` : ''}</p>
                </button>
              ))}
            </div>
          </AppCard>
        </div>

        <div className="space-y-5">
          {!selected ? <AppCard className="p-8 text-center text-sm text-muted-foreground">{t('pages.publishingHub.createOrSelectAPublicationDraft')}</AppCard> : (
            <>
              <AppCard className="space-y-4 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">{t('pages.publishingHub.publicationEditor')}</h2><AppBadge variant={statusVariant(selected.status)}>{translateStatus(selected.status)}</AppBadge><AppBadge variant={selected.adapterMode === 'mock' ? 'warning' : 'outline'}>{translatePublicationMode(selected.adapterMode)}</AppBadge></div><p className="mt-1 text-xs text-muted-foreground">ID {selected.id}</p></div>
                  <div className="flex flex-wrap gap-2">
                    {selected.status === 'draft' || selected.status === 'failed' || selected.status === 'cancelled' ? <AppButton size="sm" variant="outline" leftIcon={<ClipboardCheck className="h-4 w-4" />} onClick={() => runAction('review')}>{t('pages.publishingHub.requestReview')}</AppButton> : null}
                    {selected.status === 'in-review' ? <>
                      <AppButton size="sm" leftIcon={<CheckCircle2 className="h-4 w-4" />} onClick={() => runAction('approve')}>{t('pages.publishingHub.approve')}</AppButton>
                      <AppButton size="sm" variant="outline" leftIcon={<XCircle className="h-4 w-4" />} onClick={() => runAction('reject')}>{t('pages.publishingHub.requestChanges')}</AppButton>
                    </> : null}
                    {selected.status === 'failed' || selected.status === 'cancelled' ? <AppButton size="sm" variant="outline" leftIcon={<RotateCcw className="h-4 w-4" />} onClick={() => runAction('retry')}>{t('pages.publishingHub.prepareRetry')}</AppButton> : null}
                    {selected.status === 'archived' ? <AppButton size="sm" variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={() => runAction('restore')}>{t('pages.publishingHub.restore')}</AppButton> : <AppButton size="sm" variant="ghost" leftIcon={<Archive className="h-4 w-4" />} disabled={selected.status === 'publishing'} onClick={() => runAction('archive')}>{t('pages.publishingHub.archive')}</AppButton>}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <AppInput label={t('pages.publishingHub.title')} fullWidth value={selected.title} disabled={['publishing','published','archived'].includes(selected.status)} onChange={(event) => updateSelected({ title: event.target.value })} />
                  <AppSelect label={t('pages.publishingHub.creativeAsset')} value={selected.creativeAssetId ?? ''} disabled={['publishing','published','archived'].includes(selected.status)} onChange={(event) => updateSelected({ creativeAssetId: event.target.value || undefined })} options={[{ value: '', label: t('pages.publishingHub.selectAsset') }, ...assets.map((item) => ({ value: item.id, label: `${item.name} · ${item.type}` }))]} />
                  <AppSelect label={t('pages.publishingHub.executionMode')} value={selected.adapterMode} disabled={['publishing','published','archived'].includes(selected.status)} onChange={(event) => updateSelected({ adapterMode: event.target.value as PublicationDraft['adapterMode'] })} options={[{ value: 'mock', label: t('pages.publishingHub.mockSimulation') }, { value: 'manual', label: t('pages.publishingHub.manualExport') }, { value: 'secure-backend', label: t('pages.publishingHub.secureBackend') }]} />
                </div>
                <AppTextarea label={t('publishingHub.captionLabel')} rows={5} value={selected.caption} disabled={['publishing','published','archived'].includes(selected.status)} onChange={(event) => updateSelected({ caption: event.target.value })} />
                <div className="grid gap-4 md:grid-cols-2">
                  <AppInput label={t('pages.publishingHub.hashtags')} fullWidth value={selected.hashtags.join(' ')} disabled={['publishing','published','archived'].includes(selected.status)} helperText={t('publishingHub.hashtagHelper')} onChange={(event) => updateSelected({ hashtags: event.target.value.split(/\s+/).filter(Boolean) })} />
                  <AppInput label={t('pages.publishingHub.destinationUrl')} type="url" fullWidth value={selected.destinationUrl ?? ''} disabled={['publishing','published','archived'].includes(selected.status)} onChange={(event) => updateSelected({ destinationUrl: event.target.value || undefined })} />
                </div>

                <div className="rounded-md border p-4">
                  <div className="flex items-center justify-between"><h3 className="font-semibold">{t('pages.publishingHub.preflightValidation')}</h3><AppBadge variant={selected.validation.valid ? 'success' : 'danger'}>{selected.validation.valid ? t('pages.publishingHub.ready') : t('pages.publishingHub.errorsCount', { count: selected.validation.issues.filter((item) => item.severity === 'error').length })}</AppBadge></div>
                  {selected.validation.issues.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{t('pages.publishingHub.noValidationIssues')}</p> : <ul className="mt-3 space-y-2">{selected.validation.issues.map((issue) => <li key={`${issue.code}-${issue.field}`} className="flex gap-2 text-sm"><span className={issue.severity === 'error' ? 'text-destructive' : 'text-warning'}>{issue.severity === 'error' ? '●' : '▲'}</span><span><strong>{issue.field}:</strong> {issue.message}</span></li>)}</ul>}
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                  <AppInput label={t('pages.publishingHub.schedule')} type="datetime-local" fullWidth value={scheduleValue} onChange={(event) => setScheduleValue(event.target.value)} />
                  <AppInput label={t('pages.publishingHub.timezone')} fullWidth value={selected.timezone} onChange={(event) => updateSelected({ timezone: event.target.value })} />
                  <div className="flex flex-wrap gap-2">
                    <AppButton variant="outline" disabled={selected.status !== 'approved' || !scheduleValue} leftIcon={<CalendarClock className="h-4 w-4" />} onClick={() => runAction('schedule')}>{t('pages.publishingHub.schedule')}</AppButton>
                    <AppButton disabled={!['approved','scheduled','failed','cancelled'].includes(selected.status)} loading={busy} leftIcon={<Send className="h-4 w-4" />} onClick={() => runAction('publish')}>{t('pages.publishingHub.publish')}</AppButton>
                    {!['published','archived','cancelled'].includes(selected.status) ? <AppButton variant="danger" leftIcon={<XCircle className="h-4 w-4" />} onClick={() => runAction('cancel')}>{t('pages.publishingHub.cancel')}</AppButton> : null}
                  </div>
                </div>

                {selected.permalink ? <a href={selected.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-primary"><ExternalLink className="h-4 w-4" />{t('pages.publishingHub.openPublishingResult')}</a> : null}
                {selected.failureMessage ? <p role="alert" className="text-sm text-destructive">{selected.failureMessage}</p> : null}
              </AppCard>

              <AppCard className="p-5">
                <div className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-primary" /><h2 className="font-semibold">{t('pages.publishingHub.editorialCalendar')}</h2></div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {scheduled.length === 0 ? <p className="text-sm text-muted-foreground">{t('pages.publishingHub.noScheduledPublications')}</p> : scheduled.map((item) => <div key={item.id} className="rounded-md border p-3"><p className="text-xs font-semibold uppercase text-primary">{formatDate(item.scheduledAt!)}</p><p className="mt-1 text-sm font-semibold">{item.title || t('pages.publishingHub.untitled')}</p><p className="mt-1 text-xs text-muted-foreground">{new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(item.scheduledAt!))} · {translatePlatform(item.platform)}</p></div>)}
                </div>
              </AppCard>
            </>
          )}

          <AppCard className="p-5">
            <div className="flex items-center gap-2"><Send className="h-5 w-5 text-primary" /><h2 className="font-semibold">{t('pages.publishingHub.publishingJobs')}</h2></div>
            <div className="mt-4 space-y-2">
              {jobs.length === 0 ? <p className="text-sm text-muted-foreground">{t('pages.publishingHub.noPublishingJobsYet')}</p> : jobs.slice(0, 10).map((job) => <div key={job.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">{translatePlatform(job.platform)} · {t('pages.publishingHub.attemptLabel', { current: job.attempt, max: job.maxAttempts })}</p><p className="mt-1 text-xs text-muted-foreground">{translatePublicationMode(job.adapterMode)} · {formatDateTime(job.updatedAt)}</p></div><AppBadge variant={job.status === 'succeeded' ? 'success' : job.status === 'failed' ? 'danger' : job.status === 'running' ? 'primary' : 'outline'}>{translateStatus(job.status)}</AppBadge></div>)}
            </div>
          </AppCard>

          <AppCard className="p-5">
            <h2 className="font-semibold">{t('pages.publishingHub.channelPreparation')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('pages.publishingHub.thesePreferencesContainLabelsAndExecutio')}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {connections.map((connection) => <div key={connection.id} className="rounded-md border p-3"><div className="flex items-center justify-between gap-2"><p className="font-semibold capitalize">{translatePlatform(connection.platform)}</p><AppBadge size="sm" variant={connection.enabled ? 'success' : 'outline'}>{connection.enabled ? translateStatus(connection.status) : t('pages.publishingHub.disable')}</AppBadge></div><AppInput className="mt-2" label={t('pages.publishingHub.accountLabel')} fullWidth value={connection.accountLabel} onChange={(event) => updateConnection(connection.id, { accountLabel: event.target.value })} /><AppSelect label={t('pages.publishingHub.mode')} value={connection.adapterMode} onChange={(event) => updateConnection(connection.id, { adapterMode: event.target.value as PublishingConnectionPreference['adapterMode'], status: event.target.value === 'secure-backend' ? 'disconnected' : 'mock-ready' })} options={[{ value: 'mock', label: t('pages.publishingHub.mockSimulation') }, { value: 'manual', label: t('pages.publishingHub.manualExport') }, { value: 'secure-backend', label: t('pages.publishingHub.secureBackend') }]} /><div className="mt-2 flex items-center justify-end"><AppButton size="sm" variant="ghost" onClick={() => updateConnection(connection.id, { enabled: !connection.enabled })}>{connection.enabled ? t('pages.publishingHub.disable') : t('pages.publishingHub.enable')}</AppButton></div></div>)}
            </div>
          </AppCard>
        </div>
      </div>

      <p aria-live="polite" className="text-sm text-muted-foreground">{message}</p>
    </CosModuleShell>
  );
}

export default PublishingHubPage;
