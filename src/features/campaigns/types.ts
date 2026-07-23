export type CampaignStatus =
  | 'draft'
  | 'active'
  | 'completed';

export interface Campaign {
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  createdAt: string;
  characterId?: string;
  productId?: string;
  wardrobeItemId?: string;
  sceneId?: string;
  poseId?: string;
}
