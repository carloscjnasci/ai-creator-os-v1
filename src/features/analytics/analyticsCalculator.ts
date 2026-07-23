import { Campaign } from '@/features/campaigns/types';
import { Character } from '@/features/characters/types';
import { Product } from '@/features/products/types';
import { WardrobeItem } from '@/features/wardrobe/types';
import { Scene } from '@/features/scenes/types';
import { Pose } from '@/features/poses/types';
import { PromptHistoryEntry } from '@/features/prompt-engine/types';
import {
  AnalyticsDateRange,
  AnalyticsActivitySource,
  AnalyticsSnapshot,
  AnalyticsRecentActivityItem,
  AnalyticsDailyActivityPoint,
  AnalyticsDistributionItem,
  AnalyticsSummaryMetrics,
} from './types';

export interface AnalyticsCalculatorInput {
  campaigns: Campaign[];
  characters: Character[];
  products: Product[];
  wardrobeItems: WardrobeItem[];
  scenes: Scene[];
  poses: Pose[];
  promptHistory: PromptHistoryEntry[];
}

export interface BuildAnalyticsSnapshotOptions {
  range: AnalyticsDateRange;
  now?: Date;
  recentActivityLimit?: number;
}

export function isAnalyticsDateRange(value: string): value is AnalyticsDateRange {
  return ['7-days', '30-days', '90-days', 'all-time'].includes(value);
}

function getValidAnalyticsNow(value?: Date): Date {
  if (value) {
    const candidate = new Date(value);
    if (Number.isFinite(candidate.getTime())) {
      return candidate;
    }
  }
  return new Date();
}

export function getAnalyticsRangeStart(range: AnalyticsDateRange, now?: Date): Date | null {
  if (range === 'all-time') {
    return null;
  }
  const d = getValidAnalyticsNow(now);
  d.setHours(0, 0, 0, 0);

  if (range === '7-days') {
    d.setDate(d.getDate() - 6);
  } else if (range === '30-days') {
    d.setDate(d.getDate() - 29);
  } else if (range === '90-days') {
    d.setDate(d.getDate() - 89);
  }
  return d;
}

function getSafeTimestamp(value: string | undefined | null): number | null {
  if (!value) {
    return null;
  }
  const ts = Date.parse(value);
  if (isNaN(ts)) {
    return null;
  }
  return ts;
}

function isDateInsideAnalyticsRange(
  value: string,
  rangeStart: Date | null,
  now: Date,
): boolean {
  const ts = getSafeTimestamp(value);
  if (ts === null) {
    return false;
  }

  // End of the current day boundary
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  if (ts > endOfDay.getTime()) {
    return false;
  }

  if (rangeStart === null) {
    return true;
  }

  return ts >= rangeStart.getTime();
}

function calculatePercentage(count: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  const percentage = (count / total) * 100;
  return Math.round(percentage * 10) / 10;
}

const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  completed: 'Completed',
};

const PLATFORM_LABELS: Record<string, string> = {
  'veo-3': 'Google Veo 3',
  'grok': 'Grok',
  'nano-banana': 'Nano Banana',
  'generic': 'Generic AI generator',
};

export function buildAnalyticsSnapshot(
  input: AnalyticsCalculatorInput,
  options: BuildAnalyticsSnapshotOptions,
): AnalyticsSnapshot {
  const campaigns = input.campaigns || [];
  const characters = input.characters || [];
  const products = input.products || [];
  const wardrobeItems = input.wardrobeItems || [];
  const scenes = input.scenes || [];
  const poses = input.poses || [];
  const promptHistory = input.promptHistory || [];

  const range = options.range;
  const now = getValidAnalyticsNow(options.now);
  const limit = Math.max(1, Math.min(50, options.recentActivityLimit ?? 10));

  const rangeStart = getAnalyticsRangeStart(range, now);

  // Deduplicated Activity Collection
  const normalizedActivityMap = new Map<string, AnalyticsRecentActivityItem>();

  const addNormalizedActivity = (
    id: string,
    source: AnalyticsActivitySource,
    sourceLabel: string,
    title: string,
    description: string,
    createdAt: string
  ) => {
    const ts = getSafeTimestamp(createdAt);
    if (ts === null) return;

    const existing = normalizedActivityMap.get(id);
    if (!existing) {
      normalizedActivityMap.set(id, {
        id,
        source,
        sourceLabel,
        title,
        description,
        createdAt,
      });
    } else {
      const existingTs = getSafeTimestamp(existing.createdAt) || 0;
      if (ts > existingTs) {
        normalizedActivityMap.set(id, {
          id,
          source,
          sourceLabel,
          title,
          description,
          createdAt,
        });
      }
    }
  };

  for (const record of campaigns) {
    const statusLabel = CAMPAIGN_STATUS_LABELS[record.status] || record.status;
    addNormalizedActivity(
      `campaign:${record.id}`,
      'campaign',
      'Campaign',
      record.name,
      `Status: ${statusLabel}`,
      record.createdAt
    );
  }
  for (const record of characters) {
    addNormalizedActivity(
      `character:${record.id}`,
      'character',
      'Character',
      record.name,
      record.description || 'No description provided.',
      record.createdAt
    );
  }
  for (const record of products) {
    addNormalizedActivity(
      `product:${record.id}`,
      'product',
      'Product',
      record.name,
      record.description || 'No description provided.',
      record.createdAt
    );
  }
  for (const record of wardrobeItems) {
    addNormalizedActivity(
      `wardrobe:${record.id}`,
      'wardrobe',
      'Wardrobe',
      record.name,
      record.description || 'No description provided.',
      record.createdAt
    );
  }
  for (const record of scenes) {
    addNormalizedActivity(
      `scene:${record.id}`,
      'scene',
      'Scene',
      record.name,
      record.description || 'No description provided.',
      record.createdAt
    );
  }
  for (const record of poses) {
    addNormalizedActivity(
      `pose:${record.id}`,
      'pose',
      'Pose',
      record.name,
      record.description || 'No description provided.',
      record.createdAt
    );
  }
  for (const record of promptHistory) {
    const outputTypeLabel = record.configuration.outputType === 'video' ? 'Video' : 'Image';
    const platformLabel = PLATFORM_LABELS[record.configuration.platform] || record.configuration.platform;
    const title = `${outputTypeLabel} prompt — ${platformLabel}`;
    const normalizedPrompt = record.generatedPrompt.replace(/\s+/g, ' ').trim();
    const description = normalizedPrompt.length > 120
      ? normalizedPrompt.slice(0, 120) + '...'
      : normalizedPrompt;
    addNormalizedActivity(
      `prompt:${record.id}`,
      'prompt',
      'Prompt',
      title,
      description,
      record.createdAt
    );
  }

  const normalizedActivities = Array.from(normalizedActivityMap.values());

  // Filter activities to only inside the selected range
  const filteredActivities = normalizedActivities.filter((act) =>
    isDateInsideAnalyticsRange(act.createdAt, rangeStart, now)
  );

  const activityInSelectedRange = filteredActivities.length;

  // 2. Summary Metrics
  const totalCampaigns = campaigns.length;
  const draftCampaigns = campaigns.filter((c) => c.status === 'draft').length;
  const activeCampaigns = campaigns.filter((c) => c.status === 'active').length;
  const completedCampaigns = campaigns.filter((c) => c.status === 'completed').length;

  const totalCharacters = characters.length;
  const totalProducts = products.length;
  const totalWardrobeItems = wardrobeItems.length;
  const totalScenes = scenes.length;
  const totalPoses = poses.length;
  const totalLibraryItems = totalCharacters + totalProducts + totalWardrobeItems + totalScenes + totalPoses;

  const totalPrompts = promptHistory.length;
  const imagePrompts = promptHistory.filter((p) => p.configuration.outputType === 'image').length;
  const videoPrompts = promptHistory.filter((p) => p.configuration.outputType === 'video').length;

  const summary: AnalyticsSummaryMetrics = {
    totalCampaigns,
    draftCampaigns,
    activeCampaigns,
    completedCampaigns,
    totalCharacters,
    totalProducts,
    totalWardrobeItems,
    totalScenes,
    totalPoses,
    totalLibraryItems,
    totalPrompts,
    imagePrompts,
    videoPrompts,
    activityInSelectedRange,
  };

  // 3. Campaign Status Distribution
  const campaignStatusDistribution: AnalyticsDistributionItem[] = [
    {
      key: 'draft',
      label: 'Draft',
      count: draftCampaigns,
      percentage: calculatePercentage(draftCampaigns, totalCampaigns),
    },
    {
      key: 'active',
      label: 'Active',
      count: activeCampaigns,
      percentage: calculatePercentage(activeCampaigns, totalCampaigns),
    },
    {
      key: 'completed',
      label: 'Completed',
      count: completedCampaigns,
      percentage: calculatePercentage(completedCampaigns, totalCampaigns),
    },
  ];

  // 4. Library Composition
  const libraryComposition: AnalyticsDistributionItem[] = [
    {
      key: 'characters',
      label: 'Characters',
      count: totalCharacters,
      percentage: calculatePercentage(totalCharacters, totalLibraryItems),
    },
    {
      key: 'products',
      label: 'Products',
      count: totalProducts,
      percentage: calculatePercentage(totalProducts, totalLibraryItems),
    },
    {
      key: 'wardrobe',
      label: 'Wardrobe',
      count: totalWardrobeItems,
      percentage: calculatePercentage(totalWardrobeItems, totalLibraryItems),
    },
    {
      key: 'scenes',
      label: 'Scenes',
      count: totalScenes,
      percentage: calculatePercentage(totalScenes, totalLibraryItems),
    },
    {
      key: 'poses',
      label: 'Poses',
      count: totalPoses,
      percentage: calculatePercentage(totalPoses, totalLibraryItems),
    },
  ];

  // 5. Prompt Output Distribution
  const promptOutputDistribution: AnalyticsDistributionItem[] = [
    {
      key: 'video',
      label: 'Video',
      count: videoPrompts,
      percentage: calculatePercentage(videoPrompts, totalPrompts),
    },
    {
      key: 'image',
      label: 'Image',
      count: imagePrompts,
      percentage: calculatePercentage(imagePrompts, totalPrompts),
    },
  ];

  // 6. Prompt Platform Distribution
  const platformCounts = {
    'veo-3': promptHistory.filter((p) => p.configuration.platform === 'veo-3').length,
    'grok': promptHistory.filter((p) => p.configuration.platform === 'grok').length,
    'nano-banana': promptHistory.filter((p) => p.configuration.platform === 'nano-banana').length,
    'generic': promptHistory.filter((p) => p.configuration.platform === 'generic').length,
  };

  const promptPlatformDistribution: AnalyticsDistributionItem[] = [
    {
      key: 'veo-3',
      label: 'Google Veo 3',
      count: platformCounts['veo-3'],
      percentage: calculatePercentage(platformCounts['veo-3'], totalPrompts),
    },
    {
      key: 'grok',
      label: 'Grok',
      count: platformCounts['grok'],
      percentage: calculatePercentage(platformCounts['grok'], totalPrompts),
    },
    {
      key: 'nano-banana',
      label: 'Nano Banana',
      count: platformCounts['nano-banana'],
      percentage: calculatePercentage(platformCounts['nano-banana'], totalPrompts),
    },
    {
      key: 'generic',
      label: 'Generic AI generator',
      count: platformCounts['generic'],
      percentage: calculatePercentage(platformCounts['generic'], totalPrompts),
    },
  ];

  // 7. Aspect Ratio Distribution
  const ratioCounts = {
    '9:16': promptHistory.filter((p) => p.configuration.aspectRatio === '9:16').length,
    '16:9': promptHistory.filter((p) => p.configuration.aspectRatio === '16:9').length,
    '1:1': promptHistory.filter((p) => p.configuration.aspectRatio === '1:1').length,
    '4:5': promptHistory.filter((p) => p.configuration.aspectRatio === '4:5').length,
  };

  const promptAspectRatioDistribution: AnalyticsDistributionItem[] = [
    {
      key: '9:16',
      label: '9:16',
      count: ratioCounts['9:16'],
      percentage: calculatePercentage(ratioCounts['9:16'], totalPrompts),
    },
    {
      key: '16:9',
      label: '16:9',
      count: ratioCounts['16:9'],
      percentage: calculatePercentage(ratioCounts['16:9'], totalPrompts),
    },
    {
      key: '1:1',
      label: '1:1',
      count: ratioCounts['1:1'],
      percentage: calculatePercentage(ratioCounts['1:1'], totalPrompts),
    },
    {
      key: '4:5',
      label: '4:5',
      count: ratioCounts['4:5'],
      percentage: calculatePercentage(ratioCounts['4:5'], totalPrompts),
    },
  ];

  // Stable sort newest first
  const sortedActivities = [...filteredActivities].sort((a, b) => {
    const tsA = getSafeTimestamp(a.createdAt) || 0;
    const tsB = getSafeTimestamp(b.createdAt) || 0;
    if (tsB !== tsA) {
      return tsB - tsA;
    }
    return b.id.localeCompare(a.id);
  });

  const recentActivity = sortedActivities.slice(0, limit);

  // 9. Daily Timeline
  const getLocalDateString = (date: Date): string => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  let dayStrings: string[] = [];
  let numDays = 0;
  if (range === '7-days') numDays = 7;
  else if (range === '30-days') numDays = 30;
  else if (range === '90-days') numDays = 90;

  if (numDays > 0) {
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dayStrings.push(getLocalDateString(d));
    }
  } else {
    // all-time
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const endOfTodayTime = endOfToday.getTime();

    const timestamps = normalizedActivities
      .map((act) => getSafeTimestamp(act.createdAt))
      .filter((ts): ts is number => ts !== null && ts <= endOfTodayTime);

    if (timestamps.length > 0) {
      const oldestTs = Math.min(...timestamps);
      const oldestStart = new Date(oldestTs);
      oldestStart.setHours(0, 0, 0, 0);

      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      // Loop calendar-day additions safely avoiding DST shifting issues
      const tempDayStrings: string[] = [];
      const d = new Date(oldestStart);
      while (d <= todayStart) {
        tempDayStrings.push(getLocalDateString(d));
        d.setDate(d.getDate() + 1);
      }

      // Cap to 365 days
      if (tempDayStrings.length > 365) {
        dayStrings = tempDayStrings.slice(tempDayStrings.length - 365);
      } else {
        dayStrings = tempDayStrings;
      }
    }
  }

  const getShortMonthDayLabel = (dateStr: string): string => {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return '';
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const monthName = months[monthIndex] || '';
    return `${monthName} ${day}`;
  };

  const getRecordLocalDateString = (createdAt: string): string | null => {
    const ts = getSafeTimestamp(createdAt);
    if (ts === null) return null;
    return getLocalDateString(new Date(ts));
  };

  const dailyCounts: Record<string, {
    campaigns: number;
    characters: number;
    products: number;
    wardrobeItems: number;
    scenes: number;
    poses: number;
    prompts: number;
  }> = {};

  for (const day of dayStrings) {
    dailyCounts[day] = {
      campaigns: 0,
      characters: 0,
      products: 0,
      wardrobeItems: 0,
      scenes: 0,
      poses: 0,
      prompts: 0,
    };
  }

  const incrementDailyCount = (createdAt: string, field: keyof typeof dailyCounts[string]) => {
    const dayStr = getRecordLocalDateString(createdAt);
    if (dayStr && dailyCounts[dayStr]) {
      dailyCounts[dayStr][field]++;
    }
  };

  const sourceToFieldMap: Record<AnalyticsActivitySource, keyof typeof dailyCounts[string]> = {
    campaign: 'campaigns',
    character: 'characters',
    product: 'products',
    wardrobe: 'wardrobeItems',
    scene: 'scenes',
    pose: 'poses',
    prompt: 'prompts',
  };

  for (const activity of normalizedActivities) {
    const field = sourceToFieldMap[activity.source];
    if (field) {
      incrementDailyCount(activity.createdAt, field);
    }
  }

  const dailyActivity: AnalyticsDailyActivityPoint[] = dayStrings.map((day) => {
    const counts = dailyCounts[day];
    const total =
      counts.campaigns +
      counts.characters +
      counts.products +
      counts.wardrobeItems +
      counts.scenes +
      counts.poses +
      counts.prompts;
    return {
      date: day,
      label: getShortMonthDayLabel(day),
      total,
      ...counts,
    };
  });

  return {
    range,
    generatedAt: now.toISOString(),
    summary,
    campaignStatusDistribution,
    libraryComposition,
    promptOutputDistribution,
    promptPlatformDistribution,
    promptAspectRatioDistribution,
    dailyActivity,
    recentActivity,
  };
}
