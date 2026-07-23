import { Experiment, ExperimentStatus, ExperimentVariant } from './types';
import { validateExperimentDesign } from './experimentDesignValidator';

/**
 * Checks if a transition between two experiment statuses is valid.
 */
export function isValidTransition(current: ExperimentStatus, target: ExperimentStatus): boolean {
  if (current === target) return true;

  // Archived is terminal: nothing can transition out of archived
  if (current === ExperimentStatus.ARCHIVED) {
    return false;
  }

  // Completed experiments cannot return to running
  if (current === ExperimentStatus.COMPLETED && target === ExperimentStatus.RUNNING) {
    return false;
  }

  const allowedTransitions: Record<ExperimentStatus, ExperimentStatus[]> = {
    [ExperimentStatus.DRAFT]: [ExperimentStatus.READY, ExperimentStatus.ARCHIVED],
    [ExperimentStatus.READY]: [ExperimentStatus.RUNNING, ExperimentStatus.ARCHIVED],
    [ExperimentStatus.RUNNING]: [ExperimentStatus.PAUSED, ExperimentStatus.EVALUATING, ExperimentStatus.STOPPED, ExperimentStatus.FAILED],
    [ExperimentStatus.PAUSED]: [ExperimentStatus.RUNNING, ExperimentStatus.STOPPED, ExperimentStatus.ARCHIVED],
    [ExperimentStatus.EVALUATING]: [ExperimentStatus.COMPLETED, ExperimentStatus.INCONCLUSIVE, ExperimentStatus.RUNNING, ExperimentStatus.STOPPED, ExperimentStatus.FAILED],
    [ExperimentStatus.COMPLETED]: [ExperimentStatus.ARCHIVED],
    [ExperimentStatus.INCONCLUSIVE]: [ExperimentStatus.ARCHIVED],
    [ExperimentStatus.STOPPED]: [ExperimentStatus.ARCHIVED],
    [ExperimentStatus.FAILED]: [ExperimentStatus.READY, ExperimentStatus.ARCHIVED],
    [ExperimentStatus.ARCHIVED]: [],
  };

  return allowedTransitions[current]?.includes(target) || false;
}

/**
 * Transitions an experiment to a new status, performing checks and updating timestamps.
 */
export function transitionExperiment(
  experiment: Experiment,
  targetStatus: ExperimentStatus,
  variants: ExperimentVariant[] = []
): { success: boolean; experiment?: Experiment; error?: string } {
  const currentStatus = experiment.status;

  if (!isValidTransition(currentStatus, targetStatus)) {
    return {
      success: false,
      error: `Invalid transition from ${currentStatus} to ${targetStatus}.`
    };
  }

  // Deep clone experiment to avoid mutation
  const updated: Experiment = {
    ...experiment,
    status: targetStatus,
    updatedAt: new Date().toISOString()
  };

  // State-specific validations & transitions
  if (targetStatus === ExperimentStatus.READY) {
    // Run validation design check before making it ready
    const validation = validateExperimentDesign(experiment, variants);
    if (validation.errors.length > 0) {
      return {
        success: false,
        error: `Cannot transition to READY. Design validation failed with errors: ${validation.errors.join(' | ')}`
      };
    }
  }

  if (targetStatus === ExperimentStatus.RUNNING) {
    // Transitioning to RUNNING: must be READY or PAUSED (or EVALUATING rollback)
    // Validate design to make absolutely sure nothing became invalid
    const validation = validateExperimentDesign(experiment, variants);
    if (validation.errors.length > 0) {
      return {
        success: false,
        error: `Cannot start experiment. Design is invalid: ${validation.errors.join(' | ')}`
      };
    }

    if (!updated.startAt) {
      updated.startAt = new Date().toISOString();
    }
  }

  if (targetStatus === ExperimentStatus.STOPPED) {
    updated.stoppedAt = new Date().toISOString();
  }

  if (targetStatus === ExperimentStatus.COMPLETED || targetStatus === ExperimentStatus.INCONCLUSIVE) {
    updated.completedAt = new Date().toISOString();
  }

  if (targetStatus === ExperimentStatus.ARCHIVED) {
    updated.archivedAt = new Date().toISOString();
  }

  return {
    success: true,
    experiment: updated
  };
}
