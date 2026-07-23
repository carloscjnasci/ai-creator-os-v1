import { useTranslation } from '@/features/i18n/useTranslation';
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  RefreshCw,
  Megaphone,
  Users,
  Package,
  Shirt,
  Film,
  PersonStanding,
  Cpu,
  Clock,
  Info,
  Activity,
  BarChart3,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

import { AppButton } from '@/components/ui/AppButton';
import {
  AppCard,
  AppCardHeader,
  AppCardTitle,
  AppCardDescription,
  AppCardContent,
} from '@/components/ui/AppCard';
import { AppSelect } from '@/components/ui/AppSelect';

import type {
  AnalyticsActivitySource,
  AnalyticsDateRange,
  AnalyticsDistributionItem,
  AnalyticsSnapshot,
} from '../types';

import {
  buildAnalyticsSnapshot,
  isAnalyticsDateRange,
} from '../analyticsCalculator';

// Canonical types
import type { Campaign } from '@/features/campaigns/types';
import type { Character } from '@/features/characters/types';
import type { Product } from '@/features/products/types';
import type { WardrobeItem } from '@/features/wardrobe/types';
import type { Scene } from '@/features/scenes/types';
import type { Pose } from '@/features/poses/types';
import type { PromptHistoryEntry } from '@/features/prompt-engine/types';

// Storage loaders and canonical keys
import { loadCampaignsFromStorage, CAMPAIGN_STORAGE_KEY } from '@/features/campaigns/lib/campaignStorage';
import { loadCharactersFromStorage, CHARACTER_STORAGE_KEY } from '@/features/characters/lib/characterStorage';
import { loadProductsFromStorage, PRODUCT_STORAGE_KEY } from '@/features/products/lib/productStorage';
import { loadWardrobeItemsFromStorage, WARDROBE_STORAGE_KEY } from '@/features/wardrobe/wardrobeStorage';
import { loadScenesFromStorage, SCENE_STORAGE_KEY } from '@/features/scenes/sceneStorage';
import { loadPosesFromStorage, POSE_STORAGE_KEY } from '@/features/poses/poseStorage';
import { loadPromptHistoryFromStorage, PROMPT_HISTORY_STORAGE_KEY } from '@/features/prompt-engine/promptHistoryStorage';
import { loadSettingsFromStorage } from '../../settings/settingsStorage';

type AnalyticsSynchronizationStatus =
  | 'idle'
  | 'synchronized'
  | 'refreshed'
  | 'error';

// Map activity sources to Lucide icons
const sourceIconMap: Record<AnalyticsActivitySource, LucideIcon> = {
  campaign: Megaphone,
  character: Users,
  product: Package,
  wardrobe: Shirt,
  scene: Film,
  pose: PersonStanding,
  prompt: Cpu,
};

// Map activity sources to class styles
const sourceColorMap: Record<AnalyticsActivitySource, string> = {
  campaign: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900',
  character: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900',
  product: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 border-amber-100 dark:border-amber-900',
  wardrobe: 'bg-pink-50 text-pink-600 dark:bg-pink-950/50 dark:text-pink-400 border-pink-100 dark:border-pink-900',
  scene: 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400 border-sky-100 dark:border-sky-900',
  pose: 'bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400 border-purple-100 dark:border-purple-900',
  prompt: 'bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400 border-teal-100 dark:border-teal-900',
};

// Centralized formatDateTime from useTranslation is used inside the component instead.

function hasDistributionData(items: AnalyticsDistributionItem[]): boolean {
  return items.some((item) => item.count > 0);
}

function calculatePercentage(count: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.round((count / total) * 100);
}

// Reusable internal component for distribution list
interface DistributionListProps {
  title: string;
  description: string;
  items: AnalyticsDistributionItem[];
  emptyMessage: string;
}

const DistributionList: React.FC<DistributionListProps> = ({
  title,
  description,
  items,
  emptyMessage,
}) => {
  const { t } = useTranslation();
  const hasData = hasDistributionData(items);

  return (
    <AppCard>
      <AppCardHeader>
        <AppCardTitle className="text-base font-semibold">{title}</AppCardTitle>
        <AppCardDescription className="text-xs">{description}</AppCardDescription>
      </AppCardHeader>
      <AppCardContent className="space-y-4">
        {hasData ? (
          <div className="space-y-3" role="group" aria-label={t('pages.analytics.breakdownLabel', { title })}>
            {items.map((item) => (
              <div key={item.key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{item.label}</span>
                  <span className="text-gray-500 dark:text-gray-400 font-mono">
                    {item.count} {item.count === 1 ? t('pages.analytics.record') : t('pages.analytics.records')} · {item.percentage}%
                  </span>
                </div>
                <div
                  className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden"
                  aria-hidden="true"
                >
                  <div
                    className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, item.percentage))}%` }}
                  />
                </div>
                <span className="sr-only">
                  {t('pages.analytics.srOnlyMetric', { label: item.label, count: item.count, percentage: item.percentage })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Info className="h-8 w-8 text-gray-400 dark:text-gray-500 mb-2" aria-hidden="true" />
            <p className="text-xs text-gray-500 dark:text-gray-400">{emptyMessage}</p>
          </div>
        )}
      </AppCardContent>
    </AppCard>
  );
};

export function AnalyticsPage() {
  const { t, formatDateTime } = useTranslation();
  const getRangeLabel = (range: AnalyticsDateRange) => {
    switch (range) {
      case '7-days': return t('pages.settings.last7Days');
      case '30-days': return t('pages.settings.last30Days');
      case '90-days': return t('pages.settings.last90Days');
      case 'all-time': return t('pages.settings.allTime');
    }
  };
  const formatRecentActivityDate = (value: string): string => {
    return formatDateTime(value);
  };
  const [selectedRange, setSelectedRange] = useState<AnalyticsDateRange>(() => {
    const settings = loadSettingsFromStorage();
    if (isAnalyticsDateRange(settings.analyticsDefaultRange)) {
      return settings.analyticsDefaultRange;
    }
    return '30-days';
  });
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [poses, setPoses] = useState<Pose[]>([]);
  const [promptHistory, setPromptHistory] = useState<PromptHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<AnalyticsSynchronizationStatus>('idle');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Safe page-level helper function to load all sources from storage
  const loadAllAnalyticsSources = (): boolean => {
    try {
      setCampaigns(loadCampaignsFromStorage());
      setCharacters(loadCharactersFromStorage());
      setProducts(loadProductsFromStorage());
      setWardrobeItems(loadWardrobeItemsFromStorage());
      setScenes(loadScenesFromStorage());
      setPoses(loadPosesFromStorage());
      setPromptHistory(loadPromptHistoryFromStorage());
      return true;
    } catch (err) {
      console.error('Error loading analytics sources:', err);
      setSyncStatus('error');
      setSyncMessage(t('pages.analytics.refreshError'));
      return false;
    }
  };

  useEffect(() => {
    const success = loadAllAnalyticsSources();
    if (success) {
      setSyncStatus('idle');
    }
    setLoading(false);

    function handleStorageEvent(event: StorageEvent) {
      if (event.storageArea !== window.localStorage) {
        return;
      }
      
      const key = event.key;
      
      if (key === null) {
        try {
          loadAllAnalyticsSources();
          setSyncStatus('refreshed');
          setSyncMessage(t('pages.analytics.refreshedAfterStorageChange'));
        } catch (err) {
          console.error('Error on null key storage refresh:', err);
          setSyncStatus('error');
          setSyncMessage(t('pages.analytics.refreshError'));
        }
        return;
      }

      try {
        switch (key) {
          case CAMPAIGN_STORAGE_KEY:
            setCampaigns(loadCampaignsFromStorage());
            setSyncStatus('synchronized');
            setSyncMessage(t('pages.analytics.campaignUpdatedAnotherTab'));
            break;

          case CHARACTER_STORAGE_KEY:
            setCharacters(loadCharactersFromStorage());
            setSyncStatus('synchronized');
            setSyncMessage(t('pages.analytics.characterUpdatedAnotherTab'));
            break;

          case PRODUCT_STORAGE_KEY:
            setProducts(loadProductsFromStorage());
            setSyncStatus('synchronized');
            setSyncMessage(t('pages.analytics.productUpdatedAnotherTab'));
            break;

          case WARDROBE_STORAGE_KEY:
            setWardrobeItems(loadWardrobeItemsFromStorage());
            setSyncStatus('synchronized');
            setSyncMessage(t('pages.analytics.wardrobeUpdatedAnotherTab'));
            break;

          case SCENE_STORAGE_KEY:
            setScenes(loadScenesFromStorage());
            setSyncStatus('synchronized');
            setSyncMessage(t('pages.analytics.sceneUpdatedAnotherTab'));
            break;

          case POSE_STORAGE_KEY:
            setPoses(loadPosesFromStorage());
            setSyncStatus('synchronized');
            setSyncMessage(t('pages.analytics.poseUpdatedAnotherTab'));
            break;

          case PROMPT_HISTORY_STORAGE_KEY:
            setPromptHistory(loadPromptHistoryFromStorage());
            setSyncStatus('synchronized');
            setSyncMessage(t('pages.analytics.promptUpdatedAnotherTab'));
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('Error loading specific storage key on event:', err);
        setSyncStatus('error');
        setSyncMessage(t('pages.analytics.refreshError'));
      }
    }

    window.addEventListener('storage', handleStorageEvent);
    return () => {
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, []);

  const handleRefresh = () => {
    const success = loadAllAnalyticsSources();
    if (success) {
      setSyncStatus('refreshed');
      setSyncMessage(t('pages.analytics.refreshedFromBrowser'));
    }
  };

  // Build Snapshot with Part 1 Calculator
  const analyticsSnapshot = useMemo<AnalyticsSnapshot>(() => {
    return buildAnalyticsSnapshot(
      {
        campaigns,
        characters,
        products,
        wardrobeItems,
        scenes,
        poses,
        promptHistory,
      },
      {
        range: selectedRange,
        recentActivityLimit: 10,
      }
    );
  }, [
    campaigns,
    characters,
    products,
    wardrobeItems,
    scenes,
    poses,
    promptHistory,
    selectedRange,
  ]);

  // Handle Range Selector change safely
  const handleRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (isAnalyticsDateRange(val)) {
      setSelectedRange(val);
    }
  };

  // Safe maximum calculation for daily activity timeline
  const maximumDailyActivity = useMemo(() => {
    return Math.max(
      0,
      ...analyticsSnapshot.dailyActivity.map((point) => point.total)
    );
  }, [analyticsSnapshot.dailyActivity]);

  // Aggregate activity breakdown of sources from timeline points
  const aggregatedBreakdown = useMemo(() => {
    return analyticsSnapshot.dailyActivity.reduce(
      (acc, point) => {
        acc.campaigns += point.campaigns;
        acc.characters += point.characters;
        acc.products += point.products;
        acc.wardrobeItems += point.wardrobeItems;
        acc.scenes += point.scenes;
        acc.poses += point.poses;
        acc.prompts += point.prompts;
        return acc;
      },
      {
        campaigns: 0,
        characters: 0,
        products: 0,
        wardrobeItems: 0,
        scenes: 0,
        poses: 0,
        prompts: 0,
      }
    );
  }, [analyticsSnapshot.dailyActivity]);

  const displayedTimelineActivityTotal = useMemo(() => {
    return analyticsSnapshot.dailyActivity.reduce((sum, point) => sum + point.total, 0);
  }, [analyticsSnapshot.dailyActivity]);

  const isAllTimeTimelineTruncated = useMemo(() => {
    return (
      selectedRange === 'all-time' &&
      analyticsSnapshot.summary.activityInSelectedRange !== displayedTimelineActivityTotal
    );
  }, [selectedRange, analyticsSnapshot.summary.activityInSelectedRange, displayedTimelineActivityTotal]);

  // Check if everything in the database is completely empty
  const isGlobalWorkspaceEmpty = useMemo(() => {
    return (
      campaigns.length === 0 &&
      characters.length === 0 &&
      products.length === 0 &&
      wardrobeItems.length === 0 &&
      scenes.length === 0 &&
      poses.length === 0 &&
      promptHistory.length === 0
    );
  }, [
    campaigns,
    characters,
    products,
    wardrobeItems,
    scenes,
    poses,
    promptHistory,
  ]);

  // Render selective timeline x-axis labels to prevent crowding
  const shouldShowLabel = (index: number, total: number) => {
    if (total <= 7) return true;
    if (total <= 30) {
      return index === 0 || index === total - 1 || index % 5 === 0;
    }
    return index === 0 || index === total - 1 || index % 15 === 0;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6">
        <RefreshCw className="h-8 w-8 text-blue-500 animate-spin mb-4" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('pages.analytics.loadingLocalAnalytics')}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md">{t('pages.analytics.readingYourSavedAiCreatorOsRecordsFromTh')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Synchronization Status Banner / Alert */}
      {syncMessage && (
        <div
          id="analytics-sync-status-banner"
          aria-live="polite"
          className={`p-3 rounded-lg flex items-center justify-between border text-xs gap-3 transition-all ${
            syncStatus === 'synchronized'
              ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/30'
              : syncStatus === 'refreshed'
              ? 'bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-900/30'
              : syncStatus === 'error'
              ? 'bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-900/30'
              : 'bg-gray-50 dark:bg-gray-950/20 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-900/30'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  syncStatus === 'synchronized'
                    ? 'bg-emerald-400'
                    : syncStatus === 'refreshed'
                    ? 'bg-blue-400'
                    : syncStatus === 'error'
                    ? 'bg-red-400'
                    : 'bg-gray-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  syncStatus === 'synchronized'
                    ? 'bg-emerald-500'
                    : syncStatus === 'refreshed'
                    ? 'bg-blue-500'
                    : syncStatus === 'error'
                    ? 'bg-red-500'
                    : 'bg-gray-500'
                }`}
              />
            </span>
            <span className="font-medium">{syncMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSyncMessage(null);
              setSyncStatus('idle');
            }}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-blue-500 p-1 rounded"
            aria-label={t('pages.analytics.dismissMessage')}
          >
            <span className="text-sm font-bold">×</span>
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-border pb-5 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-600 dark:text-blue-500" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-500">{t('pages.analytics.performanceOverview')}</span>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight">
            {t('analytics.title')}
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            {t('analytics.description')}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 italic">{t('pages.analytics.analyticsAreCalculatedLocallyFromRecords')}</p>
        </div>

        {/* Top Controls */}
        <div className="flex flex-wrap items-end gap-3 sm:self-end md:self-auto">
          <div className="w-40">
            <AppSelect
              id="analytics-range-selector"
              label={t('pages.analytics.activityRange')}
              value={selectedRange}
              onChange={handleRangeChange}
              options={[
                { value: '7-days', label: getRangeLabel('7-days') },
                { value: '30-days', label: getRangeLabel('30-days') },
                { value: '90-days', label: getRangeLabel('90-days') },
                { value: 'all-time', label: getRangeLabel('all-time') },
              ]}
            />
          </div>
          <AppButton
            onClick={handleRefresh}
            variant="outline"
            className="flex items-center gap-2"
            title={t('pages.analytics.reloadMetricsFromLocalStorage')}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <span>{t('pages.analytics.refreshLocalData')}</span>
          </AppButton>
        </div>
      </div>

      {/* Global Empty State Announcer Card */}
      {isGlobalWorkspaceEmpty && (
        <AppCard className="border-dashed border-2 border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20">
          <AppCardContent className="flex flex-col items-center justify-center p-8 text-center">
            <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center mb-4">
              <Sparkles className="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            </div>
            <AppCardTitle className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('pages.analytics.noAnalyticsDataYet')}</AppCardTitle>
            <AppCardDescription className="max-w-md mx-auto mt-2 text-sm text-gray-500 dark:text-gray-400">{t('pages.analytics.createCampaignsReusableLibraryItemsOrLoc')}</AppCardDescription>
            <div className="flex flex-wrap gap-3 mt-6 justify-center">
              <Link to="/campaigns">
                <AppButton variant="primary" className="text-xs">{t('pages.analytics.createCampaign')}</AppButton>
              </Link>
              <Link to="/characters">
                <AppButton variant="outline" className="text-xs">{t('pages.analytics.addLibraryAsset')}</AppButton>
              </Link>
              <Link to="/prompt-engine">
                <AppButton variant="outline" className="text-xs">{t('pages.analytics.generatePrompt')}</AppButton>
              </Link>
            </div>
          </AppCardContent>
        </AppCard>
      )}

      {/* Summary Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Campaigns */}
        <AppCard className="relative overflow-hidden">
          <AppCardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('pages.analytics.campaigns')}</span>
              <Megaphone className="h-4 w-4 text-gray-400 dark:text-gray-500" aria-hidden="true" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {analyticsSnapshot.summary.totalCampaigns}
            </div>
          </AppCardHeader>
          <AppCardContent className="pt-0">
            <span className="text-[10px] text-gray-500 dark:text-gray-400">{t('pages.analytics.allLocallySavedCampaigns')}</span>
          </AppCardContent>
        </AppCard>

        {/* Active Campaigns */}
        <AppCard className="relative overflow-hidden">
          <AppCardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('pages.analytics.activeCampaigns')}</span>
              <Activity className="h-4 w-4 text-green-500" aria-hidden="true" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {analyticsSnapshot.summary.activeCampaigns}
            </div>
          </AppCardHeader>
          <AppCardContent className="pt-0">
            <span className="text-[10px] text-gray-500 dark:text-gray-400">{t('pages.analytics.campaignsCurrentlyMarkedActive')}</span>
          </AppCardContent>
        </AppCard>

        {/* Library Items */}
        <AppCard className="relative overflow-hidden">
          <AppCardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('pages.analytics.libraryItems')}</span>
              <Package className="h-4 w-4 text-gray-400 dark:text-gray-500" aria-hidden="true" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {analyticsSnapshot.summary.totalLibraryItems}
            </div>
          </AppCardHeader>
          <AppCardContent className="pt-0">
            <span className="text-[10px] text-gray-500 dark:text-gray-400">{t('pages.analytics.charactersProductsWardrobeScenesAndPoses')}</span>
          </AppCardContent>
        </AppCard>

        {/* Generated Prompts */}
        <AppCard className="relative overflow-hidden">
          <AppCardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('pages.analytics.generatedPrompts')}</span>
              <Cpu className="h-4 w-4 text-gray-400 dark:text-gray-500" aria-hidden="true" />
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {analyticsSnapshot.summary.totalPrompts}
            </div>
          </AppCardHeader>
          <AppCardContent className="pt-0">
            <span className="text-[10px] text-gray-500 dark:text-gray-400">{t('pages.analytics.promptsStoredInLocalHistory')}</span>
          </AppCardContent>
        </AppCard>

        {/* Activity in Range */}
        <AppCard className="relative overflow-hidden bg-blue-50/20 dark:bg-blue-950/10 border-blue-100 dark:border-blue-900/30">
          <AppCardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">{t('pages.analytics.activityInRange')}</span>
              <Calendar className="h-4 w-4 text-blue-500" aria-hidden="true" />
            </div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              {analyticsSnapshot.summary.activityInSelectedRange}
            </div>
          </AppCardHeader>
          <AppCardContent className="pt-0">
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              {t('pages.analytics.recordsCreatedDuring', { range: getRangeLabel(selectedRange) })}
            </span>
          </AppCardContent>
        </AppCard>
      </div>

      {/* Main Grid: Daily activity timeline and breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Activity Visualizer */}
        <div className="lg:col-span-2">
          <AppCard className="h-full flex flex-col">
            <AppCardHeader>
              <AppCardTitle>{t('pages.analytics.dailyActivity')}</AppCardTitle>
              <AppCardDescription>
                {t('pages.analytics.recordsCreatedDuringDot', { range: getRangeLabel(selectedRange) })}
              </AppCardDescription>
            </AppCardHeader>
            <AppCardContent className="flex-1 flex flex-col justify-between min-h-[300px]">
              {analyticsSnapshot.dailyActivity.length > 0 ? (
                <div className="flex flex-col justify-between flex-1 space-y-4">
                  {/* Timeline Chart Bars */}
                  <div
                    className="flex items-end h-48 w-full gap-1 border-b border-gray-200 dark:border-gray-800 pb-1 overflow-x-auto scrollbar-thin"
                    tabIndex={0}
                    role="region"
                    aria-label={t('pages.analytics.dailyActivityChartScrollContainer')}
                  >
                    {analyticsSnapshot.dailyActivity.map((point, index, arr) => {
                      const heightPercentage =
                        maximumDailyActivity > 0
                          ? (point.total / maximumDailyActivity) * 100
                          : 0;

                      return (
                        <div
                          key={point.date}
                          className="flex-1 flex flex-col items-center group relative min-w-[12px]"
                        >
                          {/* Tooltip on Hover */}
                          <div
                            className="absolute bottom-full mb-2 bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 text-[10px] rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-10 whitespace-nowrap shadow-md"
                            role="tooltip"
                            id={`tooltip-${point.date}`}
                          >
                            <span className="font-semibold">{point.label}</span>
                            <div className="font-mono mt-0.5">
                              {t('pages.analytics.tooltipTotal', { count: point.total })}
                              {point.total > 0 && (
                                <div className="text-[9px] text-gray-300 dark:text-gray-600 space-y-0.5 mt-1 border-t border-gray-700 dark:border-gray-300 pt-1">
                                  {point.campaigns > 0 && <div>{t('pages.analytics.tooltipCampaigns', { count: point.campaigns })}</div>}
                                  {point.characters > 0 && <div>{t('pages.analytics.tooltipCharacters', { count: point.characters })}</div>}
                                  {point.products > 0 && <div>{t('pages.analytics.tooltipProducts', { count: point.products })}</div>}
                                  {point.wardrobeItems > 0 && <div>{t('pages.analytics.tooltipWardrobe', { count: point.wardrobeItems })}</div>}
                                  {point.scenes > 0 && <div>{t('pages.analytics.tooltipScenes', { count: point.scenes })}</div>}
                                  {point.poses > 0 && <div>{t('pages.analytics.tooltipPoses', { count: point.poses })}</div>}
                                  {point.prompts > 0 && <div>{t('pages.analytics.tooltipPrompts', { count: point.prompts })}</div>}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Graphical Bar */}
                          <div
                            className="w-full bg-blue-500/20 dark:bg-blue-500/10 hover:bg-blue-500 dark:hover:bg-blue-400 group-hover:shadow-sm rounded-t transition-all duration-300 flex items-end overflow-hidden"
                            style={{ height: `${Math.max(4, heightPercentage)}%` }}
                            aria-describedby={`tooltip-${point.date}`}
                          >
                            {point.total > 0 && (
                              <div className="w-full bg-blue-600 dark:bg-blue-500 h-full transition-all duration-300" />
                            )}
                          </div>

                          {/* Accessible labels for screen readers */}
                          <span className="sr-only">
                            {t('pages.analytics.pointAccessibilityLabel', { date: point.date, total: point.total })}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Horizontal Axis Labels */}
                  <div className="flex justify-between text-[10px] text-muted-foreground font-mono px-1">
                    {analyticsSnapshot.dailyActivity.map((point, index, arr) => (
                      <div
                        key={point.date}
                        className={`flex-1 text-center ${
                          shouldShowLabel(index, arr.length) ? 'block' : 'hidden'
                        }`}
                      >
                        {point.label}
                      </div>
                    ))}
                  </div>

                  {/* Range Information Note */}
                  {maximumDailyActivity === 0 && (
                    <div className="text-center text-xs text-gray-500 dark:text-gray-400 mt-2 italic">{t('pages.analytics.noRecordsWereCreatedDuringThisRange')}</div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center flex-grow">
                  <Clock className="h-10 w-10 text-gray-400 dark:text-gray-500 mb-2" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('pages.analytics.noDatedActivity')}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mt-1">{t('pages.analytics.createCampaignsLibraryRecordsOrPromptsTo')}</p>
                </div>
              )}
            </AppCardContent>
          </AppCard>
        </div>

        {/* Range Source Breakdown Sidebar */}
        <div>
          <AppCard className="h-full flex flex-col">
            <AppCardHeader>
              <AppCardTitle>{t('pages.analytics.activityBreakdown')}</AppCardTitle>
              <AppCardDescription>
                {t('pages.analytics.distributionInside', { range: getRangeLabel(selectedRange) })}
              </AppCardDescription>
            </AppCardHeader>
            <AppCardContent className="flex-1 flex flex-col justify-between">
              <div>
                <div className="space-y-4" role="list" aria-label={t('pages.analytics.selectedRangeSourceComposition')}>
                  {[
                    { label: t('pages.analytics.campaignsLabel'), count: aggregatedBreakdown.campaigns, icon: Megaphone, color: 'text-indigo-500' },
                    { label: t('pages.analytics.charactersLabel'), count: aggregatedBreakdown.characters, icon: Users, color: 'text-emerald-500' },
                    { label: t('pages.analytics.productsLabel'), count: aggregatedBreakdown.products, icon: Package, color: 'text-amber-500' },
                    { label: t('pages.analytics.wardrobeLabel'), count: aggregatedBreakdown.wardrobeItems, icon: Shirt, color: 'text-pink-500' },
                    { label: t('pages.analytics.scenesLabel'), count: aggregatedBreakdown.scenes, icon: Film, color: 'text-sky-500' },
                    { label: t('pages.analytics.posesLabel'), count: aggregatedBreakdown.poses, icon: PersonStanding, color: 'text-purple-500' },
                    { label: t('pages.analytics.promptsLabel'), count: aggregatedBreakdown.prompts, icon: Cpu, color: 'text-teal-500' },
                  ].map((source, i) => {
                    const percentage = calculatePercentage(
                      source.count,
                      displayedTimelineActivityTotal
                    );

                    return (
                      <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-gray-50 dark:border-gray-800/50 last:border-0" role="listitem">
                        <div className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-300">
                           <source.icon className={`h-4 w-4 ${source.color}`} aria-hidden="true" />
                           <span>{source.label}</span>
                        </div>
                        <div className="text-right font-mono text-gray-500 dark:text-gray-400">
                          {source.count} ({percentage}%)
                        </div>
                      </div>
                    );
                  })}
                </div>

                {isAllTimeTimelineTruncated && (
                  <p className="mt-4 text-[11px] text-gray-500 dark:text-gray-400 italic leading-relaxed">
                    {t('pages.analytics.allTimeActivityDescription', {
                      total: analyticsSnapshot.summary.activityInSelectedRange,
                      displayed: displayedTimelineActivityTotal
                    })}
                  </p>
                )}
              </div>

              {/* Total Summary Footer */}
              <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {isAllTimeTimelineTruncated
                    ? t('pages.analytics.displayedTimelineActivity')
                    : t('pages.analytics.totalActivityCount')}
                </span>
                <span className="font-bold text-blue-600 dark:text-blue-400 font-mono text-sm">
                  {displayedTimelineActivityTotal}
                </span>
              </div>
            </AppCardContent>
          </AppCard>
        </div>
      </div>

      {/* Distributions Row 1: Campaigns & Reusable Library */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DistributionList
          title={t('pages.analytics.campaignStatus')}
          description={t('pages.analytics.howSavedCampaignsAreDistributedByWorkflo')}
          items={analyticsSnapshot.campaignStatusDistribution}
          emptyMessage={t('pages.analytics.noCampaignData')}
        />

        <DistributionList
          title={t('pages.analytics.creativeLibraryComposition')}
          description={t('pages.analytics.theBalanceOfReusableAssetsAcrossYourCrea')}
          items={analyticsSnapshot.libraryComposition}
          emptyMessage={t('pages.analytics.noLibraryRecords')}
        />
      </div>

      {/* Distributions Row 2: Prompt Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DistributionList
          title={t('pages.analytics.promptOutputTypes')}
          description={t('pages.analytics.theBalanceBetweenLocallyGeneratedVideoAn')}
          items={analyticsSnapshot.promptOutputDistribution}
          emptyMessage={t('pages.analytics.noPromptHistory')}
        />

        <DistributionList
          title={t('pages.analytics.promptPlatforms')}
          description={t('pages.analytics.whichTargetGeneratorsAreUsedInSavedPromp')}
          items={analyticsSnapshot.promptPlatformDistribution}
          emptyMessage={t('pages.analytics.noPromptHistory')}
        />

        <DistributionList
          title={t('pages.analytics.promptAspectRatios')}
          description={t('pages.analytics.theOutputFormatsSelectedAcrossSavedPromp')}
          items={analyticsSnapshot.promptAspectRatioDistribution}
          emptyMessage={t('pages.analytics.noPromptHistory')}
        />
      </div>

      {/* Compact Secondary Breakdown Table/Grid */}
      <AppCard>
        <AppCardHeader>
          <AppCardTitle className="text-base font-semibold">{t('pages.analytics.totalAssetRegistry')}</AppCardTitle>
          <AppCardDescription className="text-xs">{t('pages.analytics.globalSnapshotOfAllEntitiesStoredInTheLo')}</AppCardDescription>
        </AppCardHeader>
        <AppCardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
            {/* Campaigns summary details */}
            <div className="space-y-2 border-r border-border/50 pr-4 last:border-0">
              <h4 className="font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider text-[10px] text-gray-500">{t('pages.analytics.campaignWorkflows')}</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('pages.analytics.draftStatus')}</span>
                  <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{analyticsSnapshot.summary.draftCampaigns}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('pages.analytics.activeStatus')}</span>
                  <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{analyticsSnapshot.summary.activeCampaigns}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('pages.analytics.completedStatus')}</span>
                  <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{analyticsSnapshot.summary.completedCampaigns}</span>
                </div>
              </div>
            </div>

            {/* Prompt history summary details */}
            <div className="space-y-2 border-r border-border/50 pr-4 last:border-0">
              <h4 className="font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider text-[10px] text-gray-500">{t('pages.analytics.promptGenerators')}</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('pages.analytics.imageOutput')}</span>
                  <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{analyticsSnapshot.summary.imagePrompts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('pages.analytics.videoOutput')}</span>
                  <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{analyticsSnapshot.summary.videoPrompts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('pages.analytics.totalHistory')}</span>
                  <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{analyticsSnapshot.summary.totalPrompts}</span>
                </div>
              </div>
            </div>

            {/* Library summary details */}
            <div className="space-y-2">
              <h4 className="font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider text-[10px] text-gray-500">{t('pages.analytics.libraryComposition')}</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('pages.analytics.characters')}</span>
                  <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{analyticsSnapshot.summary.totalCharacters}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('pages.analytics.products')}</span>
                  <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{analyticsSnapshot.summary.totalProducts}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('pages.analytics.wardrobe')}</span>
                  <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{analyticsSnapshot.summary.totalWardrobeItems}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('pages.analytics.scenes')}</span>
                  <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{analyticsSnapshot.summary.totalScenes}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('pages.analytics.poses')}</span>
                  <span className="font-mono font-medium text-gray-900 dark:text-gray-100">{analyticsSnapshot.summary.totalPoses}</span>
                </div>
              </div>
            </div>
          </div>
        </AppCardContent>
      </AppCard>

      {/* Recent Activity Timeline List */}
      <AppCard>
        <AppCardHeader>
          <AppCardTitle>{t('pages.analytics.recentActivity')}</AppCardTitle>
          <AppCardDescription>
            {t('pages.analytics.newestRecordsCreated', { range: getRangeLabel(selectedRange) })}
          </AppCardDescription>
        </AppCardHeader>
        <AppCardContent>
          {analyticsSnapshot.recentActivity.length > 0 ? (
            <div className="divide-y divide-border/50 space-y-1" role="feed" aria-label={t('pages.analytics.recentActivityLog')}>
              {analyticsSnapshot.recentActivity.map((activity) => {
                const IconComponent = sourceIconMap[activity.source] || Info;
                const badgeStyle = sourceColorMap[activity.source] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';

                return (
                  <article
                    key={activity.id}
                    className="flex flex-col sm:flex-row sm:items-start gap-4 py-4 text-xs last:pb-0 first:pt-0"
                    role="article"
                  >
                    {/* Source Icon Indicator Badge */}
                    <div className="flex items-center gap-2 sm:flex-col sm:items-center sm:gap-1 min-w-[80px]">
                      <div
                        className={`p-2 rounded-lg border flex items-center justify-center h-8 w-8 ${badgeStyle}`}
                        aria-hidden="true"
                      >
                        <IconComponent className="h-4 w-4" />
                      </div>
                      <span className="font-semibold text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {activity.sourceLabel}
                      </span>
                    </div>

                    {/* Text Details */}
                    <div className="flex-1 space-y-1">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                        <h4 className="font-bold text-gray-900 dark:text-gray-100 text-sm leading-tight break-words">
                          {activity.title}
                        </h4>
                        <time
                          className="font-mono text-muted-foreground text-[10px]"
                          dateTime={activity.createdAt}
                        >
                          {formatRecentActivityDate(activity.createdAt)}
                        </time>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed break-words pr-4">
                        {activity.description}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Info className="h-10 w-10 text-gray-400 dark:text-gray-500 mb-2" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('pages.analytics.noRecentActivity')}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mt-1">{t('pages.analytics.noValidRecordsWereCreatedDuringTheSelect')}</p>
            </div>
          )}
        </AppCardContent>
      </AppCard>
    </div>
  );
}

export default AnalyticsPage;
