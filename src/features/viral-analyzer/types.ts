import type { ViralContentAnalysis } from '@/core/types';
export interface SavedViralAnalysis extends ViralContentAnalysis {
  id: string;
  notes: string;
  digitalHumanId?: string;
  productId?: string;
  createdAt: string;
}
