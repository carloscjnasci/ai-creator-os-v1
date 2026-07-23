import { PerformanceSnapshot, AnalyticsPlatform, AnalyticsSourceType, MetricWindow, SnapshotStatus } from '../types';

export type MockScenario = 'VIRAL_SUCCESS' | 'HOOK_DROP' | 'LOW_ROAS' | 'ORGANIC_STEADY' | 'FAILED_INGESTION';

/**
 * Deterministic Mock Analytics Adapter.
 * Delivers predictable aggregates per scenario. Never uses random numbers or claims real API connection.
 */
export class MockAnalyticsAdapter {
  static getScenarioSnapshot(
    scenario: MockScenario,
    workspaceId: string,
    platform: AnalyticsPlatform = AnalyticsPlatform.TIKTOK
  ): PerformanceSnapshot {
    const base: Omit<PerformanceSnapshot, 'impressions' | 'views' | 'likes' | 'comments' | 'shares' | 'saves' | 'clicks' | 'purchases' | 'revenue' | 'spend'> = {
      id: `mock-snap-${scenario.toLowerCase()}-${platform}`,
      workspaceId,
      platform,
      sourceType: AnalyticsSourceType.MOCK_CONNECTOR,
      status: SnapshotStatus.DRAFT,
      metricWindow: MetricWindow.FIRST_24_HOURS,
      periodStart: '2026-07-16T00:00:00.000Z',
      periodEnd: '2026-07-16T23:59:59.000Z',
      capturedAt: '2026-07-16T23:59:59.000Z',
      currency: 'USD',
      campaignId: 'camp-sprint13',
      creativeIntentId: 'intent-sprint13',
      digitalHumanId: 'human-clara',
      productId: 'prod-boost',
      createdAt: '2026-07-16T23:59:59.000Z',
      updatedAt: '2026-07-16T23:59:59.000Z',
    };

    switch (scenario) {
      case 'VIRAL_SUCCESS':
        return {
          ...base,
          impressions: 150000,
          reach: 120000,
          views: 100000,
          uniqueViewers: 95000,
          threeSecondViews: 65000, // 65% hook ratio (high!)
          watchTimeSeconds: 1500000,
          averageWatchTimeSeconds: 15,
          completionRate: 0.35, // 35% completion (high!)
          likes: 12000,
          comments: 800,
          shares: 2500, // 2.5% share rate
          saves: 3000,
          clicks: 5000, // 5% CTR
          purchases: 350, // 7% CVR
          revenue: 10500,
          spend: 1500, // ROAS = 7x!
          metadata: { scenario, assetType: 'short_video', predictedViralScore: 80 }
        };

      case 'HOOK_DROP':
        return {
          ...base,
          impressions: 50000,
          reach: 45000,
          views: 40000,
          uniqueViewers: 38000,
          threeSecondViews: 6000, // 15% hook ratio (low drop!)
          watchTimeSeconds: 120000,
          averageWatchTimeSeconds: 3,
          completionRate: 0.05, // 5% completion
          likes: 400,
          comments: 20,
          shares: 10,
          saves: 15,
          clicks: 200,
          purchases: 4,
          revenue: 120,
          spend: 400,
          metadata: { scenario, assetType: 'short_video', predictedViralScore: 78 }
        };

      case 'LOW_ROAS':
        return {
          ...base,
          impressions: 100000,
          reach: 80000,
          views: 75000,
          uniqueViewers: 70000,
          threeSecondViews: 30000, // 40% hook ratio (healthy)
          watchTimeSeconds: 675000,
          averageWatchTimeSeconds: 9,
          completionRate: 0.20,
          likes: 1500,
          comments: 100,
          shares: 120,
          saves: 200,
          clicks: 800, // 0.8% CTR (low clicks relative to ad views)
          purchases: 1, // 0.125% CVR
          revenue: 30,
          spend: 1000, // ROAS = 0.03x!
          metadata: { scenario, assetType: 'short_video', predictedViralScore: 70 }
        };

      case 'ORGANIC_STEADY':
        return {
          ...base,
          impressions: 12000,
          reach: 10000,
          views: 9500,
          uniqueViewers: 9000,
          threeSecondViews: 4500, // 47.3% hook ratio
          watchTimeSeconds: 95000,
          averageWatchTimeSeconds: 10,
          completionRate: 0.25,
          likes: 1200,
          comments: 150,
          shares: 200,
          saves: 450,
          clicks: 600, // 6.3% CTR (very high!)
          purchases: 30, // 5% CVR
          revenue: 900,
          spend: 0, // Organic, spend = 0
          metadata: { scenario, assetType: 'short_video', predictedViralScore: 72 }
        };

      case 'FAILED_INGESTION':
        return {
          ...base,
          status: SnapshotStatus.FAILED,
          errorMessage: 'Simulated connection timeout: Platform API failed to respond within 15000ms.',
          metadata: { scenario, errorCode: 'GATEWAY_TIMEOUT' }
        };

      default:
        throw new Error(`Unknown mock scenario: ${scenario}`);
    }
  }

  static async fetchSnapshots(scenario: MockScenario, workspaceId: string): Promise<PerformanceSnapshot[]> {
    if (scenario === 'FAILED_INGESTION') {
      const failedSnapshot = MockAnalyticsAdapter.getScenarioSnapshot('FAILED_INGESTION', workspaceId);
      return [failedSnapshot];
    }
    
    // Return standard deterministic mock snapshot
    return [MockAnalyticsAdapter.getScenarioSnapshot(scenario, workspaceId)];
  }
}
