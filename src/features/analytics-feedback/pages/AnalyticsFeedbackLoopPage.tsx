import { useTranslation } from '@/features/i18n/useTranslation';
import { useDisplayHelpers } from '@/features/i18n';
import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Play, 
  Eye, 
  Flame, 
  Award, 
  Heart, 
  HelpCircle, 
  ArrowRight, 
  RotateCcw, 
  ShieldAlert, 
  Sparkles, 
  User, 
  BadgeAlert,
  ThumbsUp,
  ThumbsDown,
  Activity,
  BarChart,
  FileText
} from 'lucide-react';

import { 
  loadSnapshots, 
  loadScorecards, 
  loadInsights, 
  loadRecommendations, 
  loadDecisions, 
  loadCalibrations, 
  loadLearningContext,
  saveSnapshots
} from '../analyticsFeedbackStorage';

import { 
  ingestPerformanceSnapshot,
  trackPublicationSuccess,
  reviewInsight,
  acceptInsight,
  dismissInsight,
  acceptRecommendation,
  rejectRecommendation,
  applyRecommendation,
  undoRecommendation,
  clearAllAnalyticsFeedbackData
} from '../analyticsFeedbackWorkflow';

import { 
  PerformanceSnapshot, 
  PerformanceScorecard, 
  AnalyticsInsight, 
  AnalyticsRecommendation, 
  FeedbackDecision, 
  CalibrationRecord, 
  LearningContext, 
  AnalyticsPlatform,
  AnalyticsSourceType,
  SnapshotStatus,
  MetricWindow
} from '../types';

import { loadCampaignsFromStorage } from '../../campaigns/lib/campaignStorage';
import { loadCreativeAssets } from '../../creative-library/lib/creativeAssetStorage';
import { loadPromptHistoryFromStorage } from '../../prompt-engine/promptHistoryStorage';

export function AnalyticsFeedbackLoopPage() {
  const { t, formatNumber, formatDateTime } = useTranslation();
  const { translateStatus, translatePlatform, translateEnumLabel, translateInsightCategory, translateAnalyticsRecommendationType } = useDisplayHelpers();
  // Local reactive states
  const [snapshots, setSnapshots] = useState<PerformanceSnapshot[]>([]);
  const [scorecards, setScorecards] = useState<PerformanceScorecard[]>([]);
  const [insights, setInsights] = useState<AnalyticsInsight[]>([]);
  const [recommendations, setRecommendations] = useState<AnalyticsRecommendation[]>([]);
  const [decisions, setDecisions] = useState<FeedbackDecision[]>([]);
  const [calibrations, setCalibrations] = useState<CalibrationRecord[]>([]);
  const [learningContext, setLearningContext] = useState<LearningContext | null>(null);

  // Filter/tab states
  const [activeTab, setActiveTab] = useState<'snapshots' | 'insights' | 'recommendations' | 'decisions' | 'calibrations' | 'learning'>('insights');
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Load all data on mount
  const refreshAllData = () => {
    setSnapshots(loadSnapshots());
    setScorecards(loadScorecards());
    setInsights(loadInsights());
    setRecommendations(loadRecommendations());
    setDecisions(loadDecisions());
    setCalibrations(loadCalibrations());
    setLearningContext(loadLearningContext());
  };

  const handleClearHistory = () => {
    const confirmed = window.confirm(t('pages.analyticsFeedbackLoop.clearHistoryConfirmation'));
    if (confirmed) {
      clearAllAnalyticsFeedbackData();
      refreshAllData();
      setStatusMessage(t('pages.analyticsFeedbackLoop.clearHistorySuccess'));
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  useEffect(() => {
    refreshAllData();
  }, []);

  // Manual Trigger to simulate and ingest snapshot performance
  const handleTriggerIngestion = async () => {
    setIsIngesting(true);
    setStatusMessage(t('pages.analyticsFeedbackLoop.simulatingTelemetry'));
    
    setTimeout(() => {
      // Load context metadata to link real IDs if present
      const campaigns = loadCampaignsFromStorage();
      const assets = loadCreativeAssets();
      const promptHistory = loadPromptHistoryFromStorage();
      
      const campaignId = campaigns[0]?.id || 'campaign_mock_1';
      const assetId = assets[0]?.id || 'asset_mock_1';
      const promptId = promptHistory[0]?.id || 'prompt_mock_1';

      const baseTime = Date.now();

      // 1. Ingest a high-performing snap
      const highSnap: PerformanceSnapshot = {
        id: `snap_perf_high_${baseTime}`,
        workspaceId: 'system_workspace',
        platform: AnalyticsPlatform.TIKTOK,
        sourceType: AnalyticsSourceType.PUBLISHING_RESULT,
        status: SnapshotStatus.DRAFT,
        campaignId,
        creativeLibraryAssetId: assetId,
        promptHistoryId: promptId,
        digitalHumanId: 'character_mock_1',
        metricWindow: MetricWindow.FIRST_24_HOURS,
        periodStart: new Date().toISOString(),
        periodEnd: new Date(Date.now() + 86400000).toISOString(),
        capturedAt: new Date().toISOString(),
        currency: 'USD',
        impressions: 45000,
        views: 38000,
        clicks: 3200,
        purchases: 180,
        revenue: 3600,
        spend: 450,
        likes: 4200,
        comments: 180,
        shares: 640,
        saves: 1100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 2. Ingest a low-performing snap
      const lowSnap: PerformanceSnapshot = {
        id: `snap_perf_low_${baseTime}`,
        workspaceId: 'system_workspace',
        platform: AnalyticsPlatform.INSTAGRAM_REELS,
        sourceType: AnalyticsSourceType.PUBLISHING_RESULT,
        status: SnapshotStatus.DRAFT,
        campaignId,
        creativeLibraryAssetId: assetId,
        promptHistoryId: promptId,
        digitalHumanId: 'character_mock_1',
        metricWindow: MetricWindow.FIRST_24_HOURS,
        periodStart: new Date().toISOString(),
        periodEnd: new Date(Date.now() + 86400000).toISOString(),
        capturedAt: new Date().toISOString(),
        currency: 'USD',
        impressions: 12000,
        views: 8000,
        clicks: 80,
        purchases: 2,
        revenue: 40,
        spend: 180,
        likes: 120,
        comments: 8,
        shares: 5,
        saves: 15,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Run workflows
      ingestPerformanceSnapshot(highSnap);
      ingestPerformanceSnapshot(lowSnap);

      refreshAllData();
      setIsIngesting(false);
      setStatusMessage(t('pages.analyticsFeedbackLoop.ingestionSuccess'));
      
      // Auto dismiss status message
      setTimeout(() => setStatusMessage(null), 8000);
    }, 1500);
  };

  // Insight actions
  const handleReviewInsight = (id: string) => {
    reviewInsight(id);
    refreshAllData();
  };

  const handleAcceptInsight = (id: string) => {
    acceptInsight(id);
    refreshAllData();
  };

  const handleDismissInsight = (id: string) => {
    dismissInsight(id);
    refreshAllData();
  };

  // Recommendation actions
  const handleAcceptRec = (id: string) => {
    acceptRecommendation(id, t('pages.analyticsFeedbackLoop.acceptRationale'));
    refreshAllData();
  };

  const handleRejectRec = (id: string) => {
    rejectRecommendation(id, t('pages.analyticsFeedbackLoop.rejectRationale'));
    refreshAllData();
  };

  const handleApplyRec = (id: string) => {
    applyRecommendation(id, t('pages.analyticsFeedbackLoop.applyRationale'));
    refreshAllData();
  };

  // Decision rollback
  const handleUndoDecision = (id: string) => {
    undoRecommendation(id);
    refreshAllData();
  };

  // Helper getters
  const selectedScorecard = scorecards.find(sc => sc.snapshotId === selectedSnapshotId);
  const selectedSnapshot = snapshots.find(s => s.id === selectedSnapshotId);

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header Panel */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <RefreshCw className="h-8 w-8 text-indigo-500 animate-spin-slow" />
            {t('analyticsFeedbackLoop.title')}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">
            {t('analyticsFeedbackLoop.description')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleClearHistory}
            className="inline-flex items-center justify-center rounded-md bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/30 border border-rose-200 dark:border-rose-900/30 px-4 py-2 text-sm font-semibold text-rose-600 dark:text-rose-400 transition"
          >{t('pages.analyticsFeedbackLoop.clearLoopHistory')}</button>
          <button
            type="button"
            onClick={handleTriggerIngestion}
            disabled={isIngesting}
            className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition"
          >
            {isIngesting ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />{t('pages.analyticsFeedbackLoop.ingesting')}</>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4 fill-current" />{t('pages.analyticsFeedbackLoop.syncPlatformsPerformance')}</>
            )}
          </button>
        </div>
      </div>

      {/* Real-time Status banner */}
      {statusMessage && (
        <div className="rounded-md bg-indigo-950/40 border border-indigo-800 p-4 animate-fade-in">
          <div className="flex">
            <div className="flex-shrink-0">
              <Sparkles className="h-5 w-5 text-indigo-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-indigo-200">{statusMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Advisory Learning Stats Block (Bento Style) */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="overflow-hidden rounded-lg bg-card border border-border p-5">
          <div className="flex items-center">
            <div className="rounded-md bg-indigo-500/10 p-3">
              <Activity className="h-6 w-6 text-indigo-500" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground truncate">{t('pages.analyticsFeedbackLoop.totalSnapshotsIngested')}</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{snapshots.length}</p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg bg-card border border-border p-5">
          <div className="flex items-center">
            <div className="rounded-md bg-amber-500/10 p-3">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground truncate">{t('pages.analyticsFeedbackLoop.activeInsights')}</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {insights.filter(i => i.status === 'new').length}
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg bg-card border border-border p-5">
          <div className="flex items-center">
            <div className="rounded-md bg-emerald-500/10 p-3">
              <CheckCircle className="h-6 w-6 text-emerald-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground truncate">{t('pages.analyticsFeedbackLoop.recommendationsApplied')}</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {recommendations.filter(r => r.status === 'applied').length}
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg bg-card border border-border p-5">
          <div className="flex items-center">
            <div className="rounded-md bg-blue-500/10 p-3">
              <TrendingUp className="h-6 w-6 text-blue-400" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground truncate">{t('pages.analyticsFeedbackLoop.calibrationGapsAvg')}</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">
                {calibrations.length > 0 
                  ? t('pages.analyticsFeedbackLoop.ptsValue', { count: (calibrations.reduce((sum, c) => sum + Math.abs(c.predictionGap), 0) / calibrations.length).toFixed(1) })
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabbed Workflow Controls */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-8" aria-label={t('pages.analyticsFeedbackLoop.tabs')}>
          {[
            { id: 'insights', label: t('pages.analyticsFeedbackLoop.activeInsights'), count: insights.length },
            { id: 'recommendations', label: t('pages.analyticsFeedbackLoop.advisoryRecommendations'), count: recommendations.filter(r => r.status === 'proposed' || r.status === 'accepted').length },
            { id: 'snapshots', label: t('pages.analyticsFeedbackLoop.normalizedSnapshots'), count: snapshots.length },
            { id: 'decisions', label: t('pages.analyticsFeedbackLoop.appliedChanges'), count: decisions.length },
            { id: 'calibrations', label: t('pages.analyticsFeedbackLoop.viralCalibrationGaps'), count: calibrations.length },
            { id: 'learning', label: t('pages.analyticsFeedbackLoop.aiDirectorLearningContext'), count: null },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
              }`}
            >
              {tab.label}
              {tab.count !== null && (
                <span className={`rounded-full px-2 py-0.5 text-xs ${
                  activeTab === tab.id ? 'bg-indigo-500/10 text-indigo-300' : 'bg-muted text-muted-foreground'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content Areas */}
      <div className="space-y-6">

        {/* 1. PERFORMANCE INSIGHTS */}
        {activeTab === 'insights' && (
          <div className="space-y-4">
            {insights.length === 0 ? (
              <div className="text-center py-12 rounded-lg border border-dashed border-border bg-card">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold text-foreground">{t('pages.analyticsFeedbackLoop.noPerformanceInsightsYet')}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t('pages.analyticsFeedbackLoop.clickSyncDescription')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {insights.map((insight) => (
                  <div key={insight.id} className="rounded-lg bg-card border border-border p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium uppercase ${
                          insight.severity === 'high' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {insight.severity === 'high' ? t('pages.analyticsFeedbackLoop.highSeverity') : t('pages.analyticsFeedbackLoop.mediumSeverity')}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {translateInsightCategory(insight.category)}
                        </span>
                      </div>

                      <h3 className="mt-3 text-lg font-semibold text-foreground">{insight.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{insight.summary}</p>

                      {/* Evidence block */}
                      <div className="mt-4 rounded-md bg-muted p-3 text-xs font-mono flex items-center justify-between">
                        <div>
                          <p className="text-muted-foreground uppercase tracking-wider text-[10px]">{t('pages.analyticsFeedbackLoop.metricEvidence')}</p>
                          <p className="text-foreground mt-0.5">{insight.evidence.description}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-foreground font-bold">{t('pages.analyticsFeedbackLoop.observedLabel')}: {typeof insight.evidence.value === 'number' ? (insight.evidence.value * 100).toFixed(2) + '%' : insight.evidence.value}</p>
                          {insight.evidence.baseline && (
                            <p className="text-muted-foreground text-[10px]">{t('pages.analyticsFeedbackLoop.baselineLabel')}: {typeof insight.evidence.baseline === 'number' ? (insight.evidence.baseline * 100).toFixed(2) + '%' : insight.evidence.baseline}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">{t('pages.analyticsFeedbackLoop.status')}<span className="font-semibold text-foreground uppercase">{translateStatus(insight.status)}</span>
                      </div>
                      <div className="flex gap-2">
                        {insight.status === 'new' && (
                          <>
                            <button
                              onClick={() => handleReviewInsight(insight.id)}
                              className="rounded px-2 py-1 text-xs font-medium bg-muted text-foreground hover:bg-border transition"
                            >{t('pages.analyticsFeedbackLoop.markReviewed')}</button>
                            <button
                              onClick={() => handleAcceptInsight(insight.id)}
                              className="rounded px-2 py-1 text-xs font-medium bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition"
                            >{t('pages.analyticsFeedbackLoop.accept')}</button>
                            <button
                              onClick={() => handleDismissInsight(insight.id)}
                              className="rounded px-2 py-1 text-xs font-medium bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition"
                            >{t('pages.analyticsFeedbackLoop.dismiss')}</button>
                          </>
                        )}
                        {insight.status === 'reviewed' && (
                          <button
                            onClick={() => handleAcceptInsight(insight.id)}
                            className="rounded px-2 py-1 text-xs font-medium bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition"
                          >{t('pages.analyticsFeedbackLoop.accept')}</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2. ADVISORY RECOMMENDATIONS */}
        {activeTab === 'recommendations' && (
          <div className="space-y-4">
            {recommendations.length === 0 ? (
              <div className="text-center py-12 rounded-lg border border-dashed border-border bg-card">
                <Sparkles className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold text-foreground">{t('pages.analyticsFeedbackLoop.noRecommendationsYet')}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t('pages.analyticsFeedbackLoop.appliedChangesAutomaticallyRecordContext')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recommendations.map((rec) => (
                  <div key={rec.id} className="rounded-lg bg-card border border-border p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="inline-flex items-center rounded bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-300 font-mono uppercase">
                            {translateAnalyticsRecommendationType(rec.recommendationType)}
                          </span>
                          <span className="text-xs text-muted-foreground">{t('pages.analyticsFeedbackLoop.confidence')}<span className="font-semibold text-foreground">{(rec.confidence * 100).toFixed(0)}%</span>
                          </span>
                        </div>
                        <h4 className="mt-3 text-lg font-semibold text-foreground">{rec.proposedChange}</h4>
                        <p className="mt-1.5 text-sm text-muted-foreground">{t('pages.analyticsFeedbackLoop.expectedEffectLabel')}: {rec.expectedEffect}</p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          rec.status === 'proposed' ? 'bg-blue-500/10 text-blue-400' :
                          rec.status === 'accepted' ? 'bg-amber-500/10 text-amber-400' :
                          rec.status === 'applied' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-muted text-muted-foreground'
                        }`}>
                          {translateStatus(rec.status)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/50 p-3 rounded-md text-xs font-mono">
                      <div>
                        <span className="text-muted-foreground uppercase text-[10px]">{t('pages.analyticsFeedbackLoop.associatedEvidence')}</span>
                        <p className="text-foreground mt-0.5">{rec.evidence.join(', ')}</p>
                      </div>
                      <div>
                        <span className="text-rose-400 uppercase text-[10px]">{t('pages.analyticsFeedbackLoop.risksLimitations')}</span>
                        <p className="text-foreground mt-0.5">{rec.risk}</p>
                      </div>
                    </div>

                    <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">{t('pages.analyticsFeedbackLoop.targets')}<span className="font-semibold font-mono text-foreground">{JSON.stringify(rec.targetEntities)}</span>
                      </div>
                      <div className="flex gap-2">
                        {rec.status === 'proposed' && (
                          <>
                            <button
                              onClick={() => handleAcceptRec(rec.id)}
                              className="inline-flex items-center rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500"
                            >
                              <ThumbsUp className="h-3 w-3 mr-1" />{t('pages.analyticsFeedbackLoop.acceptRecommendation')}</button>
                            <button
                              onClick={() => handleRejectRec(rec.id)}
                              className="inline-flex items-center rounded bg-muted px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-border"
                            >
                              <ThumbsDown className="h-3 w-3 mr-1" />{t('pages.analyticsFeedbackLoop.reject')}</button>
                          </>
                        )}
                        {rec.status === 'accepted' && (
                          <button
                            onClick={() => handleApplyRec(rec.id)}
                            className="inline-flex items-center rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500"
                          >
                            <Sparkles className="h-3.5 w-3.5 mr-1" />{t('pages.analyticsFeedbackLoop.applyChangesCreateNewVersion')}</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. NORMALIZED SNAPSHOTS & SCORECARDS */}
        {activeTab === 'snapshots' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Snapshots list */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-lg font-semibold text-foreground">{t('pages.analyticsFeedbackLoop.normalizedIngestedSnapshots')}</h3>
              {snapshots.length === 0 ? (
                <div className="text-center py-12 rounded-lg border border-dashed border-border bg-card">
                  <BarChart className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-1 text-sm text-muted-foreground">{t('pages.analyticsFeedbackLoop.noSnapshotsNormalizedYet')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-border bg-card">
                  <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">{t('pages.analyticsFeedbackLoop.platform')}</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">{t('pages.analyticsFeedbackLoop.window')}</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">{t('pages.analyticsFeedbackLoop.impressions')}</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">{t('pages.analyticsFeedbackLoop.clicks')}</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">{t('pages.analyticsFeedbackLoop.purchases')}</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">{t('pages.analyticsFeedbackLoop.roas')}</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">{t('pages.analyticsFeedbackLoop.scorecard')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {snapshots.map((snap) => {
                        const isSelected = selectedSnapshotId === snap.id;
                        const sc = scorecards.find(s => s.snapshotId === snap.id);
                        return (
                          <tr 
                            key={snap.id} 
                            onClick={() => setSelectedSnapshotId(snap.id)}
                            className={`cursor-pointer hover:bg-muted/30 transition ${isSelected ? 'bg-indigo-500/5' : ''}`}
                          >
                            <td className="px-4 py-3 text-sm font-medium text-foreground capitalize">{translatePlatform(snap.platform)}</td>
                            <td className="px-4 py-3 text-sm text-muted-foreground capitalize">{translateEnumLabel(snap.metricWindow)}</td>
                            <td className="px-4 py-3 text-sm text-right font-mono text-foreground">{snap.impressions !== undefined && snap.impressions !== null ? formatNumber(snap.impressions) : 0}</td>
                            <td className="px-4 py-3 text-sm text-right font-mono text-foreground">{snap.clicks !== undefined && snap.clicks !== null ? formatNumber(snap.clicks) : 0}</td>
                            <td className="px-4 py-3 text-sm text-right font-mono text-foreground">{snap.purchases !== undefined && snap.purchases !== null ? formatNumber(snap.purchases) : 0}</td>
                            <td className="px-4 py-3 text-sm text-right font-mono font-bold text-emerald-400">{snap.roas ? t('pages.analyticsFeedbackLoop.roasX', { count: snap.roas }) : t('pages.analyticsFeedbackLoop.roasZero')}</td>
                            <td className="px-4 py-3 text-center">
                              {sc ? (
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                  sc.overallScore >= 75 ? 'bg-emerald-500/10 text-emerald-400' :
                                  sc.overallScore >= 45 ? 'bg-amber-500/10 text-amber-400' : 'bg-rose-500/10 text-rose-400'
                                }`}>
                                  {sc.overallScore} / 100
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">{t('pages.analyticsFeedbackLoop.none')}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Scorecard panel */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-foreground">{t('pages.analyticsFeedbackLoop.snapshotScorecardAnalysis')}</h3>
              {selectedSnapshotId ? (
                selectedScorecard ? (
                  <div className="rounded-lg bg-card border border-border p-5 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-border">
                      <div>
                        <p className="text-xs text-muted-foreground font-mono">{t('pages.analyticsFeedbackLoop.idLabel')}: {selectedSnapshotId.slice(0, 12)}...</p>
                        <h4 className="text-sm font-bold text-foreground">{t('pages.analyticsFeedbackLoop.overallPerformance')}</h4>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black text-indigo-400">{selectedScorecard.overallScore}</span>
                        <span className="text-xs text-muted-foreground">/100</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {selectedScorecard.dimensions.map((dim, i) => (
                        <div key={i} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-foreground">{dim.dimension}</span>
                            <span className="font-mono text-muted-foreground">{dim.value} / 100</span>
                          </div>
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                dim.value >= 75 ? 'bg-emerald-500' :
                                dim.value >= 45 ? 'bg-amber-500' : 'bg-rose-500'
                              }`} 
                              style={{ width: `${dim.value}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 italic">{dim.explanation}</p>
                        </div>
                      ))}
                    </div>

                    <div className="pt-4 border-t border-border space-y-2 text-xs">
                      <p className="text-muted-foreground font-semibold">{t('pages.analyticsFeedbackLoop.metadataAttributionLineage')}</p>
                      {selectedSnapshot && (
                        <ul className="space-y-1 font-mono text-[11px] text-foreground">
                          <li>{t('pages.analyticsFeedbackLoop.campaignLabel')}: {selectedSnapshot.campaignId || t('pages.analyticsFeedbackLoop.unassigned')}</li>
                          <li>{t('pages.analyticsFeedbackLoop.assetLabel')}: {selectedSnapshot.creativeLibraryAssetId || t('pages.analyticsFeedbackLoop.unassigned')}</li>
                          <li>{t('pages.analyticsFeedbackLoop.promptVersionLabel')}: {selectedSnapshot.promptHistoryId || t('pages.analyticsFeedbackLoop.unassigned')}</li>
                          <li>{t('pages.analyticsFeedbackLoop.digitalHumanLabel')}: {selectedSnapshot.digitalHumanId || t('pages.analyticsFeedbackLoop.unassigned')}</li>
                        </ul>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg bg-card border border-border p-5 text-center py-12 text-sm text-muted-foreground">{t('pages.analyticsFeedbackLoop.noScorecardGeneratedForThisSnapshot')}</div>
                )
              ) : (
                <div className="rounded-lg bg-card border border-border p-5 text-center py-12 text-sm text-muted-foreground">{t('pages.analyticsFeedbackLoop.selectASnapshotOnTheLeftToViewItsComplet')}</div>
              )}
            </div>
          </div>
        )}

        {/* 4. FEEDBACK DECISIONS LOG */}
        {activeTab === 'decisions' && (
          <div className="space-y-4">
            {decisions.length === 0 ? (
              <div className="text-center py-12 rounded-lg border border-dashed border-border bg-card">
                <RotateCcw className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-sm font-semibold text-foreground">{t('pages.analyticsFeedbackLoop.noExecutedDecisionsYet')}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t('pages.analyticsFeedbackLoop.whenYouApplyAnAcceptedRecommendationItLo')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {decisions.map((dec) => (
                  <div key={dec.id} className="rounded-lg bg-card border border-border p-4 flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-emerald-400 capitalize">{t('pages.analyticsFeedbackLoop.appliedChanges')}</span>
                        <span className="text-muted-foreground">â€¢</span>
                        <span className="text-muted-foreground font-mono">{formatDateTime(dec.createdAt)}</span>
                      </div>
                      <p className="text-sm text-foreground font-semibold">{dec.rationale}</p>
                      <div className="text-xs text-muted-foreground font-mono">
                        {t('pages.analyticsFeedbackLoop.targetLabel')}: {dec.targetEntityType} ({dec.targetEntityId}) | {t('pages.analyticsFeedbackLoop.decidedByLabel')}: {dec.user}
                      </div>
                    </div>
                    <button
                      onClick={() => handleUndoDecision(dec.id)}
                      className="inline-flex items-center rounded bg-rose-500/10 hover:bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-400 transition"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />{t('pages.analyticsFeedbackLoop.undoDecision')}</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 5. VIRAL SCORE CALIBRATION */}
        {activeTab === 'calibrations' && (
          <div className="space-y-4">
            {calibrations.length === 0 ? (
              <div className="text-center py-12 rounded-lg border border-dashed border-border bg-card">
                <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-1 text-sm text-muted-foreground">{t('pages.analyticsFeedbackLoop.noViralScorePredictionCalibrationsRecord')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-card p-5">
                  <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider">{t('pages.analyticsFeedbackLoop.calibrationAccuracyDistribution')}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{t('pages.analyticsFeedbackLoop.comparesViralPreproductionForecastsWithA')}</p>
                  
                  <div className="mt-5 space-y-4">
                    {calibrations.map((cal) => {
                      const isOver = cal.predictedScore > cal.observedScore;
                      return (
                        <div key={cal.id} className="rounded border border-border bg-muted/30 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs font-mono">
                          <div>
                            <span className="font-bold text-foreground">{t('pages.analyticsFeedbackLoop.predictionReferenceLabel')}: {cal.predictionId.slice(0, 15)}...</span>
                            <div className="text-muted-foreground mt-0.5">{t('pages.analyticsFeedbackLoop.platformLabel')}: {translatePlatform(cal.platform)} | {t('pages.analyticsFeedbackLoop.sampleLabel')}: {formatNumber(cal.sampleSize)} {t('pages.analyticsFeedbackLoop.impressions')}</div>
                          </div>
                          
                          <div className="flex items-center gap-6 mt-3 sm:mt-0">
                            <div className="text-right">
                              <p className="text-muted-foreground uppercase text-[9px]">{t('pages.analyticsFeedbackLoop.predictedObserved')}</p>
                              <p className="text-foreground font-bold">{cal.predictedScore} / {cal.observedScore}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-muted-foreground uppercase text-[9px]">{t('pages.analyticsFeedbackLoop.varianceGap')}</p>
                              <p className={`font-bold ${isOver ? 'text-amber-400' : 'text-blue-400'}`}>
                                {isOver ? `+${cal.predictionGap.toFixed(1)} (${t('pages.analyticsFeedbackLoop.over')})` : `${cal.predictionGap.toFixed(1)} (${t('pages.analyticsFeedbackLoop.under')})`}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 6. AI DIRECTOR LEARNING CONTEXT */}
        {activeTab === 'learning' && (
          <div className="space-y-6">
            {learningContext ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Decisions context */}
                <div className="rounded-lg border border-border bg-card p-5 space-y-4">
                  <h4 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-emerald-400" />{t('pages.analyticsFeedbackLoop.decisionHistoryLineage')}</h4>
                  <p className="text-xs text-muted-foreground">{t('pages.analyticsFeedbackLoop.historicalRecordsTrackAcceptedAndRejecte')}</p>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{t('pages.analyticsFeedbackLoop.acceptedRecommendationsCount')}</span>
                      <span className="font-bold font-mono text-foreground">{learningContext.acceptedRecommendationIds.length}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{t('pages.analyticsFeedbackLoop.rejectedRecommendationsCount')}</span>
                      <span className="font-bold font-mono text-foreground">{learningContext.rejectedRecommendationIds.length}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{t('pages.analyticsFeedbackLoop.authoritativeBrandRulesOverride')}</span>
                      <span className="font-bold text-emerald-400">{t('pages.analyticsFeedbackLoop.activeAuthoritativeOverPredictions')}</span>
                    </div>
                  </div>
                </div>

                {/* Advisory patterns */}
                <div className="rounded-lg border border-border bg-card p-5 space-y-4">
                  <h4 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-indigo-400" />{t('pages.analyticsFeedbackLoop.advisoryHighperformingPatterns')}</h4>
                  <p className="text-xs text-muted-foreground">{t('pages.analyticsFeedbackLoop.detectedPatternsUsedToPreemptivelyScoreP')}</p>
                  
                  <div className="space-y-3">
                    {learningContext.highPerformingPatterns.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border rounded">{t('pages.analyticsFeedbackLoop.noLearningPatternsCapturedYetApplyHighco')}</p>
                    ) : (
                      learningContext.highPerformingPatterns.map((pat, i) => (
                        <div key={i} className="rounded bg-muted/40 p-2.5 text-xs flex justify-between items-center">
                          <span className="text-foreground truncate max-w-[200px]">{pat.pattern}</span>
                          <span className="text-emerald-400 font-mono font-bold">{t('pages.analyticsFeedbackLoop.scoreLabel')}: {pat.score} ({Math.round(pat.confidence * 100)}% {t('pages.analyticsFeedbackLoop.confLabel')})</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            ) : (
              <div className="rounded-lg border border-border bg-card p-5 text-center text-sm text-muted-foreground">{t('pages.analyticsFeedbackLoop.learningContextEmptyRunSnapPerformanceTe')}</div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

export default AnalyticsFeedbackLoopPage;
