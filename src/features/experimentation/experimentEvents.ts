import { publishCreativeEvent, subscribeToCreativeEvents, CreativeEvent } from '@/core/events/creativeEventBus';
import { 
  saveExperiments, 
  saveVariants, 
  saveObservations, 
  saveAssignments, 
  saveAnalyses, 
  saveRecommendations, 
  saveDecisions,
  loadExperiments,
  loadVariants,
  loadObservations,
  clearWorkspaceExperimentationData
} from './experimentStorage';
import { ExperimentStatus, ExperimentObservation, MetricType } from './types';
import { loadPublicationDrafts } from '@/features/publishing-hub/lib/publishingStorage';
import { convertSnapshotToObservations } from './integrations';

export function publishExperimentCreated(payload: { experimentId: string; workspaceId: string }) {
  publishCreativeEvent('experiment.created', payload);
}

export function publishExperimentReady(payload: { experimentId: string }) {
  publishCreativeEvent('experiment.ready', payload);
}

export function publishExperimentStarted(payload: { experimentId: string }) {
  publishCreativeEvent('experiment.started', payload);
}

export function publishExperimentPaused(payload: { experimentId: string }) {
  publishCreativeEvent('experiment.paused', payload);
}

export function publishExperimentStopped(payload: { experimentId: string }) {
  publishCreativeEvent('experiment.stopped', payload);
}

export function publishExperimentEvaluationRequested(payload: { experimentId: string }) {
  publishCreativeEvent('experiment.evaluation.requested', payload);
}

export function publishExperimentAnalysisCompleted(payload: { experimentId: string; status: string }) {
  publishCreativeEvent('experiment.analysis.completed', payload);
}

export function publishExperimentWinnerDetected(payload: { experimentId: string; winnerVariantId: string }) {
  publishCreativeEvent('experiment.winner.detected', payload);
}

export function publishExperimentInconclusive(payload: { experimentId: string; reason: string }) {
  publishCreativeEvent('experiment.inconclusive', payload);
}

export function publishExperimentGuardrailViolated(payload: { experimentId: string; guardrails: string[] }) {
  publishCreativeEvent('experiment.guardrail.violated', payload);
}

export function publishRecommendationCreated(payload: { recommendationId: string; experimentId: string }) {
  publishCreativeEvent('experiment.recommendation.created', payload);
}

export function publishRecommendationAccepted(payload: { recommendationId: string; experimentId: string }) {
  publishCreativeEvent('experiment.recommendation.accepted', payload);
}

export function publishRecommendationRejected(payload: { recommendationId: string; experimentId: string }) {
  publishCreativeEvent('experiment.recommendation.rejected', payload);
}

export function publishDecisionApplied(payload: { recommendationId: string; targetEntityId: string }) {
  publishCreativeEvent('experiment.decision.applied', payload);
}

/**
 * Global consumer for system events that affect the Experimentation Engine.
 */
export function initializeExperimentEventConsumer(): () => void {
  return subscribeToCreativeEvents((event: CreativeEvent) => {
    switch (event.name) {
      case 'workspace.cleared':
        clearWorkspaceExperimentationData();
        console.log('[Experimentation] Cleared all experiment storage keys on workspace clearance.');
        break;

      case 'analytics.snapshot.analyzed': {
        const payload = event.payload as any;
        if (payload) {
          const snapshot = payload.snapshot || payload.performanceSnapshot || payload;
          const variantId = payload.variantId || snapshot?.variantId || snapshot?.metadata?.variantId;
          
          if (variantId && snapshot) {
            convertSnapshotToObservations(snapshot, variantId);
          }
        }
        break;
      }

      case 'publishing.job.succeeded':
      case 'publishing.published': {
        const payload = event.payload as any;
        const publicationId = payload?.publicationId || payload?.draftId;
        if (!publicationId) break;
        
        const drafts = loadPublicationDrafts();
        const draft = drafts.find(d => d.id === publicationId);
        if (!draft) break;

        const experiments = loadExperiments();
        const experiment = draft.campaignId ? experiments.find(e => e.campaignId === draft.campaignId) : undefined;
        if (!experiment) break;

        const variants = loadVariants();
        const expVariants = variants.filter(v => v.experimentId === experiment.id);

        const targetVariant = expVariants.find(v => v.creativeLibraryAssetId === draft.creativeAssetId || v.campaignId === draft.campaignId);
        if (targetVariant) {
          // Update or preserve publication lineage on the variant without fabricating performance metrics
          if (targetVariant.publicationDraftId !== publicationId) {
            targetVariant.publicationDraftId = publicationId;
            const updatedVariants = variants.map(v => v.id === targetVariant.id ? targetVariant : v);
            saveVariants(updatedVariants);
          }
        }
        break;
      }

      case 'publishing.job.failed':
      case 'publishing.failed': {
        const payload = event.payload as any;
        const publicationId = payload?.publicationId || payload?.draftId;
        if (!publicationId) break;

        const drafts = loadPublicationDrafts();
        const draft = drafts.find(d => d.id === publicationId);
        if (!draft) break;

        const experiments = loadExperiments();
        const experiment = draft.campaignId ? experiments.find(e => e.campaignId === draft.campaignId) : undefined;
        if (!experiment) break;

        const variants = loadVariants();
        const expVariants = variants.filter(v => v.experimentId === experiment.id);

        const targetVariant = expVariants.find(v => v.creativeLibraryAssetId === draft.creativeAssetId || v.campaignId === draft.campaignId);
        if (targetVariant) {
          // Update or preserve publication lineage on the variant without fabricating performance metrics
          if (targetVariant.publicationDraftId !== publicationId) {
            targetVariant.publicationDraftId = publicationId;
            const updatedVariants = variants.map(v => v.id === targetVariant.id ? targetVariant : v);
            saveVariants(updatedVariants);
          }
        }
        break;
      }

      case 'asset.ready':
        console.log('[Experimentation] Creative asset ready. Available for experiment variants.', event.payload);
        break;

      case 'prompt.version.created':
        console.log('[Experimentation] Prompt version created. Eligible for prompt comparison experiments.', event.payload);
        break;

      case 'campaign.completed':
        console.log('[Experimentation] Campaign completed. Aggregating final test boundaries.', event.payload);
        break;

      default:
        break;
    }
  });
}
