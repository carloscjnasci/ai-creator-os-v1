import { publishCreativeEvent, subscribeToCreativeEvents, CreativeEvent } from '@/core/events/creativeEventBus';
import { saveSnapshots, saveScorecards, saveInsights, saveRecommendations, saveDecisions } from './analyticsFeedbackStorage';

/**
 * Event emission helpers
 */
export function publishSnapshotCreated(payload: { snapshotId: string; workspaceId: string }) {
  publishCreativeEvent('analytics.snapshot.created', payload);
}

export function publishSnapshotValidated(payload: { snapshotId: string; workspaceId: string }) {
  publishCreativeEvent('analytics.snapshot.validated', payload);
}

export function publishSnapshotNormalized(payload: { snapshotId: string; workspaceId: string }) {
  publishCreativeEvent('analytics.snapshot.normalized', payload);
}

export function publishSnapshotAttributed(payload: { snapshotId: string; workspaceId: string }) {
  publishCreativeEvent('analytics.snapshot.attributed', payload);
}

export function publishScorecardGenerated(payload: { scorecardId: string; snapshotId: string }) {
  publishCreativeEvent('analytics.scorecard.generated', payload);
}

export function publishOutlierDetected(payload: { snapshotId: string; metric: string; lift: number }) {
  publishCreativeEvent('analytics.outlier.detected', payload);
}

export function publishInsightCreated(payload: { insightId: string; category: string }) {
  publishCreativeEvent('analytics.insight.created', payload);
}

export function publishRecommendationCreated(payload: { recommendationId: string; type: string }) {
  publishCreativeEvent('analytics.recommendation.created', payload);
}

export function publishRecommendationAccepted(payload: { recommendationId: string }) {
  publishCreativeEvent('analytics.recommendation.accepted', payload);
}

export function publishRecommendationRejected(payload: { recommendationId: string }) {
  publishCreativeEvent('analytics.recommendation.rejected', payload);
}

export function publishFeedbackApplied(payload: { recommendationId: string; entityId: string }) {
  publishCreativeEvent('analytics.feedback.applied', payload);
}

export function publishSyncFailed(payload: { connectionId: string; error: string }) {
  publishCreativeEvent('analytics.sync.failed', payload);
}

/**
 * Global consumer for system events that trigger or affect Analytics Feedback
 */
export function initializeAnalyticsEventConsumer(): () => void {
  return subscribeToCreativeEvents((event: CreativeEvent) => {
    switch (event.name) {
      case 'workspace.cleared':
        // Clear all analytics feedback localStorage keys
        saveSnapshots([]);
        saveScorecards([]);
        saveInsights([]);
        saveRecommendations([]);
        saveDecisions([]);
        console.log('[AnalyticsFeedback] Cleared all feedback loop storage on workspace clearance.');
        break;

      case 'asset.ready':
        // An asset was successfully processed. Prepare the loop to monitor subsequent metrics.
        console.log('[AnalyticsFeedback] Asset ready, preparing performance monitors.', event.payload);
        break;

      case 'publishing.published':
        // A publication was successful. Create initial performance snapshot or schedule tracking.
        console.log('[AnalyticsFeedback] Content published successfully. Performance snapshot lifecycle ready.', event.payload);
        break;

      case 'publishing.failed':
        // Log failure
        console.log('[AnalyticsFeedback] Publishing failed. Recording failure state.', event.payload);
        break;

      default:
        break;
    }
  });
}
