import type { CreativePlatform, ViralScoreResult } from '@/core/types';
export interface CampaignWorkflow {
  id: string;
  campaignId?: string;
  planId?: string;
  executionRunId?: string;
  name: string;
  objective: string;
  platform: CreativePlatform;
  productId?: string;
  digitalHumanId?: string;
  wardrobeItemId?: string;
  sceneId?: string;
  poseId?: string;
  promptStatus: 'pending' | 'ready' | 'approved';
  imageStatus: 'pending' | 'ready' | 'approved';
  videoStatus: 'pending' | 'ready' | 'approved';
  publishingStatus: 'not-scheduled' | 'scheduled' | 'published';
  analyticsStatus: 'waiting' | 'collecting' | 'complete';
  viralScore?: ViralScoreResult;
  updatedAt: string;
  createdAt: string;
}
