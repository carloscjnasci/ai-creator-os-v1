import type { PromptOptimizationResult, ViralScoreResult } from '@/core/types';
export interface PromptExperiment {
  id: string;
  name: string;
  prompt: string;
  version: number;
  parentId?: string;
  campaignId?: string;
  model: string;
  userRating?: number;
  performanceScore?: number;
  optimization: PromptOptimizationResult;
  viralScore: ViralScoreResult;
  createdAt: string;
}
