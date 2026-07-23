import { PerformanceSnapshot, PerformanceScorecard, ScoreDimension, SnapshotStatus } from './types';

/**
 * Deterministically generates a scorecard for a given PerformanceSnapshot.
 * Never presents scores as guaranteed predictions, only as historical indicators.
 */
export function generateScorecard(
  snapshot: PerformanceSnapshot,
  predictedViralScoreOverride?: number
): PerformanceScorecard {
  const dimensions: ScoreDimension[] = [];

  const views = snapshot.views || 0;
  const impressions = snapshot.impressions || 0;
  const clicks = snapshot.clicks || 0;
  const purchases = snapshot.purchases || 0;
  const spend = snapshot.spend || 0;
  const revenue = snapshot.revenue || 0;
  const likes = snapshot.likes || 0;
  const comments = snapshot.comments || 0;
  const shares = snapshot.shares || 0;
  const saves = snapshot.saves || 0;
  const completionRate = snapshot.completionRate;
  const engagementRate = snapshot.engagementRate;
  const ctr = snapshot.ctr;
  const cvr = snapshot.cvr;
  const roas = snapshot.roas;

  // 1. Reach Dimension
  const reachScoreVal = impressions > 0 
    ? Math.min(100, Math.round((snapshot.reach || impressions) / impressions * 100))
    : (views > 0 ? Math.min(100, Math.round((views / 5000) * 100)) : 0);
  
  dimensions.push({
    dimension: 'reach',
    value: reachScoreVal,
    explanation: impressions > 0 
      ? `Reach relative to total impressions indicates audience distribution efficiency.`
      : `Based on content plays compared to historical organic baseline targets.`,
    supportingMetrics: impressions > 0 ? ['impressions', 'reach'] : ['views'],
    confidence: impressions > 0 ? 0.95 : 0.6,
    limitations: ['Organic reach can be throttled by hidden platform algorithm changes.', 'Reach indicators do not account for audience fatigue.'],
  });

  // 2. Retention Dimension
  const retentionScoreVal = completionRate !== undefined
    ? Math.round(completionRate * 100)
    : (snapshot.averageWatchTimeSeconds && snapshot.averageWatchTimeSeconds > 0
        ? Math.min(100, Math.round((snapshot.averageWatchTimeSeconds / 15) * 100)) // assuming 15s avg video
        : 50);

  dimensions.push({
    dimension: 'retention',
    value: retentionScoreVal,
    explanation: completionRate !== undefined
      ? `Determined directly via platform reported completion rate of ${Math.round(completionRate * 100)}%.`
      : `Estimated retention based on average watch time. Default baseline fallback applied.`,
    supportingMetrics: completionRate !== undefined ? ['completionRate'] : ['averageWatchTimeSeconds'],
    confidence: completionRate !== undefined ? 1.0 : 0.5,
    limitations: ['Platforms use different rules for what constitutes a completed view.', 'Watch ratio averages can be heavily skewed by early drop-offs.'],
  });

  // 3. Engagement Dimension
  const engScoreVal = engagementRate !== undefined
    ? Math.min(100, Math.round(engagementRate * 500)) // 20% engagement is a perfect 100 score
    : (views > 0
        ? Math.min(100, Math.round(((likes + comments + shares + saves) / views) * 500))
        : 0);

  dimensions.push({
    dimension: 'engagement',
    value: engScoreVal,
    explanation: `Calculated from likes, comments, shares, and saves relative to audience impressions or views.`,
    supportingMetrics: engagementRate !== undefined ? ['engagementRate'] : ['likes', 'comments', 'shares', 'saves', 'views'],
    confidence: 0.9,
    limitations: ['Engagement rate is susceptible to clickbait bias.', 'Incentivized comments do not translate to high brand affinity.'],
  });

  // 4. Sharing Dimension
  const sharingScoreVal = views > 0
    ? Math.min(100, Math.round((shares / views) * 1000)) // 10% share rate is a perfect 100 score
    : 0;

  dimensions.push({
    dimension: 'sharing',
    value: sharingScoreVal,
    explanation: `Measures the viral referral rate of content shares normalized by total views.`,
    supportingMetrics: ['shares', 'views'],
    confidence: 0.85,
    limitations: ['Direct sharing is hard to measure due to dark social channels.', 'Shares do not distinguish between positive and critical user intents.'],
  });

  // 5. Conversion Dimension
  const convScoreVal = cvr !== undefined
    ? Math.round(cvr * 100)
    : (clicks > 0 ? Math.min(100, Math.round((purchases / clicks) * 100)) : 0);

  dimensions.push({
    dimension: 'conversion',
    value: convScoreVal,
    explanation: `Calculated as the percentage of unique clicks or actions resulting in final purchases.`,
    supportingMetrics: cvr !== undefined ? ['cvr'] : ['purchases', 'clicks'],
    confidence: 0.95,
    limitations: ['Post-click attribution windows vary across ad-networks.', 'Cart abandonment behaviors are not factored into simple CVR metrics.'],
  });

  // 6. Commercial Performance Dimension
  let commercialScoreVal = 0;
  let commercialExplanation = '';
  if (roas !== undefined) {
    commercialScoreVal = roas >= 1.0 
      ? Math.min(100, Math.round(50 + (roas - 1.0) * 25)) // 3.0 ROAS is a 100 score
      : Math.round(roas * 50);
    commercialExplanation = `Direct Return on Ad Spend (ROAS) multiplier of ${roas.toFixed(2)}x mapped to baseline curve.`;
  } else if (spend > 0) {
    commercialScoreVal = revenue >= spend 
      ? Math.min(100, Math.round(50 + ((revenue / spend) - 1.0) * 25))
      : Math.round((revenue / spend) * 50);
    commercialExplanation = `Based on revenue to spend ratio of ${(revenue / spend).toFixed(2)}x.`;
  } else if (revenue > 0) {
    commercialScoreVal = 85; // organic conversion wins
    commercialExplanation = `Organic performance (zero spend overhead). Mapped to high-efficiency organic baseline.`;
  } else {
    commercialScoreVal = 0;
    commercialExplanation = `Insufficient data for paid-efficiency analysis (zero spend and zero revenue reported).`;
  }

  dimensions.push({
    dimension: 'commercial performance',
    value: commercialScoreVal,
    explanation: commercialExplanation,
    supportingMetrics: roas !== undefined ? ['roas'] : ['revenue', 'spend'],
    confidence: roas !== undefined || spend > 0 ? 0.95 : 0.0, // Unavailable evidence or spend is zero means 0.0 confidence for paid-efficiency
    limitations: ['Does not account for lifetime customer value (LTV).', 'Currency fluctuations and tax boundaries are excluded.'],
  });

  // 7. Audience Response Dimension
  const totalFeedback = likes + comments;
  const audienceScoreVal = totalFeedback > 0
    ? Math.min(100, Math.round((likes / (likes + comments)) * 100))
    : 50;

  dimensions.push({
    dimension: 'audience response',
    value: audienceScoreVal,
    explanation: `Assesses audience sentiment balance based on appreciation vs discussion triggers.`,
    supportingMetrics: ['likes', 'comments'],
    confidence: 0.75,
    limitations: ['Likes are positive, but comments can be mixed without natural-language NLP parsing.', 'Bots can fake high volumes of simple feedback.'],
  });

  // 8. Trend Alignment Dimension
  const viewVelocityVal = snapshot.viewVelocity;
  const trendScoreVal = viewVelocityVal !== undefined
    ? Math.min(100, Math.round(viewVelocityVal * 10))
    : (views > 0 ? Math.min(100, Math.round((views / 2000) * 10)) : 30);

  dimensions.push({
    dimension: 'trend alignment',
    value: trendScoreVal,
    explanation: viewVelocityVal !== undefined
      ? `Based on observed real-time hourly view velocities.`
      : `Estimated relative to cumulative view counts over the metric window.`,
    supportingMetrics: viewVelocityVal !== undefined ? ['viewVelocity'] : ['views'],
    confidence: 0.7,
    limitations: ['View velocity is highly platform dependent.', 'Viral bursts are rarely sustained over long-term timelines.'],
  });

  // 9. Product Fit Dimension
  const fitScoreVal = clicks > 0 && views > 0
    ? Math.min(100, Math.round((clicks / views) * 500)) // 20% click rate is perfect 100
    : (ctr !== undefined ? Math.round(ctr * 100) : 40);

  dimensions.push({
    dimension: 'product fit',
    value: fitScoreVal,
    explanation: `Inferred by interest indicators, specifically the ratio of product link clicks to views.`,
    supportingMetrics: clicks > 0 && views > 0 ? ['clicks', 'views'] : ['ctr'],
    confidence: 0.8,
    limitations: ['Interest clicks are not guarantees of true brand alignment.', 'Landing-page performance issues can block downstream conversion.'],
  });

  // 10. Creative Efficiency Dimension
  const creativeScoreVal = spend > 0
    ? Math.min(100, Math.round((views / spend) / 10)) // views per dollar spend
    : (views > 0 ? 80 : 50);

  dimensions.push({
    dimension: 'creative efficiency',
    value: creativeScoreVal,
    explanation: spend > 0
      ? `Measures media-buying efficiency: views delivered per unit currency spent.`
      : `High organic rating due to zero paid marketing spend overhead.`,
    supportingMetrics: spend > 0 ? ['views', 'spend'] : ['views'],
    confidence: 0.85,
    limitations: ['Views are cheap to buy but high quality impressions are expensive.', 'Production cost of original assets is not fully factored.'],
  });

  // Overall Score is simple mean of dimensions
  const overallScore = Math.round(
    dimensions.reduce((acc, d) => acc + d.value, 0) / dimensions.length
  );

  // Retrieve predicted pre-production viral score if available in metadata or override
  const predictedViralScore = predictedViralScoreOverride !== undefined
    ? predictedViralScoreOverride
    : (snapshot.metadata?.predictedViralScore || snapshot.metadata?.preProductionViralScore || undefined);

  let observedPerformanceScore: number | undefined;
  let predictionGap: number | undefined;
  let overprediction: boolean | undefined;
  let underprediction: boolean | undefined;

  if (predictedViralScore !== undefined) {
    observedPerformanceScore = overallScore;
    predictionGap = Math.abs(predictedViralScore - observedPerformanceScore);
    overprediction = predictedViralScore > observedPerformanceScore;
    underprediction = predictedViralScore < observedPerformanceScore;
  }

  return {
    id: `scorecard-${snapshot.id}`,
    snapshotId: snapshot.id,
    workspaceId: snapshot.workspaceId,
    overallScore,
    dimensions,
    predictedViralScore,
    observedPerformanceScore,
    predictionGap,
    overprediction,
    underprediction,
    createdAt: new Date().toISOString(),
  };
}
