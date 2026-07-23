export const CREATIVE_OS_EVENT = 'ai-creator-os:creative-event';

export type CreativeEventName =
  | 'intent.created'
  | 'plan.created'
  | 'campaign.workflow.updated'
  | 'viral.analysis.completed'
  | 'prompt.optimized'
  | 'asset.created'
  | 'digital-human.updated'
  | 'execution.run.created'
  | 'execution.run.updated'
  | 'execution.task.updated'
  | 'provider.job.created'
  | 'provider.job.updated'
  | 'provider.job.completed'
  // Asset Pipeline Events
  | 'asset.ingestion.created'
  | 'asset.ingestion.started'
  | 'asset.processing.started'
  | 'asset.ready'
  | 'asset.failed'
  | 'asset.retry.requested'
  | 'asset.cancelled'
  | 'asset.archived'
  | 'asset.restored'
  | 'asset.deletion.requested'
  | 'asset.deleted'
  | 'asset.derivative.created'
  | 'asset.signed_url.requested'
  // Consumption contracts
  | 'provider.job.succeeded'
  | 'provider.job.failed'
  | 'publishing.job.succeeded'
  | 'publishing.job.failed'
  | 'campaign.completed'
  | 'prompt.version.created'
  | 'execution.task.completed'
  | 'campaign.archived'
  | 'workspace.cleared'
  // Publishing Hub Events
  | 'publishing.draft.created'
  | 'publishing.validation.completed'
  | 'publishing.approval.requested'
  | 'publishing.approved'
  | 'publishing.rejected'
  | 'publishing.scheduled'
  | 'publishing.started'
  | 'publishing.published'
  | 'publishing.failed'
  | 'publishing.retry.requested'
  | 'publishing.cancelled'
  | 'publishing.archived'
  | 'publishing.restored'
  | 'publishing.metrics.requested'
  // Analytics Feedback Loop Events
  | 'analytics.snapshot.created'
  | 'analytics.snapshot.validated'
  | 'analytics.snapshot.normalized'
  | 'analytics.snapshot.attributed'
  | 'analytics.snapshot.analyzed'
  | 'analytics.scorecard.generated'
  | 'analytics.outlier.detected'
  | 'analytics.insight.created'
  | 'analytics.recommendation.created'
  | 'analytics.recommendation.accepted'
  | 'analytics.recommendation.rejected'
  | 'analytics.feedback.applied'
  | 'analytics.sync.failed'
  // Experimentation A/B Testing Engine Events
  | 'experiment.created'
  | 'experiment.ready'
  | 'experiment.started'
  | 'experiment.paused'
  | 'experiment.stopped'
  | 'experiment.evaluation.requested'
  | 'experiment.analysis.completed'
  | 'experiment.winner.detected'
  | 'experiment.inconclusive'
  | 'experiment.guardrail.violated'
  | 'experiment.recommendation.created'
  | 'experiment.recommendation.accepted'
  | 'experiment.recommendation.rejected'
  | 'experiment.decision.applied'
  // Creative Recipes Events
  | 'recipe.created'
  | 'recipe.version.created'
  | 'recipe.validated'
  | 'recipe.activated'
  | 'recipe.deprecated'
  | 'recipe.archived'
  | 'recipe.preview.generated'
  | 'recipe.application.created'
  | 'recipe.application.completed'
  | 'recipe.application.failed'
  | 'recipe.evidence.added'
  | 'recipe.scorecard.generated'
  | 'recipe.recommendation.created'
  | 'recipe.recommendation.accepted'
  | 'recipe.recommendation.rejected';

export interface CreativeEvent<T = unknown> {
  name: CreativeEventName;
  payload: T;
  occurredAt: string;
}

export function publishCreativeEvent<T>(name: CreativeEventName, payload: T): void {
  if (typeof window === 'undefined') {
    return;
  }

  const event: CreativeEvent<T> = {
    name,
    payload,
    occurredAt: new Date().toISOString(),
  };

  window.dispatchEvent(new CustomEvent(CREATIVE_OS_EVENT, { detail: event }));
}

export function subscribeToCreativeEvents(
  listener: (event: CreativeEvent) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<CreativeEvent>;
    listener(customEvent.detail);
  };

  window.addEventListener(CREATIVE_OS_EVENT, handler);
  return () => window.removeEventListener(CREATIVE_OS_EVENT, handler);
}
