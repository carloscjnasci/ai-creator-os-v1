import { useTranslation } from '@/features/i18n/useTranslation';
import { useDisplayHelpers } from '@/features/i18n';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  Bot,
  Play,
  Plus,
  RefreshCw,
  Save,
  SkipForward,
  XCircle,
} from 'lucide-react';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import AppSelect from '@/components/ui/AppSelect';
import AppTextarea from '@/components/ui/AppTextarea';
import { CosModuleShell, MetricCard } from '@/components/common';
import {
  buildExecutionProviderPackage,
  createExecutionRun,
  getExecutionTaskActions,
  publishCreativeEvent,
  transitionExecutionTask,
  updateExecutionTaskOutput,
  type ExecutionRun,
  type ExecutionTask,
  type ExecutionTaskAction,
  getCompatibleProviders,
  type AIProviderId,
} from '@/core';
import { loadCreativePlans } from '@/features/ai-director/lib/creativePlanStorage';
import {
  loadExecutionRuns,
  saveExecutionRuns,
  subscribeToExecutionRuns,
} from '../lib/executionRunStorage';
import {
  registerExecutionOutput,
  syncCampaignWorkflowFromExecution,
} from '../lib/executionIntegrations';
import { loadProviderConnections } from '@/features/provider-gateway/lib/providerConnectionStorage';
import { dispatchExecutionTaskToProvider } from '@/features/provider-gateway/lib/providerGatewayService';

function taskBadgeVariant(status: ExecutionTask['status']) {
  if (status === 'completed') return 'success' as const;
  if (status === 'in-progress' || status === 'review') return 'primary' as const;
  if (status === 'failed') return 'danger' as const;
  if (status === 'blocked') return 'warning' as const;
  return 'outline' as const;
}

function actionIcon(action: ExecutionTaskAction) {
  if (action === 'start') return <Play className="h-4 w-4" />;
  if (action === 'complete') return <CheckCircle2 className="h-4 w-4" />;
  if (action === 'fail') return <XCircle className="h-4 w-4" />;
  if (action === 'skip') return <SkipForward className="h-4 w-4" />;
  return <RefreshCw className="h-4 w-4" />;
}

export function ExecutionCenterPage() {
  const { t } = useTranslation();
  const { translateStatus } = useDisplayHelpers();
  const actionLabels: Record<ExecutionTaskAction, string> = {
    start: t('pages.executionCenter.startTask'),
    'send-to-review': t('pages.executionCenter.sendToReview'),
    complete: t('pages.executionCenter.complete'),
    fail: t('pages.executionCenter.markFailed'),
    retry: t('pages.executionCenter.retry'),
    skip: t('pages.executionCenter.skip'),
    reopen: t('pages.executionCenter.reopen'),
    unblock: t('pages.executionCenter.resolveBlocker'),
  };
  const [searchParams, setSearchParams] = useSearchParams();
  const plans = useMemo(loadCreativePlans, []);
  const [runs, setRuns] = useState<ExecutionRun[]>(loadExecutionRuns);
  const requestedRunId = searchParams.get('run') ?? '';
  const [selectedRunId, setSelectedRunId] = useState(
    requestedRunId || loadExecutionRuns()[0]?.id || '',
  );
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id ?? '');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [outputUrl, setOutputUrl] = useState('');
  const [outputText, setOutputText] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [selectedProviderId, setSelectedProviderId] = useState<AIProviderId>('mock');
  const [providerModel, setProviderModel] = useState('cos-mock-v1');
  const [isDispatching, setIsDispatching] = useState(false);

  useEffect(() => subscribeToExecutionRuns(setRuns), []);

  useEffect(() => {
    if (requestedRunId && runs.some((run) => run.id === requestedRunId)) {
      setSelectedRunId(requestedRunId);
    }
  }, [requestedRunId, runs]);

  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? runs[0];
  const plan = plans.find((candidate) => candidate.id === selectedRun?.planId);
  const selectedTask = selectedRun?.tasks.find((task) => task.id === selectedTaskId)
    ?? selectedRun?.tasks.find((task) => ['ready', 'in-progress', 'review', 'failed'].includes(task.status))
    ?? selectedRun?.tasks[0];

  useEffect(() => {
    if (!selectedTask) {
      setSelectedTaskId('');
      setOutputUrl('');
      setOutputText('');
      setNotes('');
      return;
    }
    setSelectedTaskId(selectedTask.id);
    setOutputUrl(selectedTask.outputUrl ?? '');
    setOutputText(selectedTask.outputText ?? '');
    setNotes(selectedTask.notes ?? '');
  }, [selectedTask?.id, selectedTask?.outputUrl, selectedTask?.outputText, selectedTask?.notes]);

  const providerPackage = plan && selectedTask
    ? buildExecutionProviderPackage(plan, selectedTask)
    : null;
  const providerConnections = loadProviderConnections();
  const compatibleProviders = selectedTask
    ? getCompatibleProviders(selectedTask).filter((provider) =>
        provider.availability === 'available' &&
        providerConnections.some((connection) => connection.providerId === provider.id && connection.enabled),
      )
    : [];

  useEffect(() => {
    const preferred = compatibleProviders.find((provider) => provider.id === selectedProviderId)
      ?? compatibleProviders[0];
    if (!preferred) return;
    const connection = providerConnections.find((item) => item.providerId === preferred.id);
    setSelectedProviderId(preferred.id);
    setProviderModel(connection?.defaultModel ?? preferred.defaultModel);
  }, [selectedTask?.id]);

  function persistRun(nextRun: ExecutionRun, successMessage: string) {
    const nextRuns = [nextRun, ...runs.filter((run) => run.id !== nextRun.id)];
    if (!saveExecutionRuns(nextRuns)) {
      setMessage(t('pages.executionCenter.unableToSaveExecution'));
      return false;
    }
    setRuns(nextRuns);
    setSelectedRunId(nextRun.id);
    setSearchParams({ run: nextRun.id });
    syncCampaignWorkflowFromExecution(nextRun);
    publishCreativeEvent('execution.run.updated', nextRun);
    setMessage(successMessage);
    return true;
  }

  function createRun() {
    const selectedPlan = plans.find((candidate) => candidate.id === selectedPlanId);
    if (!selectedPlan) {
      setMessage(t('pages.executionCenter.saveCreativePlanFirst'));
      return;
    }
    const run = createExecutionRun(selectedPlan);
    if (persistRun(run, t('pages.executionCenter.productionRunCreated'))) {
      setSelectedTaskId(run.tasks[0]?.id ?? '');
      publishCreativeEvent('execution.run.created', run);
    }
  }

  function saveOutput() {
    if (!selectedRun || !selectedTask) return;
    const result = updateExecutionTaskOutput(selectedRun, selectedTask.id, {
      outputUrl: outputUrl.trim() || undefined,
      outputText: outputText.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    if (result.changed) persistRun(result.run, t('pages.executionCenter.taskOutputSaved'));
  }

  function performAction(action: ExecutionTaskAction) {
    if (!selectedRun || !selectedTask) return;
    let result = transitionExecutionTask(selectedRun, selectedTask.id, action, {
      outputUrl: outputUrl.trim() || undefined,
      outputText: outputText.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    if (!result.changed) {
      setMessage(t('pages.executionCenter.taskUpdateFailed'));
      return;
    }

    if (action === 'complete' && plan) {
      const completedTask = result.run.tasks.find((task) => task.id === selectedTask.id);
      if (completedTask) {
        const registered = registerExecutionOutput(result.run, completedTask, plan);
        if (registered.creativeAssetId || registered.promptExperimentId) {
          result = updateExecutionTaskOutput(result.run, completedTask.id, registered);
        }
      }
    }

    if (persistRun(result.run, `${selectedTask.label}: ${actionLabels[action].toLowerCase()}.`)) {
      publishCreativeEvent('execution.task.updated', {
        runId: result.run.id,
        taskId: selectedTask.id,
        action,
      });
    }
  }

  async function copyProviderPackage() {
    if (!providerPackage) return;
    try {
      await navigator.clipboard.writeText(providerPackage.content);
      setMessage(t('pages.executionCenter.titleCopied', { title: providerPackage.title }));
    } catch {
      setMessage(t('pages.executionCenter.clipboardPermissionNotAvailable'));
    }
  }

  async function dispatchToProvider() {
    if (!selectedRun || !selectedTask || !plan) return;
    setIsDispatching(true);
    const result = await dispatchExecutionTaskToProvider({
      run: selectedRun,
      task: selectedTask,
      plan,
      providerId: selectedProviderId,
      model: providerModel,
    });
    const refreshedRuns = loadExecutionRuns();
    setRuns(refreshedRuns);
    const refreshedRun = refreshedRuns.find((item) => item.id === selectedRun.id);
    if (refreshedRun) setSelectedRunId(refreshedRun.id);
    setMessage(result.error
      ? t('pages.executionCenter.providerDispatchFailed')
      : t('pages.executionCenter.taskDispatchedTo', { providerId: selectedProviderId }));
    setIsDispatching(false);
  }

  const activeRuns = runs.filter((run) => run.status === 'active' || run.status === 'draft').length;
  const completedRuns = runs.filter((run) => run.status === 'completed').length;

  return (
    <CosModuleShell eyebrow={t('executionCenter.eyebrow')} title={t('executionCenter.title')} description={t('executionCenter.description')}
      actions={
        <div className="flex flex-wrap items-end gap-2">
          <AppSelect
            aria-label={t('pages.executionCenter.creativePlan')}
            value={selectedPlanId}
            onChange={(event) => setSelectedPlanId(event.target.value)}
            options={plans.length > 0
              ? plans.map((item) => ({ value: item.id, label: item.campaignName }))
              : [{ value: '', label: t('pages.executionCenter.noSavedPlans') }]}
          />
          <AppButton size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={createRun}>{t('pages.executionCenter.newProductionRun')}</AppButton>
        </div>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label={t('pages.executionCenter.productionRuns')} value={runs.length} />
        <MetricCard label={t('pages.executionCenter.active')} value={activeRuns} detail={t('pages.executionCenter.draftAndInProduction')} />
        <MetricCard label={t('pages.executionCenter.completed')} value={completedRuns} detail={t('pages.executionCenter.learningLoopReady')} />
      </div>

      {runs.length === 0 ? (
        <AppCard className="p-10 text-center">
          <Play className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-xl font-semibold">{t('pages.executionCenter.noProductionRunsYet')}</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{t('pages.executionCenter.generateAndSaveAPlanInAiDirectorThenCrea')}</p>
        </AppCard>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <AppCard className="p-3">
            <p className="px-2 pb-2 text-xs font-semibold uppercase text-muted-foreground">{t('pages.executionCenter.runs')}</p>
            <div className="space-y-1">
              {runs.map((run) => (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => {
                    setSelectedRunId(run.id);
                    setSelectedTaskId('');
                    setSearchParams({ run: run.id });
                  }}
                  className={`w-full rounded-md p-3 text-left transition-colors ${selectedRun?.id === run.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                >
                  <p className="truncate text-sm font-semibold">{run.name}</p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                    <span className={selectedRun?.id === run.id ? 'text-primary-foreground/75' : 'text-muted-foreground'}>{translateStatus(run.status)}</span>
                    <span>{run.progress}%</span>
                  </div>
                </button>
              ))}
            </div>
          </AppCard>

          {selectedRun ? (
            <div className="space-y-6">
              <AppCard className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold">{selectedRun.name}</h2>
                      <AppBadge variant={selectedRun.status === 'completed' ? 'success' : selectedRun.status === 'blocked' ? 'warning' : 'primary'} size="sm" radius="pill">
                        {translateStatus(selectedRun.status)}
                      </AppBadge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {plan ? plan.strategy : t('pages.executionCenter.creativePlanUnavailable')}
                    </p>
                  </div>
                  <p className="text-3xl font-bold text-primary">{selectedRun.progress}%</p>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${selectedRun.progress}%` }} />
                </div>
              </AppCard>

              <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <AppCard className="p-4">
                  <h3 className="font-semibold">{t('pages.executionCenter.productionQueue')}</h3>
                  <ol className="mt-4 space-y-2">
                    {selectedRun.tasks.map((task) => (
                      <li key={task.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedTaskId(task.id)}
                          className={`w-full rounded-md border p-3 text-left transition-colors ${selectedTask?.id === task.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/40'}`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">{task.order}</span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold">{task.label}</p>
                                <AppBadge variant={taskBadgeVariant(task.status)} size="sm" radius="pill">{translateStatus(task.status)}</AppBadge>
                              </div>
                              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.blockedReason ?? task.instruction}</p>
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ol>
                </AppCard>

                {selectedTask ? (
                  <div className="space-y-6">
                    <AppCard className="space-y-4 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase text-primary">{t('pages.executionCenter.stage')} {selectedTask.order} · {selectedTask.provider}</p>
                          <h3 className="mt-1 text-lg font-semibold">{selectedTask.label}</h3>
                          <p className="mt-2 text-sm text-muted-foreground">{selectedTask.instruction}</p>
                        </div>
                        <AppBadge variant={taskBadgeVariant(selectedTask.status)} radius="pill">{translateStatus(selectedTask.status)}</AppBadge>
                      </div>

                      <AppInput
                        label={t('pages.executionCenter.outputUrl')}
                        fullWidth
                        placeholder={t('pages.executionCenter.pasteTheGeneratedImageVideoOrPublishingU')}
                        value={outputUrl}
                        onChange={(event) => setOutputUrl(event.target.value)}
                      />
                      <AppTextarea
                        label={t('pages.executionCenter.outputText')}
                        rows={7}
                        placeholder={t('pages.executionCenter.pasteTheFinalPromptProviderResponseCapti')}
                        value={outputText}
                        onChange={(event) => setOutputText(event.target.value)}
                      />
                      <AppTextarea
                        label={t('pages.executionCenter.productionNotes')}
                        rows={3}
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                      />

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <AppButton variant="outline" size="sm" leftIcon={<Save className="h-4 w-4" />} onClick={saveOutput}>{t('pages.executionCenter.saveOutput')}</AppButton>
                        <div className="flex flex-wrap gap-2">
                          {getExecutionTaskActions(selectedTask).map((action) => (
                            <AppButton
                              key={action}
                              size="sm"
                              variant={action === 'fail' ? 'danger' : action === 'complete' ? 'primary' : 'outline'}
                              leftIcon={actionIcon(action)}
                              onClick={() => performAction(action)}
                            >
                              {actionLabels[action]}
                            </AppButton>
                          ))}
                        </div>
                      </div>
                      {selectedTask.status === 'ready' && compatibleProviders.length > 0 ? (
                        <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                            <AppSelect
                              aria-label={t('pages.executionCenter.aiProvider')}
                              value={selectedProviderId}
                              onChange={(event) => {
                                const providerId = event.target.value as AIProviderId;
                                const provider = compatibleProviders.find((item) => item.id === providerId);
                                const connection = providerConnections.find((item) => item.providerId === providerId);
                                setSelectedProviderId(providerId);
                                setProviderModel(connection?.defaultModel ?? provider?.defaultModel ?? '');
                              }}
                              options={compatibleProviders.map((provider) => ({ value: provider.id, label: provider.name }))}
                            />
                            <AppInput
                              label={t('pages.executionCenter.model')}
                              value={providerModel}
                              onChange={(event) => setProviderModel(event.target.value)}
                            />
                            <AppButton
                              size="sm"
                              loading={isDispatching}
                              leftIcon={<Bot className="h-4 w-4" />}
                              onClick={dispatchToProvider}
                            >{t('pages.executionCenter.runWithProvider')}</AppButton>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">{t('pages.executionCenter.providerExecutionIsIdempotentTheLocalMoc')}</p>
                        </div>
                      ) : null}
                      {selectedTask.providerJobId ? (
                        <p className="text-xs text-muted-foreground">
                          {t('pages.executionCenter.providerJob')}: {selectedTask.providerJobId} · {t('pages.executionCenter.model')}: {selectedTask.providerModel ?? t('pages.executionCenter.notRecorded')}
                        </p>
                      ) : null}
                      <p aria-live="polite" className="text-xs text-muted-foreground">{message}</p>
                    </AppCard>

                    {providerPackage ? (
                      <AppCard className="p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase text-primary">{t('pages.executionCenter.providerPackage')}</p>
                            <h3 className="mt-1 font-semibold">{providerPackage.title}</h3>
                          </div>
                          <AppButton variant="outline" size="sm" leftIcon={<ClipboardCopy className="h-4 w-4" />} onClick={copyProviderPackage}>{t('pages.executionCenter.copyPackage')}</AppButton>
                        </div>
                        <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-4 font-sans text-xs leading-5 text-muted-foreground">{providerPackage.content}</pre>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>{t('pages.executionCenter.provider')}: {providerPackage.provider}</span>
                          <span>{t('pages.executionCenter.file')}: {providerPackage.suggestedFileName}</span>
                          {selectedTask.outputUrl ? <a className="inline-flex items-center gap-1 text-primary" href={selectedTask.outputUrl} target="_blank" rel="noreferrer">{t('pages.executionCenter.openOutput')}<ExternalLink className="h-3 w-3" /></a> : null}
                        </div>
                      </AppCard>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </CosModuleShell>
  );
}

export default ExecutionCenterPage;
