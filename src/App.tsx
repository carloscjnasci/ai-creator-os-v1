import { Suspense, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useTranslation } from '@/features/i18n';

import AppLayout from '@/components/layout/AppLayout';
import { AppErrorBoundary } from './components/feedback/AppErrorBoundary';
import { lazyWithRetry } from './lib/runtime/lazyWithRetry';

const DashboardPage = lazyWithRetry(() => import('@/features/dashboard/pages/DashboardPage'));
const CampaignsPage = lazyWithRetry(() => import('@/features/campaigns/pages/CampaignsPage'));
const CharactersPage = lazyWithRetry(() => import('@/features/characters/pages/CharactersPage'));
const ProductsPage = lazyWithRetry(() => import('@/features/products/pages/ProductsPage'));
const WardrobePage = lazyWithRetry(() => import('@/features/wardrobe/pages/WardrobePage'));
const ScenesPage = lazyWithRetry(() => import('@/features/scenes/pages/ScenesPage'));
const PosesPage = lazyWithRetry(() => import('@/features/poses/pages/PosesPage'));
const AIDirectorPage = lazyWithRetry(() => import('@/features/ai-director/pages/AIDirectorPage'));
const ResearchHubPage = lazyWithRetry(() => import('@/features/research-hub/pages/ResearchHubPage'));
const ViralAnalyzerPage = lazyWithRetry(() => import('@/features/viral-analyzer/pages/ViralAnalyzerPage'));
const DigitalHumansPage = lazyWithRetry(() => import('@/features/digital-humans/pages/DigitalHumansPage'));
const CampaignBuilderPage = lazyWithRetry(() => import('@/features/campaign-builder/pages/CampaignBuilderPage'));
const ExecutionCenterPage = lazyWithRetry(() => import('@/features/execution-center/pages/ExecutionCenterPage'));
const ProviderGatewayPage = lazyWithRetry(() => import('@/features/provider-gateway/pages/ProviderGatewayPage'));
const PromptIntelligencePage = lazyWithRetry(() => import('@/features/prompt-intelligence/pages/PromptIntelligencePage'));
const CreativeLibraryPage = lazyWithRetry(() => import('@/features/creative-library/pages/CreativeLibraryPage'));
const AssetPipelinePage = lazyWithRetry(() => import('@/features/asset-pipeline/pages/AssetPipelinePage'));
const PublishingHubPage = lazyWithRetry(() => import('@/features/publishing-hub/pages/PublishingHubPage'));
const AnalyticsFeedbackLoopPage = lazyWithRetry(() => import('@/features/analytics-feedback/pages/AnalyticsFeedbackLoopPage'));
const ExperimentationPage = lazyWithRetry(() => import('@/features/experimentation/pages/ExperimentationPage'));
const CreativeRecipesPage = lazyWithRetry(() => import('@/features/creative-recipes/pages/CreativeRecipesPage'));

const PromptEnginePage = lazyWithRetry(() =>
  import('@/features/prompt-engine').then((module) => ({
    default: module.PromptEnginePage,
  }))
);

const AnalyticsPage = lazyWithRetry(() =>
  import('@/features/analytics').then((module) => ({
    default: module.AnalyticsPage,
  }))
);

const SettingsPage = lazyWithRetry(() =>
  import('@/features/settings').then((module) => ({
    default: module.SettingsPage,
  }))
);

function RouteLoadingFallback() {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[40vh] items-center justify-center px-6"
    >
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">
          {t('common.loadingWorkspace')}
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          {t('common.preparingModule')}
        </p>
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    let disposed = false;
    const cleanups: Array<() => void> = [];

    void import('@/features/asset-pipeline/assetPipelineService').then((module) => {
      if (disposed) return;
      cleanups.push(module.initializeAssetPipelineEventConsumer());
    });

    void import('@/features/publishing-hub/lib/publishingService').then((module) => {
      if (disposed) return;
      cleanups.push(module.initializePublishingEventConsumer());
    });

    void import('@/features/analytics-feedback/analyticsFeedbackEvents').then((module) => {
      if (disposed) return;
      cleanups.push(module.initializeAnalyticsEventConsumer());
    });

    void import('@/features/experimentation/experimentEvents').then((module) => {
      if (disposed) return;
      cleanups.push(module.initializeExperimentEventConsumer());
    });

    void import('@/features/creative-recipes/recipeEvents').then((module) => {
      if (disposed) return;
      cleanups.push(module.initializeRecipeEventConsumer());
    });

    return () => {
      disposed = true;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, []);

  return (
    <AppLayout>
      <AppErrorBoundary>
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/" element={<Navigate to="/ai-director" replace />} />
            <Route path="/ai-director" element={<AIDirectorPage />} />
            <Route path="/research" element={<ResearchHubPage />} />
            <Route path="/viral-analyzer" element={<ViralAnalyzerPage />} />
            <Route path="/digital-humans" element={<DigitalHumansPage />} />
            <Route path="/campaign-builder" element={<CampaignBuilderPage />} />
            <Route path="/execution-center" element={<ExecutionCenterPage />} />
            <Route path="/provider-gateway" element={<ProviderGatewayPage />} />
            <Route path="/prompt-intelligence" element={<PromptIntelligencePage />} />
            <Route path="/creative-library" element={<CreativeLibraryPage />} />
            <Route path="/asset-pipeline" element={<AssetPipelinePage />} />
            <Route path="/publishing-hub" element={<PublishingHubPage />} />
            <Route path="/experimentation" element={<ExperimentationPage />} />
            <Route path="/creative-recipes" element={<CreativeRecipesPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/campaigns" element={<CampaignsPage />} />
            <Route path="/characters" element={<CharactersPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/wardrobe" element={<WardrobePage />} />
            <Route path="/scenes" element={<ScenesPage />} />
            <Route path="/poses" element={<PosesPage />} />
            <Route path="/prompt-engine" element={<PromptEnginePage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/analytics-feedback-loop" element={<AnalyticsFeedbackLoopPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </AppErrorBoundary>
    </AppLayout>
  );
}
