import { PerformanceSnapshot, AnalyticsPlatform, DerivedMetricValue, SnapshotStatus } from './types';

export const FORMULAS = {
  ENGAGEMENT_RATE: {
    id: 'ENG_RATE',
    name: 'Engagement Rate',
    requiredInputs: ['likes', 'comments', 'shares', 'saves', 'views'],
    isExact: true,
  },
  CTR: {
    id: 'CTR',
    name: 'Click-Through Rate',
    requiredInputs: ['clicks', 'impressions'],
    isExact: true,
  },
  CVR: {
    id: 'CVR',
    name: 'Conversion Rate',
    requiredInputs: ['purchases', 'clicks'],
    isExact: true,
  },
  ROAS: {
    id: 'ROAS',
    name: 'Return on Ad Spend',
    requiredInputs: ['revenue', 'spend'],
    isExact: true,
  },
  SHARE_RATE: {
    id: 'SHARE_RATE',
    name: 'Share Rate',
    requiredInputs: ['shares', 'views'],
    isExact: true,
  },
  SAVE_RATE: {
    id: 'SAVE_RATE',
    name: 'Save Rate',
    requiredInputs: ['saves', 'views'],
    isExact: true,
  },
  FOLLOW_CONVERSION: {
    id: 'FOLLOW_CONV',
    name: 'Follow Conversion Rate',
    requiredInputs: ['follows', 'views'],
    isExact: true,
  },
  RPM: {
    id: 'RPM',
    name: 'Revenue Per Thousand Views',
    requiredInputs: ['revenue', 'views'],
    isExact: true,
  }
};

/**
 * Maps raw platform-specific fields in metadata to canonical snapshot fields.
 * Does not overwrite existing values in the snapshot.
 */
export function normalizePlatformFields(snapshot: PerformanceSnapshot): PerformanceSnapshot {
  const meta = snapshot.metadata || {};
  const normalized: Partial<PerformanceSnapshot> = {};

  const mapField = (canonicalKey: keyof PerformanceSnapshot, rawKeys: string[]) => {
    if (snapshot[canonicalKey] !== undefined) return; // already set
    for (const rKey of rawKeys) {
      const val = meta[rKey];
      if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
        (normalized as any)[canonicalKey] = val;
        break;
      }
    }
  };

  // Platform-specific aliases
  mapField('impressions', ['impression_count', 'impressions', 'impCount', 'display_count']);
  mapField('views', ['play_count', 'views', 'viewCount', 'playCount', 'video_views']);
  mapField('reach', ['reach_count', 'reach', 'unique_reach', 'audience_reach']);
  mapField('likes', ['like_count', 'likes', 'favorite_count', 'diggCount', 'love_count']);
  mapField('comments', ['comment_count', 'comments', 'reply_count', 'commentCount']);
  mapField('shares', ['share_count', 'shares', 'repost_count', 'repostsCount']);
  mapField('saves', ['save_count', 'saves', 'collectCount', 'collects']);
  mapField('clicks', ['click_count', 'clicks', 'link_clicks', 'tap_count']);
  mapField('follows', ['followers_gained', 'follows', 'follower_count', 'new_followers']);
  mapField('purchases', ['purchasesCount', 'purchases', 'orders', 'sales_count']);
  mapField('revenue', ['revenue_amount', 'revenue', 'sales', 'sales_revenue']);
  mapField('spend', ['cost', 'ad_spend', 'spend', 'budget_spent']);
  mapField('threeSecondViews', ['three_second_views', '3s_views', 'threeSecondViews']);
  mapField('watchTimeSeconds', ['watch_time', 'watchTimeSeconds', 'total_watch_time']);
  mapField('averageWatchTimeSeconds', ['average_watch_time', 'averageWatchTimeSeconds', 'avg_watch_time']);

  return {
    ...snapshot,
    ...normalized,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Safely computes derived metrics based on raw metrics without modifying original values.
 * Returns the updated snapshot fields and record of formulas applied.
 */
export function normalizeAndDeriveMetrics(snapshot: PerformanceSnapshot): {
  normalized: PerformanceSnapshot;
  formulasApplied: Record<string, DerivedMetricValue & { formulaId: string }>;
} {
  // Step 1: Normalize platform fields first
  let current = normalizePlatformFields(snapshot);
  const formulasApplied: Record<string, DerivedMetricValue & { formulaId: string }> = {};

  const views = current.views;
  const impressions = current.impressions;
  const clicks = current.clicks;
  const purchases = current.purchases;
  const spend = current.spend;
  const revenue = current.revenue;
  const likes = current.likes;
  const comments = current.comments;
  const shares = current.shares;
  const saves = current.saves;
  const follows = current.follows;

  // 1. Engagement Rate: (likes + comments + shares + saves) / views
  if (current.engagementRate === undefined) {
    const totalEng = (likes || 0) + (comments || 0) + (shares || 0) + (saves || 0);
    const denominator = views || impressions;
    if (totalEng > 0 && denominator && denominator > 0) {
      const rate = Math.min(1, totalEng / denominator);
      current.engagementRate = rate;
      formulasApplied['engagementRate'] = {
        formulaId: FORMULAS.ENGAGEMENT_RATE.id,
        value: rate,
        isExact: views !== undefined, // Estimated if using impressions instead of views
        confidence: views !== undefined ? 1.0 : 0.7,
      };
    }
  }

  // 2. CTR: clicks / impressions (or clicks / views)
  if (current.ctr === undefined && clicks !== undefined) {
    const denominator = impressions || views;
    if (denominator && denominator > 0) {
      const rate = Math.min(1, clicks / denominator);
      current.ctr = rate;
      formulasApplied['ctr'] = {
        formulaId: FORMULAS.CTR.id,
        value: rate,
        isExact: impressions !== undefined,
        confidence: impressions !== undefined ? 1.0 : 0.6,
      };
    }
  }

  // 3. CVR: purchases / clicks (or purchases / views)
  if (current.cvr === undefined && purchases !== undefined) {
    const denominator = clicks || views;
    if (denominator && denominator > 0) {
      const rate = Math.min(1, purchases / denominator);
      current.cvr = rate;
      formulasApplied['cvr'] = {
        formulaId: FORMULAS.CVR.id,
        value: rate,
        isExact: clicks !== undefined,
        confidence: clicks !== undefined ? 1.0 : 0.5,
      };
    }
  }

  // 4. ROAS: revenue / spend
  if (current.roas === undefined && revenue !== undefined && spend !== undefined) {
    if (spend > 0) {
      const value = revenue / spend;
      current.roas = value;
      formulasApplied['roas'] = {
        formulaId: FORMULAS.ROAS.id,
        value,
        isExact: true,
        confidence: 1.0,
      };
    }
  }

  // 5. Share Rate: shares / views
  if (current.shareRate === undefined && shares !== undefined && views && views > 0) {
    const rate = Math.min(1, shares / views);
    formulasApplied['shareRate'] = {
      formulaId: FORMULAS.SHARE_RATE.id,
      value: rate,
      isExact: true,
      confidence: 1.0,
    };
  }

  // 6. Save Rate: saves / views
  if (current.saveRate === undefined && saves !== undefined && views && views > 0) {
    const rate = Math.min(1, saves / views);
    formulasApplied['saveRate'] = {
      formulaId: FORMULAS.SAVE_RATE.id,
      value: rate,
      isExact: true,
      confidence: 1.0,
    };
  }

  // 7. Follow Conversion: follows / views
  if (current.followConversion === undefined && follows !== undefined && views && views > 0) {
    const rate = Math.min(1, follows / views);
    formulasApplied['followConversion'] = {
      formulaId: FORMULAS.FOLLOW_CONVERSION.id,
      value: rate,
      isExact: true,
      confidence: 1.0,
    };
  }

  // 8. RPM: revenue / views * 1000
  if (revenue !== undefined && views && views > 0) {
    const rpmValue = (revenue / views) * 1000;
    formulasApplied['rpm'] = {
      formulaId: FORMULAS.RPM.id,
      value: rpmValue,
      isExact: true,
      confidence: 1.0,
    };
  }

  // Update status if it's currently VALIDATED or DRAFT to NORMALIZED
  if (current.status === SnapshotStatus.DRAFT || current.status === SnapshotStatus.VALIDATED) {
    current.status = SnapshotStatus.NORMALIZED;
  }

  return {
    normalized: current,
    formulasApplied,
  };
}
