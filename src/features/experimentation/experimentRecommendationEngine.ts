import { 
  Experiment, 
  ExperimentVariant, 
  ExperimentAnalysisResult, 
  ExperimentRecommendation, 
  AnalysisResultStatus, 
  RecommendationStatus 
} from './types';

/**
 * Generates evidence-backed, actionable recommendations based on experiment analysis.
 */
export function generateRecommendations(
  experiment: Experiment,
  analysis: ExperimentAnalysisResult,
  variants: ExperimentVariant[]
): ExperimentRecommendation[] {
  const recommendations: ExperimentRecommendation[] = [];
  const createdAt = new Date().toISOString();

  const getVariantName = (id: string): string => {
    return variants.find(v => v.id === id)?.name || id;
  };

  const getVariantKey = (id: string): string => {
    return variants.find(v => v.id === id)?.variantKey || id;
  };

  // 1. Check for guardrail violation
  if (analysis.resultStatus === AnalysisResultStatus.GUARDRAIL_VIOLATION) {
    recommendations.push({
      id: `rec-stop-guardrail-${experiment.id}-${Date.now()}`,
      experimentId: experiment.id,
      recommendationType: 'stop_guardrail_violation',
      text: 'Stop the experiment immediately due to guardrail violation.',
      evidence: [
        'High-severity guardrail violations were detected.',
        ...analysis.warnings
      ],
      confidence: 0.99,
      risk: 'Continuing to run this experiment may degrade primary business metrics or violate brand rules.',
      expectedEffect: 'Prevents further conversion decline, brand-safety penalties, or budget overrun.',
      userDecisionRequired: true,
      targetEntities: { experimentId: experiment.id },
      status: RecommendationStatus.PROPOSED,
      createdAt,
      updatedAt: createdAt
    });
    return recommendations;
  }

  // 2. Check for insufficient sample size / runtime
  if (analysis.resultStatus === AnalysisResultStatus.INSUFFICIENT_SAMPLE) {
    recommendations.push({
      id: `rec-continue-${experiment.id}-${Date.now()}`,
      experimentId: experiment.id,
      recommendationType: 'continue_collection',
      text: 'Continue collecting observations to meet statistical requirements.',
      evidence: [
        'The experiment has not met either the minimum sample size or minimum runtime bounds.',
        ...analysis.warnings
      ],
      confidence: 0.90,
      risk: 'Ending the experiment prematurely increases the risk of making false-positive or false-negative decisions.',
      expectedEffect: 'Ensures reliable, high-power statistical insights once required thresholds are met.',
      userDecisionRequired: false,
      targetEntities: { experimentId: experiment.id },
      status: RecommendationStatus.PROPOSED,
      createdAt,
      updatedAt: createdAt
    });
    return recommendations;
  }

  // 3. Winner Declared
  if (analysis.resultStatus === AnalysisResultStatus.WINNER && analysis.winnerVariantId) {
    const winnerId = analysis.winnerVariantId;
    const winnerName = getVariantName(winnerId);
    const relLift = analysis.relativeLift[winnerId] || 0;
    const pVal = analysis.pValue?.[winnerId];
    const winningVariant = variants.find(v => v.id === winnerId);

    recommendations.push({
      id: `rec-declare-winner-${experiment.id}-${Date.now()}`,
      experimentId: experiment.id,
      recommendationType: 'declare_winner',
      text: `Declare variant "${winnerName}" as the winner and deploy it.`,
      evidence: [
        `Variant "${winnerName}" exhibited a statistically significant relative lift of ${(relLift * 100).toFixed(1)}% over control.`,
        `Primary metric value increased from ${(analysis.observedValues[analysis.controlVariantId] || 0).toFixed(4)} to ${(analysis.observedValues[winnerId] || 0).toFixed(4)}.`,
        `Difference is statistically significant with p-value of ${pVal?.toFixed(5) || 'N/A'}.`
      ],
      confidence: 0.95,
      risk: 'Minimal risk of a false positive, well within configured confidence limits.',
      expectedEffect: `Expected long-term lift of ${(relLift * 100).toFixed(1)}% on primary metric "${experiment.primaryMetric}".`,
      userDecisionRequired: true,
      targetEntities: {
        experimentId: experiment.id,
        winnerVariantId: winnerId,
        promptHistoryId: winningVariant?.promptHistoryId || '',
        campaignId: winningVariant?.campaignId || '',
        cloudAssetId: winningVariant?.cloudAssetId || ''
      },
      status: RecommendationStatus.PROPOSED,
      createdAt,
      updatedAt: createdAt
    });

    // Suggest reuse of prompt or template structures
    if (winningVariant?.promptHistoryId) {
      recommendations.push({
        id: `rec-reuse-prompt-${experiment.id}-${Date.now()}`,
        experimentId: experiment.id,
        recommendationType: 'reuse_prompt_structure',
        text: `Reuse the prompt structure from variant "${winnerName}" for future creative plans.`,
        evidence: [
          `Prompt History Item ${winningVariant.promptHistoryId} is part of the winning variant configuration.`,
          `This prompt structure demonstrated stable relative performance gains.`
        ],
        confidence: 0.85,
        risk: 'Direct copying may cause creative fatigue over time; ensure brand variation is introduced.',
        expectedEffect: 'Preserves the creative angle that drove higher conversion rates.',
        userDecisionRequired: true,
        targetEntities: { promptHistoryId: winningVariant.promptHistoryId },
        status: RecommendationStatus.PROPOSED,
        createdAt,
        updatedAt: createdAt
      });
    }

    // Suggest cross-platform testing
    recommendations.push({
      id: `rec-cross-platform-${experiment.id}-${Date.now()}`,
      experimentId: experiment.id,
      recommendationType: 'test_cross_platform',
      text: `Test the winning variant "${winnerName}" on another platform.`,
      evidence: [
        `Variant "${winnerName}" is highly optimized for platform "${experiment.platform || 'original platform'}".`,
        'Verifying this creative concept on alternative networks can validate structural cross-channel appeal.'
      ],
      confidence: 0.80,
      risk: 'Platform audiences vary; performance might not translate directly.',
      expectedEffect: 'Multiplies aggregate conversion gains across channels.',
      userDecisionRequired: true,
      targetEntities: { experimentId: experiment.id },
      status: RecommendationStatus.PROPOSED,
      createdAt,
      updatedAt: createdAt
    });
  }

  // 4. No Difference / Inconclusive
  if (analysis.resultStatus === AnalysisResultStatus.NO_DIFFERENCE) {
    recommendations.push({
      id: `rec-preserve-control-${experiment.id}-${Date.now()}`,
      experimentId: experiment.id,
      recommendationType: 'preserve_control',
      text: 'Preserve the control variant as no meaningful performance difference exists.',
      evidence: [
        'Evaluated variant(s) did not exhibit statistically or practically significant lift compared to control.',
        'Observed difference falls below the minimum detectable effect constraint.'
      ],
      confidence: 0.95,
      risk: 'None. Prevents unnecessary costs and complexities of deploying a variant that provides no actual lift.',
      expectedEffect: 'Maintains system stability on established creative lines.',
      userDecisionRequired: true,
      targetEntities: { controlVariantId: analysis.controlVariantId },
      status: RecommendationStatus.PROPOSED,
      createdAt,
      updatedAt: createdAt
    });

    recommendations.push({
      id: `rec-stronger-hook-${experiment.id}-${Date.now()}`,
      experimentId: experiment.id,
      recommendationType: 'test_stronger_hook',
      text: 'Design a follow-up experiment testing a significantly more distinct hook or call to action.',
      evidence: [
        'The similarity in performance indicates that the variant changes tested were too subtle to drive user behavior shifts.',
        'Stronger visual or emotional hooks typically yield wider performance deltas.'
      ],
      confidence: 0.85,
      risk: 'A more aggressive hook might attract temporary clicks but watch time could vary.',
      expectedEffect: 'Breaks through the current performance ceiling by introducing a high-contrast creative change.',
      userDecisionRequired: true,
      targetEntities: { experimentId: experiment.id },
      status: RecommendationStatus.PROPOSED,
      createdAt,
      updatedAt: createdAt
    });
  }

  if (analysis.resultStatus === AnalysisResultStatus.INCONCLUSIVE) {
    recommendations.push({
      id: `rec-followup-exp-${experiment.id}-${Date.now()}`,
      experimentId: experiment.id,
      recommendationType: 'create_followup_experiment',
      text: 'Design a follow-up experiment with high-contrast variants or different objective metrics.',
      evidence: [
        'Statistical analysis yielded inconclusive results despite adequate sample size.',
        'Confounding factors or high variance might have obscured variant differences.'
      ],
      confidence: 0.80,
      risk: 'Requires additional time and design effort.',
      expectedEffect: 'Resolves creative ambiguity with a clearer experimental layout.',
      userDecisionRequired: true,
      targetEntities: { experimentId: experiment.id },
      status: RecommendationStatus.PROPOSED,
      createdAt,
      updatedAt: createdAt
    });
  }

  return recommendations;
}
