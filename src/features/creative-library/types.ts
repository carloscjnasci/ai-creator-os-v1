export const CREATIVE_ASSET_TYPES = ['image', 'video', 'audio', 'thumbnail', 'document'] as const;
export type CreativeAssetType = (typeof CREATIVE_ASSET_TYPES)[number];
export interface CreativeAsset {
  id: string;
  name: string;
  type: CreativeAssetType;
  sourceUrl: string;
  campaignId?: string;
  digitalHumanId?: string;
  productId?: string;
  wardrobeItemId?: string;
  sceneId?: string;
  promptExperimentId?: string;
  promptUsed: string;
  model: string;
  tags: string[];
  createdAt: string;
  // Integration fields
  cloudAssetId?: string;
  storageProvider?: string;
  storageKey?: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  byteSize?: number;
  mimeType?: string;
  checksum?: string;
  processingStatus?: string;
  // Optional Analytics Fields
  analyticsSnapshotIds?: string[];
  observedPerformanceScore?: number;
  engagementScore?: number;
  retentionScore?: number;
  conversionScore?: number;
  outlierStatus?: 'positive' | 'negative' | 'none';
  lastMetricsCapturedAt?: string;
  // Optional Experimentation Fields
  experimentIds?: string[];
  experimentVariantIds?: string[];
  experimentResult?: 'winner' | 'loser' | 'control' | 'treatment' | 'inconclusive';
  experimentLift?: number;
  experimentConfidence?: number;
  isExperimentWinner?: boolean;
  lastExperimentEvaluatedAt?: string;
}
