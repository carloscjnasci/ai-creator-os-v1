import type { CreativePlatform } from '@/core/types';

export interface TrendSignal {
  id: string;
  platform: CreativePlatform;
  topic: string;
  sourceUrl: string;
  summary: string;
  views: number;
  baselineViews: number;
  outlierMultiplier: number;
  tags: string[];
  capturedAt: string;
}
