export const ANALYTICS_DATE_RANGES = [
  '7-days',
  '30-days',
  '90-days',
  'all-time',
] as const;

export type AnalyticsDateRange =
  (typeof ANALYTICS_DATE_RANGES)[number];

export const ANALYTICS_ACTIVITY_SOURCES = [
  'campaign',
  'character',
  'product',
  'wardrobe',
  'scene',
  'pose',
  'prompt',
] as const;

export type AnalyticsActivitySource =
  (typeof ANALYTICS_ACTIVITY_SOURCES)[number];

export interface AnalyticsDistributionItem {
  key: string;
  label: string;
  count: number;
  percentage: number;
}

export interface AnalyticsDailyActivityPoint {
  date: string;
  label: string;
  total: number;
  campaigns: number;
  characters: number;
  products: number;
  wardrobeItems: number;
  scenes: number;
  poses: number;
  prompts: number;
}

export interface AnalyticsRecentActivityItem {
  id: string;
  source: AnalyticsActivitySource;
  sourceLabel: string;
  title: string;
  description: string;
  createdAt: string;
}

export interface AnalyticsSummaryMetrics {
  totalCampaigns: number;
  draftCampaigns: number;
  activeCampaigns: number;
  completedCampaigns: number;

  totalCharacters: number;
  totalProducts: number;
  totalWardrobeItems: number;
  totalScenes: number;
  totalPoses: number;

  totalLibraryItems: number;

  totalPrompts: number;
  imagePrompts: number;
  videoPrompts: number;

  activityInSelectedRange: number;
}

export interface AnalyticsSnapshot {
  range: AnalyticsDateRange;
  generatedAt: string;

  summary: AnalyticsSummaryMetrics;

  campaignStatusDistribution:
    AnalyticsDistributionItem[];

  libraryComposition:
    AnalyticsDistributionItem[];

  promptOutputDistribution:
    AnalyticsDistributionItem[];

  promptPlatformDistribution:
    AnalyticsDistributionItem[];

  promptAspectRatioDistribution:
    AnalyticsDistributionItem[];

  dailyActivity:
    AnalyticsDailyActivityPoint[];

  recentActivity:
    AnalyticsRecentActivityItem[];
}
