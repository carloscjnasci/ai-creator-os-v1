import { publishCreativeEvent, subscribeToCreativeEvents, CreativeEvent } from '@/core/events/creativeEventBus';
import { clearAllRecipeStorageKeys } from './recipeStorage';

export function publishRecipeCreated(payload: { recipeId: string; workspaceId: string }) {
  publishCreativeEvent('recipe.created', payload);
}

export function publishRecipeVersionCreated(payload: { recipeId: string; versionId: string }) {
  publishCreativeEvent('recipe.version.created', payload);
}

export function publishRecipeValidated(payload: { recipeId: string; versionId: string; valid: boolean }) {
  publishCreativeEvent('recipe.validated', payload);
}

export function publishRecipeActivated(payload: { recipeId: string; versionId: string }) {
  publishCreativeEvent('recipe.activated', payload);
}

export function publishRecipeDeprecated(payload: { recipeId: string }) {
  publishCreativeEvent('recipe.deprecated', payload);
}

export function publishRecipeArchived(payload: { recipeId: string }) {
  publishCreativeEvent('recipe.archived', payload);
}

export function publishRecipePreviewGenerated(payload: { recipeId: string; versionId: string; fingerprint: string }) {
  publishCreativeEvent('recipe.preview.generated', payload);
}

export function publishRecipeApplicationCreated(payload: { applicationId: string; recipeId: string }) {
  publishCreativeEvent('recipe.application.created', payload);
}

export function publishRecipeApplicationCompleted(payload: { applicationId: string; recipeId: string }) {
  publishCreativeEvent('recipe.application.completed', payload);
}

export function publishRecipeApplicationFailed(payload: { applicationId: string; recipeId: string; error: string }) {
  publishCreativeEvent('recipe.application.failed', payload);
}

export function publishRecipeEvidenceAdded(payload: { evidenceId: string; recipeId: string }) {
  publishCreativeEvent('recipe.evidence.added', payload);
}

export function publishRecipeScorecardGenerated(payload: { scorecardId: string; recipeId: string }) {
  publishCreativeEvent('recipe.scorecard.generated', payload);
}

export function publishRecipeRecommendationCreated(payload: { recommendationId: string; workspaceId: string }) {
  publishCreativeEvent('recipe.recommendation.created', payload);
}

export function publishRecipeRecommendationAccepted(payload: { recommendationId: string; workspaceId: string }) {
  publishCreativeEvent('recipe.recommendation.accepted', payload);
}

export function publishRecipeRecommendationRejected(payload: { recommendationId: string; workspaceId: string }) {
  publishCreativeEvent('recipe.recommendation.rejected', payload);
}

let activeSubscription: (() => void) | null = null;
let refCount = 0;

/**
 * Returns the current active subscriber reference count for testing.
 */
export function getRecipeEventConsumerRefCount(): number {
  return refCount;
}

/**
 * Resets the consumer state completely. Useful for test cleanup.
 */
export function resetRecipeEventConsumer(): void {
  if (activeSubscription) {
    activeSubscription();
    activeSubscription = null;
  }
  refCount = 0;
}

/**
 * Initializes the global event listener for systems affecting the Creative Recipes feature.
 * Employs a module-level shared subscription and reference counting.
 */
export function initializeRecipeEventConsumer(): () => void {
  refCount++;
  if (!activeSubscription) {
    activeSubscription = subscribeToCreativeEvents((event: CreativeEvent) => {
      switch (event.name) {
        case 'workspace.cleared':
          console.log('[Recipes] Cleared all recipe storage keys on workspace clearance.');
          clearAllRecipeStorageKeys();
          break;

        case 'experiment.analysis.completed':
          console.log('[Recipes] Received experiment.analysis.completed event for', event.payload);
          break;

        case 'experiment.decision.applied':
          console.log('[Recipes] Received experiment.decision.applied event for', event.payload);
          break;

        case 'analytics.recommendation.accepted':
          console.log('[Recipes] Received analytics.recommendation.accepted event for', event.payload);
          break;

        case 'prompt.version.created':
          console.log('[Recipes] Received prompt.version.created event for', event.payload);
          break;

        case 'campaign.completed':
          console.log('[Recipes] Received campaign.completed event for', event.payload);
          break;

        default:
          // Other events ignored
          break;
      }
    });
  }

  let cleanedUp = false;
  return () => {
    if (cleanedUp) return;
    cleanedUp = true;
    refCount--;
    if (refCount <= 0) {
      refCount = 0;
      if (activeSubscription) {
        activeSubscription();
        activeSubscription = null;
      }
    }
  };
}
