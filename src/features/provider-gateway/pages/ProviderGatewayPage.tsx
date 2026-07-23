import { useTranslation } from '@/features/i18n/useTranslation';
import { useDisplayHelpers } from '@/features/i18n';
import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Clock3,
  KeyRound,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  ServerCog,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { CosModuleShell, MetricCard } from '@/components/common';
import { AppBadge } from '@/components/ui/AppBadge';
import { AppButton } from '@/components/ui/AppButton';
import { AppCard } from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import {
  getProviderRegistry,
  getGatewayUrl,
  type AIProviderId,
  type ProviderConnectionPreference,
  type ProviderJob,
} from '@/core';
import {
  loadProviderConnections,
  saveProviderConnections,
} from '../lib/providerConnectionStorage';
import {
  loadProviderJobs,
  subscribeToProviderJobs,
} from '../lib/providerJobStorage';
import {
  cancelProviderJob,
  pollProviderJob,
  retryProviderJob,
} from '../lib/providerGatewayService';

function jobBadge(status: ProviderJob['status']) {
  if (status === 'succeeded') return 'success' as const;
  if (status === 'failed') return 'danger' as const;
  if (status === 'cancelled') return 'outline' as const;
  if (status === 'running') return 'primary' as const;
  return 'warning' as const;
}

function statusIcon(status: ProviderJob['status']) {
  if (status === 'succeeded') return <CheckCircle2 className="h-4 w-4" />;
  if (status === 'failed') return <XCircle className="h-4 w-4" />;
  if (status === 'cancelled') return <Ban className="h-4 w-4" />;
  if (status === 'running') return <PlayCircle className="h-4 w-4" />;
  return <Clock3 className="h-4 w-4" />;
}

export function ProviderGatewayPage() {
  const { t } = useTranslation();
  const { translateStatus } = useDisplayHelpers();
  const registry = useMemo(getProviderRegistry, []);
  const [connections, setConnections] = useState<ProviderConnectionPreference[]>(loadProviderConnections);
  const [jobs, setJobs] = useState<ProviderJob[]>(loadProviderJobs);
  const [busyJobId, setBusyJobId] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => subscribeToProviderJobs(setJobs), []);

  function updateConnection(providerId: AIProviderId, patch: Partial<ProviderConnectionPreference>) {
    const next = connections.map((connection) =>
      connection.providerId === providerId
        ? { ...connection, ...patch, updatedAt: new Date().toISOString() }
        : connection,
    );
    if (saveProviderConnections(next)) {
      setConnections(next);
      setMessage(t('pages.providerGateway.preferencesSaved'));
    } else {
      setMessage(t('pages.providerGateway.unableToSave'));
    }
  }

  async function runJobAction(job: ProviderJob, action: 'poll' | 'retry' | 'cancel') {
    setBusyJobId(job.id);
    const result = action === 'poll'
      ? await pollProviderJob(job.id)
      : action === 'retry'
        ? await retryProviderJob(job.id)
        : await cancelProviderJob(job.id);
    setJobs(loadProviderJobs());
    const actionLabel = t(`pages.providerGateway.${action}`);
    setMessage(result.error
      ? t('pages.providerGateway.providerJobActionFailed')
      : t('pages.providerGateway.providerJobActionCompleted', { action: actionLabel }));
    setBusyJobId('');
  }

  const activeJobs = jobs.filter((job) => job.status === 'queued' || job.status === 'running').length;
  const failedJobs = jobs.filter((job) => job.status === 'failed').length;
  const totalCost = jobs.reduce((sum, job) => sum + (job.estimatedCostUsd ?? 0), 0);
  const gatewayUrl = getGatewayUrl();

  return (
    <CosModuleShell eyebrow={t('providerGateway.eyebrow')} title={t('providerGateway.title')} description={t('providerGateway.description')}
    >
      <div className="grid gap-3 sm:grid-cols-4">
        <MetricCard label={t('pages.providerGateway.registeredProviders')} value={registry.length} />
        <MetricCard label={t('pages.providerGateway.providerJobs')} value={jobs.length} />
        <MetricCard label={t('pages.providerGateway.activeJobs')} value={activeJobs} detail={t('pages.providerGateway.queuedAndRunning')} />
        <MetricCard label={t('pages.providerGateway.estimatedCost')} value={`$${totalCost.toFixed(4)}`} detail={t('pages.providerGateway.failedJobs', { count: failedJobs })} />
      </div>

      <AppCard className="p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold">{t('pages.providerGateway.secureExecutionBoundary')}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('pages.providerGateway.realGeminiImagenFlowAndVeoCallsRequireTh')}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t('pages.providerGateway.gatewayStatus')} {gatewayUrl ? t('pages.providerGateway.backendConfigured') : t('pages.providerGateway.notConfigured')}.
            </p>
          </div>
        </div>
      </AppCard>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{t('pages.providerGateway.providerRegistry')}</h2>
          <p className="text-sm text-muted-foreground">{t('pages.providerGateway.enableOnlyProvidersThatAreReadyForThisWo')}</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {registry.map((provider) => {
            const connection = connections.find((item) => item.providerId === provider.id)!;
            const canEnable = provider.availability === t('pages.providerGateway.available');
            return (
              <AppCard key={provider.id} className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{provider.name}</h3>
                      <AppBadge
                        variant={provider.availability === t('pages.providerGateway.available') ? 'success' : 'warning'}
                        size="sm"
                        radius="pill"
                      >
                        {provider.availability === t('pages.providerGateway.available') ? t('pages.providerGateway.available') : t('pages.providerGateway.backendRequired')}
                      </AppBadge>
                      <AppBadge variant={connection.enabled ? 'primary' : 'outline'} size="sm" radius="pill">
                        {connection.enabled ? t('pages.providerGateway.enabled') : t('pages.providerGateway.disabled')}
                      </AppBadge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{provider.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {provider.capabilities.map((capability) => (
                        <AppBadge key={capability} variant="outline" size="sm">{capability}</AppBadge>
                      ))}
                    </div>
                  </div>
                  <AppButton
                    size="sm"
                    variant={connection.enabled ? 'outline' : 'primary'}
                    disabled={!canEnable && !connection.enabled}
                    leftIcon={connection.enabled ? <Ban className="h-4 w-4" /> : <ServerCog className="h-4 w-4" />}
                    onClick={() => updateConnection(provider.id, { enabled: !connection.enabled })}
                  >
                    {connection.enabled ? t('pages.providerGateway.disable') : t('pages.providerGateway.enable')}
                  </AppButton>
                </div>
                <div className="mt-4">
                  <AppInput
                    label={t('pages.providerGateway.defaultModelLabel')}
                    fullWidth
                    value={connection.defaultModel}
                    onChange={(event) => updateConnection(provider.id, { defaultModel: event.target.value || provider.defaultModel })}
                  />
                </div>
              </AppCard>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">{t('pages.providerGateway.jobMonitor')}</h2>
          <p className="text-sm text-muted-foreground">{t('pages.providerGateway.jobsAreIdempotentAndRemainLinkedToTheirE')}</p>
        </div>
        {jobs.length === 0 ? (
          <AppCard className="p-10 text-center">
            <KeyRound className="mx-auto h-9 w-9 text-primary" />
            <h3 className="mt-3 font-semibold">{t('pages.providerGateway.noProviderJobsYet')}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t('pages.providerGateway.dispatchAReadyPromptImageOrVideoTaskFrom')}</p>
          </AppCard>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <AppCard key={job.id} className="p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <AppBadge variant={jobBadge(job.status)} leftIcon={statusIcon(job.status)} radius="pill">
                        {translateStatus(job.status)}
                      </AppBadge>
                      <span className="text-sm font-semibold">{job.providerId} / {job.model}</span>
                      <span className="text-xs text-muted-foreground">{t('pages.providerGateway.attempt')} {job.attempt}/{job.maxAttempts}</span>
                    </div>
                    <p className="mt-2 truncate text-sm">{job.request.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('pages.providerGateway.run', { id: job.executionRunId })} · {t('pages.providerGateway.task', { id: job.executionTaskId })}
                    </p>
                    {job.errorMessage ? <p className="mt-2 text-xs text-destructive">{job.errorMessage}</p> : null}
                    {job.response?.outputUrl ? <p className="mt-2 break-all text-xs text-primary">{job.response.outputUrl}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {job.status === 'queued' || job.status === 'running' ? (
                      <>
                        <AppButton
                          size="sm"
                          variant="outline"
                          loading={busyJobId === job.id}
                          leftIcon={<RefreshCw className="h-4 w-4" />}
                          onClick={() => runJobAction(job, 'poll')}
                        >{t('pages.providerGateway.poll')}</AppButton>
                        <AppButton
                          size="sm"
                          variant="danger"
                          loading={busyJobId === job.id}
                          leftIcon={<Ban className="h-4 w-4" />}
                          onClick={() => runJobAction(job, 'cancel')}
                        >{t('pages.providerGateway.cancel')}</AppButton>
                      </>
                    ) : null}
                    {(job.status === 'failed' || job.status === 'cancelled') && job.attempt < job.maxAttempts ? (
                      <AppButton
                        size="sm"
                        variant="outline"
                        loading={busyJobId === job.id}
                        leftIcon={<RotateCcw className="h-4 w-4" />}
                        onClick={() => runJobAction(job, 'retry')}
                      >{t('pages.providerGateway.retry')}</AppButton>
                    ) : null}
                  </div>
                </div>
              </AppCard>
            ))}
          </div>
        )}
      </section>

      <p aria-live="polite" className="text-sm text-muted-foreground">{message}</p>
    </CosModuleShell>
  );
}

export default ProviderGatewayPage;
