import { 
  AnalyticsInsight, 
  AnalyticsRecommendation, 
  RecommendationType, 
  RecommendationStatus, 
  InsightCategory, 
  InsightSeverity 
} from './types';

/**
 * Deterministically generates actionable AnalyticsRecommendation records based on current insights.
 */
export function generateRecommendations(insights: AnalyticsInsight[]): AnalyticsRecommendation[] {
  const recommendations: AnalyticsRecommendation[] = [];

  for (const insight of insights) {
    const workspaceId = insight.workspaceId;
    const targetEntities = { ...insight.relatedEntityIds };

    // 1. Hook / Retention category -> Improve opening hook / shorten introduction
    if (insight.category === InsightCategory.HOOK && insight.severity === InsightSeverity.HIGH) {
      recommendations.push({
        id: `rec-hook-improve-${insight.id}`,
        workspaceId,
        recommendationType: RecommendationType.IMPROVE_HOOK,
        evidence: [
          `Insight "${insight.title}" indicates a high drop-off rate of viewers in the first 3 seconds.`,
          `Observed hook ratio was only ${insight.evidence.value} against standard benchmark ${insight.evidence.baseline}.`
        ],
        expectedEffect: 'Expected to increase early 3-second viewer retention by 15-25% on subsequent video runs.',
        confidence: 0.9,
        targetEntities,
        proposedChange: 'Redesign the video introduction: replace the generic opening statement with a high-contrast visual hook or a direct provocative question in the first 2 seconds.',
        risk: 'Higher bounce rate if the hook is perceived as clickbait by a subset of the audience.',
        status: RecommendationStatus.PROPOSED,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // 2. Product fit / CTA click conversion -> Strengthen CTA
    if (insight.category === InsightCategory.PRODUCT_FIT) {
      recommendations.push({
        id: `rec-cta-strengthen-${insight.id}`,
        workspaceId,
        recommendationType: RecommendationType.STRENGTHEN_CTA,
        evidence: [
          `Insight "${insight.title}" indicates low click-to-view ratio of ${insight.evidence.value}.`
        ],
        expectedEffect: 'Expected to improve product click-through rate (CTR) by 40-60%.',
        confidence: 0.85,
        targetEntities,
        proposedChange: 'Overlay an explicit product link graphic arrow and include a clear, verbalized call-to-action ("Click the link below to get yours now") in the last 5 seconds of the video timeline.',
        risk: 'Slightly higher skip rate at the very end of the video.',
        status: RecommendationStatus.PROPOSED,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // 3. Outlier breakthroughs -> Replicate successful prompt structure or preserve wardrobe combo
    if (insight.category === InsightCategory.OUTLIER) {
      const isPositive = insight.severity !== InsightSeverity.CRITICAL;
      if (isPositive) {
        recommendations.push({
          id: `rec-replicate-success-${insight.id}`,
          workspaceId,
          recommendationType: RecommendationType.REUSE_PROMPT_STRUCTURE,
          evidence: [
            `Snapshot achieved positive outlier performance of ${insight.evidence.value}x lift in ${insight.title}.`
          ],
          expectedEffect: 'Maintain a premium performance benchmark and build campaign wave consistency.',
          confidence: 0.95,
          targetEntities,
          proposedChange: 'Lock the current prompt optimizer parameters and digital human style ruleset as a verified Master Preset for future campaign clones.',
          risk: 'Repeated structures could lead to content fatigue across the same audience if used too frequently.',
          status: RecommendationStatus.PROPOSED,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else {
        recommendations.push({
          id: `rec-mitigate-failure-${insight.id}`,
          workspaceId,
          recommendationType: RecommendationType.STOP_REPEATING_WEAK_STRUCTURE,
          evidence: [
            `Performance drop of ${insight.evidence.value}x below baseline detected in "${insight.title}".`
          ],
          expectedEffect: 'Mitigate unprofitable ad spend distribution and recover standard views-velocity averages.',
          confidence: 0.8,
          targetEntities,
          proposedChange: 'Deprecate this prompt structure or digital human persona combination immediately. Transition back to the previous stable baseline setup.',
          risk: 'Limits further platform experimentation on this specific creative pathway.',
          status: RecommendationStatus.PROPOSED,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // 4. Conversion / ROAS insights
    if (insight.category === InsightCategory.CONVERSION && insight.severity === InsightSeverity.HIGH && insight.title.includes('Profitable')) {
      recommendations.push({
        id: `rec-scale-roas-${insight.id}`,
        workspaceId,
        recommendationType: RecommendationType.ADAPT_FOR_PLATFORM,
        evidence: [
          `Exceptional return-on-ad-spend (ROAS) of ${insight.evidence.value}x recorded.`
        ],
        expectedEffect: 'Maximize aggregate revenue stream and exploit viral trending window.',
        confidence: 0.9,
        targetEntities,
        proposedChange: 'Increase ad spend allocation by 50% on this specific content layout and adapt the video format size for alternative high-traffic platforms.',
        risk: 'Ad network audience saturation might lead to a marginal decline in overall ROAS efficiency.',
        status: RecommendationStatus.PROPOSED,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return recommendations;
}

/**
 * Validates state transition for a recommendation.
 */
export function isValidRecommendationTransition(
  from: RecommendationStatus,
  to: RecommendationStatus
): boolean {
  if (from === to) return true;

  const transitions: Record<RecommendationStatus, RecommendationStatus[]> = {
    [RecommendationStatus.PROPOSED]: [RecommendationStatus.ACCEPTED, RecommendationStatus.REJECTED, RecommendationStatus.SUPERSEDED, RecommendationStatus.ARCHIVED],
    [RecommendationStatus.ACCEPTED]: [RecommendationStatus.APPLIED, RecommendationStatus.REJECTED, RecommendationStatus.SUPERSEDED, RecommendationStatus.ARCHIVED],
    [RecommendationStatus.REJECTED]: [RecommendationStatus.PROPOSED, RecommendationStatus.ARCHIVED],
    [RecommendationStatus.APPLIED]: [RecommendationStatus.ARCHIVED],
    [RecommendationStatus.SUPERSEDED]: [RecommendationStatus.ARCHIVED],
    [RecommendationStatus.ARCHIVED]: [RecommendationStatus.PROPOSED],
  };

  const allowed = transitions[from];
  return allowed ? allowed.includes(to) : false;
}
