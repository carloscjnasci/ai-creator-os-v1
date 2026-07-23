import { 
  Experiment, 
  ExperimentVariant, 
  ExperimentObservation,
  ExperimentStatus, 
  ExperimentAnalysisResult, 
  ExperimentRecommendation, 
  RecommendationStatus, 
  AnalysisResultStatus,
  ExperimentDecision,
  DecisionAction
} from './types';
import { 
  loadExperiments, 
  saveExperiments, 
  loadVariants, 
  saveVariants, 
  loadObservations, 
  saveObservations, 
  loadAnalyses, 
  saveAnalyses, 
  loadRecommendations, 
  saveRecommendations,
  loadDecisions,
  saveDecisions
} from './experimentStorage';
import { createId } from '@/core/id';
import { loadPublicationDrafts, savePublicationDrafts } from '@/features/publishing-hub/lib/publishingStorage';
import { loadPromptHistoryFromStorage, savePromptHistoryToStorage } from '@/features/prompt-engine/promptHistoryStorage';
import { transitionExperiment } from './experimentLifecycle';
import { validateExperimentDesign } from './experimentDesignValidator';
import { analyzeExperiment } from './experimentAnalyzer';
import { generateRecommendations } from './experimentRecommendationEngine';
import { 
  publishExperimentCreated, 
  publishExperimentReady, 
  publishExperimentStarted, 
  publishExperimentPaused, 
  publishExperimentStopped, 
  publishExperimentEvaluationRequested, 
  publishExperimentAnalysisCompleted, 
  publishExperimentWinnerDetected, 
  publishExperimentInconclusive, 
  publishExperimentGuardrailViolated, 
  publishRecommendationCreated, 
  publishRecommendationAccepted, 
  publishRecommendationRejected 
} from './experimentEvents';

/**
 * Creates and saves a new experiment with its variants.
 */
export function createAndSaveExperiment(
  experimentData: Omit<Experiment, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
  variantsData: Omit<ExperimentVariant, 'id' | 'experimentId' | 'createdAt' | 'updatedAt'>[]
): { success: boolean; experiment?: Experiment; variants?: ExperimentVariant[]; error?: string } {
  const experiments = loadExperiments();
  const variants = loadVariants();

  const experimentId = `exp-${Date.now()}`;
  const timestamp = new Date().toISOString();

  // Create variants first to run validation
  const newVariants: ExperimentVariant[] = variantsData.map((v, index) => ({
    ...v,
    id: `var-${experimentId}-${index}-${Date.now()}`,
    experimentId,
    createdAt: timestamp,
    updatedAt: timestamp
  }));

  const initialStatus = ExperimentStatus.DRAFT;

  const newExperiment: Experiment = {
    ...experimentData,
    id: experimentId,
    status: initialStatus,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  // Run validation
  const validation = validateExperimentDesign(newExperiment, newVariants);
  
  // Set status to ready if design has zero errors
  if (validation.errors.length === 0) {
    newExperiment.status = ExperimentStatus.READY;
  }

  // Save to storage
  const updatedExps = [...experiments, newExperiment];
  const updatedVars = [...variants, ...newVariants];

  const expsSaved = saveExperiments(updatedExps);
  if (!expsSaved) {
    return { success: false, error: 'Failed to write experiment to localStorage quota.' };
  }

  const varsSaved = saveVariants(updatedVars);
  if (!varsSaved) {
    // Atomic Rollback
    saveExperiments(experiments);
    return { success: false, error: 'Failed to write variants to localStorage quota.' };
  }

  // Publish events
  publishExperimentCreated({ experimentId, workspaceId: newExperiment.workspaceId });
  if (newExperiment.status === ExperimentStatus.READY) {
    publishExperimentReady({ experimentId });
  }

  return {
    success: true,
    experiment: newExperiment,
    variants: newVariants
  };
}

/**
 * Starts an experiment.
 */
export function startWorkflow(experimentId: string): { success: boolean; experiment?: Experiment; error?: string } {
  const experiments = loadExperiments();
  const variants = loadVariants();

  const index = experiments.findIndex(e => e.id === experimentId);
  if (index === -1) {
    return { success: false, error: 'Experiment not found.' };
  }

  const expVariants = variants.filter(v => v.experimentId === experimentId);
  const transition = transitionExperiment(experiments[index], ExperimentStatus.RUNNING, expVariants);

  if (!transition.success || !transition.experiment) {
    return { success: false, error: transition.error };
  }

  experiments[index] = transition.experiment;
  if (!saveExperiments(experiments)) {
    return { success: false, error: 'Quota exceeded. Failed to save starting state.' };
  }

  publishExperimentStarted({ experimentId });
  return { success: true, experiment: transition.experiment };
}

/**
 * Pauses an experiment.
 */
export function pauseWorkflow(experimentId: string): { success: boolean; experiment?: Experiment; error?: string } {
  const experiments = loadExperiments();
  const index = experiments.findIndex(e => e.id === experimentId);
  if (index === -1) {
    return { success: false, error: 'Experiment not found.' };
  }

  const transition = transitionExperiment(experiments[index], ExperimentStatus.PAUSED);
  if (!transition.success || !transition.experiment) {
    return { success: false, error: transition.error };
  }

  experiments[index] = transition.experiment;
  if (!saveExperiments(experiments)) {
    return { success: false, error: 'Quota exceeded. Failed to save paused state.' };
  }

  publishExperimentPaused({ experimentId });
  return { success: true, experiment: transition.experiment };
}

/**
 * Stops an experiment.
 */
export function stopWorkflow(experimentId: string): { success: boolean; experiment?: Experiment; error?: string } {
  const experiments = loadExperiments();
  const index = experiments.findIndex(e => e.id === experimentId);
  if (index === -1) {
    return { success: false, error: 'Experiment not found.' };
  }

  const transition = transitionExperiment(experiments[index], ExperimentStatus.STOPPED);
  if (!transition.success || !transition.experiment) {
    return { success: false, error: transition.error };
  }

  experiments[index] = transition.experiment;
  if (!saveExperiments(experiments)) {
    return { success: false, error: 'Quota exceeded. Failed to save stopped state.' };
  }

  publishExperimentStopped({ experimentId });
  return { success: true, experiment: transition.experiment };
}

/**
 * Runs statistical evaluation on observations, updates status, and generates recommendations.
 */
export function evaluateAndRecommendWorkflow(
  experimentId: string
): { success: boolean; analysis?: ExperimentAnalysisResult; recommendations?: ExperimentRecommendation[]; error?: string } {
  const originalExperiments = loadExperiments();
  const index = originalExperiments.findIndex(e => e.id === experimentId);
  if (index === -1) {
    return { success: false, error: 'Experiment not found.' };
  }

  const originalAnalyses = loadAnalyses();
  const originalRecommendations = loadRecommendations();
  
  const variants = loadVariants();
  const observations = loadObservations();

  const experiment = originalExperiments[index];
  const expVariants = variants.filter(v => v.experimentId === experimentId);

  // Run the analysis
  const analysis = analyzeExperiment(experiment, expVariants, observations);

  // Transition status based on result status
  let nextStatus = experiment.status;
  if (analysis.resultStatus === AnalysisResultStatus.WINNER) {
    nextStatus = ExperimentStatus.COMPLETED;
  } else if (analysis.resultStatus === AnalysisResultStatus.NO_DIFFERENCE || analysis.resultStatus === AnalysisResultStatus.INCONCLUSIVE) {
    nextStatus = ExperimentStatus.INCONCLUSIVE;
  } else if (analysis.resultStatus === AnalysisResultStatus.GUARDRAIL_VIOLATION) {
    nextStatus = ExperimentStatus.STOPPED;
  } else if (analysis.resultStatus === AnalysisResultStatus.INVALID_DATA) {
    nextStatus = ExperimentStatus.FAILED;
  }

  const transition = transitionExperiment(experiment, nextStatus, expVariants);
  
  const updatedExperiments = [...originalExperiments];
  if (transition.success && transition.experiment) {
    updatedExperiments[index] = transition.experiment;
  }

  // Save Analysis Result
  const updatedAnalyses = originalAnalyses.filter(a => a.experimentId !== experimentId).concat(analysis);

  // Generate recommendations
  const recommendations = generateRecommendations(experiment, analysis, expVariants);
  const updatedRecommendations = originalRecommendations.filter(r => r.experimentId !== experimentId).concat(recommendations);

  // Atomic storage writes
  const expsSaved = saveExperiments(updatedExperiments);
  if (!expsSaved) {
    return { success: false, error: 'Quota exceeded. Failed to save experiment status.' };
  }

  const analysesSaved = saveAnalyses(updatedAnalyses);
  if (!analysesSaved) {
    // Rollback experiments
    saveExperiments(originalExperiments);
    return { success: false, error: 'Quota exceeded. Failed to save analysis.' };
  }

  const recsSaved = saveRecommendations(updatedRecommendations);
  if (!recsSaved) {
    // Rollback analyses and experiments
    saveAnalyses(originalAnalyses);
    saveExperiments(originalExperiments);
    return { success: false, error: 'Quota exceeded. Failed to save recommendations.' };
  }

  // Publish evaluation request event
  publishExperimentEvaluationRequested({ experimentId });

  // Publish analysis outcome events
  publishExperimentAnalysisCompleted({ experimentId, status: analysis.resultStatus });

  if (analysis.resultStatus === AnalysisResultStatus.WINNER && analysis.winnerVariantId) {
    publishExperimentWinnerDetected({ experimentId, winnerVariantId: analysis.winnerVariantId });
  } else if (analysis.resultStatus === AnalysisResultStatus.GUARDRAIL_VIOLATION) {
    publishExperimentGuardrailViolated({ experimentId, guardrails: analysis.warnings });
  } else if (analysis.resultStatus === AnalysisResultStatus.INCONCLUSIVE || analysis.resultStatus === AnalysisResultStatus.NO_DIFFERENCE) {
    publishExperimentInconclusive({ experimentId, reason: analysis.resultStatus });
  }

  // Publish recommendation created events
  for (const rec of recommendations) {
    publishRecommendationCreated({ recommendationId: rec.id, experimentId });
  }

  return {
    success: true,
    analysis,
    recommendations
  };
}

/**
 * Accepts a recommendation.
 */
export function acceptRecommendationWorkflow(recommendationId: string): { success: boolean; error?: string } {
  const recommendations = loadRecommendations();
  const index = recommendations.findIndex(r => r.id === recommendationId);
  if (index === -1) {
    return { success: false, error: 'Recommendation not found.' };
  }

  // Idempotency check
  if (recommendations[index].status === RecommendationStatus.ACCEPTED) {
    return { success: true };
  }

  recommendations[index].status = RecommendationStatus.ACCEPTED;
  recommendations[index].updatedAt = new Date().toISOString();

  if (!saveRecommendations(recommendations)) {
    return { success: false, error: 'Quota exceeded. Failed to save accepted recommendation state.' };
  }

  publishRecommendationAccepted({ recommendationId, experimentId: recommendations[index].experimentId });
  return { success: true };
}

/**
 * Rejects a recommendation.
 */
export function rejectRecommendationWorkflow(recommendationId: string): { success: boolean; error?: string } {
  const recommendations = loadRecommendations();
  const index = recommendations.findIndex(r => r.id === recommendationId);
  if (index === -1) {
    return { success: false, error: 'Recommendation not found.' };
  }

  // Idempotency check
  if (recommendations[index].status === RecommendationStatus.REJECTED) {
    return { success: true };
  }

  recommendations[index].status = RecommendationStatus.REJECTED;
  recommendations[index].updatedAt = new Date().toISOString();

  if (!saveRecommendations(recommendations)) {
    return { success: false, error: 'Quota exceeded. Failed to save rejected recommendation state.' };
  }

  publishRecommendationRejected({ recommendationId, experimentId: recommendations[index].experimentId });
  return { success: true };
}

/**
 * Edits a draft experiment. If started, clones as a new follow-up.
 */
export function editDraftExperiment(
  experimentId: string,
  updates: Partial<Experiment>
): { success: boolean; experiment?: Experiment; createdFollowUp?: boolean; error?: string } {
  const experiments = loadExperiments();
  const index = experiments.findIndex(e => e.id === experimentId);
  if (index === -1) {
    return { success: false, error: 'Experiment not found.' };
  }
  const exp = experiments[index];

  // If started, create a follow-up experiment (new version) instead of editing history
  if (exp.status !== ExperimentStatus.DRAFT && exp.status !== ExperimentStatus.READY) {
    const followUpId = `exp-${Date.now()}`;
    const followUp: Experiment = {
      ...exp,
      ...updates,
      id: followUpId,
      status: ExperimentStatus.DRAFT,
      name: updates.name || `${exp.name} (v2 Follow-up)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      startAt: undefined,
      endAt: undefined,
      stoppedAt: undefined,
      completedAt: undefined,
    };

    const allVariants = loadVariants();
    const originVariants = allVariants.filter(v => v.experimentId === experimentId);
    const clonedVariants = originVariants.map((v, i) => ({
      ...v,
      id: `var-${followUpId}-${i}-${Date.now()}`,
      experimentId: followUpId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    if (!saveExperiments([...experiments, followUp])) {
      return { success: false, error: 'Quota exceeded. Failed to save follow-up experiment.' };
    }
    if (!saveVariants([...allVariants, ...clonedVariants])) {
      saveExperiments(experiments); // Rollback
      return { success: false, error: 'Quota exceeded. Failed to save follow-up variants.' };
    }

    return { success: true, experiment: followUp, createdFollowUp: true };
  }

  // Normal in-place edit for draft / ready
  const updated: Experiment = {
    ...exp,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  experiments[index] = updated;
  if (!saveExperiments(experiments)) {
    return { success: false, error: 'Quota exceeded. Failed to save edited experiment.' };
  }

  return { success: true, experiment: updated };
}

/**
 * Runs experiment design validation.
 */
export function validateExperimentWorkflow(experimentId: string) {
  const experiments = loadExperiments();
  const variants = loadVariants();

  const exp = experiments.find(e => e.id === experimentId);
  if (!exp) {
    return { success: false, errors: ['Experiment not found.'] };
  }

  const expVariants = variants.filter(v => v.experimentId === experimentId);
  return validateExperimentDesign(exp, expVariants);
}

/**
 * Creates a new variant for an experiment.
 */
export function createVariantWorkflow(
  experimentId: string,
  variantData: Omit<ExperimentVariant, 'id' | 'experimentId' | 'createdAt' | 'updatedAt'>
): { success: boolean; variant?: ExperimentVariant; error?: string } {
  const experiments = loadExperiments();
  const exp = experiments.find(e => e.id === experimentId);
  if (!exp) {
    return { success: false, error: 'Experiment not found.' };
  }

  if (exp.status !== ExperimentStatus.DRAFT && exp.status !== ExperimentStatus.READY) {
    return { success: false, error: 'Cannot add variants to an active/completed experiment.' };
  }

  const variants = loadVariants();
  const newVar: ExperimentVariant = {
    ...variantData,
    id: `var-${experimentId}-${Date.now()}`,
    experimentId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (!saveVariants([...variants, newVar])) {
    return { success: false, error: 'Quota exceeded. Failed to save variant.' };
  }

  return { success: true, variant: newVar };
}

/**
 * Duplicates a variant.
 */
export function duplicateVariantWorkflow(variantId: string): { success: boolean; variant?: ExperimentVariant; error?: string } {
  const variants = loadVariants();
  const target = variants.find(v => v.id === variantId);
  if (!target) {
    return { success: false, error: 'Variant not found.' };
  }

  const experiments = loadExperiments();
  const exp = experiments.find(e => e.id === target.experimentId);
  if (exp && exp.status !== ExperimentStatus.DRAFT && exp.status !== ExperimentStatus.READY) {
    return { success: false, error: 'Cannot add variants to an active/completed experiment.' };
  }

  const newVar: ExperimentVariant = {
    ...target,
    id: `var-${target.experimentId}-${Date.now()}`,
    name: `${target.name} (Copy)`,
    variantKey: `${target.variantKey}_copy_${Date.now()}`,
    isControl: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (!saveVariants([...variants, newVar])) {
    return { success: false, error: 'Quota exceeded. Failed to save duplicated variant.' };
  }

  return { success: true, variant: newVar };
}

/**
 * Assigns a specific variant as control, marking other variants as treatment.
 */
export function assignControlWorkflow(experimentId: string, variantId: string): { success: boolean; error?: string } {
  const experiments = loadExperiments();
  const exp = experiments.find(e => e.id === experimentId);
  if (!exp) {
    return { success: false, error: 'Experiment not found.' };
  }
  if (exp.status !== ExperimentStatus.DRAFT && exp.status !== ExperimentStatus.READY) {
    return { success: false, error: 'Cannot re-assign control of a started experiment.' };
  }

  const variants = loadVariants();
  const updated = variants.map(v => {
    if (v.experimentId === experimentId) {
      return {
        ...v,
        isControl: v.id === variantId,
        updatedAt: new Date().toISOString(),
      };
    }
    return v;
  });

  if (!saveVariants(updated)) {
    return { success: false, error: 'Quota exceeded. Failed to assign control.' };
  }

  return { success: true };
}

/**
 * Configures allocation weights for variants.
 */
export function configureAllocationWorkflow(experimentId: string, weights: Record<string, number>): { success: boolean; error?: string } {
  const experiments = loadExperiments();
  const exp = experiments.find(e => e.id === experimentId);
  if (!exp) {
    return { success: false, error: 'Experiment not found.' };
  }
  if (exp.status !== ExperimentStatus.DRAFT && exp.status !== ExperimentStatus.READY) {
    return { success: false, error: 'Cannot re-configure allocation weights of a started experiment.' };
  }

  const variants = loadVariants();
  const updated = variants.map(v => {
    if (v.experimentId === experimentId && weights[v.id] !== undefined) {
      return {
        ...v,
        allocationWeight: weights[v.id],
        updatedAt: new Date().toISOString(),
      };
    }
    return v;
  });

  if (!saveVariants(updated)) {
    return { success: false, error: 'Quota exceeded. Failed to configure allocation.' };
  }

  return { success: true };
}

/**
 * Marks experiment as READY if it passes validation.
 */
export function markReadyWorkflow(experimentId: string): { success: boolean; experiment?: Experiment; error?: string } {
  const experiments = loadExperiments();
  const index = experiments.findIndex(e => e.id === experimentId);
  if (index === -1) {
    return { success: false, error: 'Experiment not found.' };
  }

  const variants = loadVariants();
  const expVariants = variants.filter(v => v.experimentId === experimentId);

  const transition = transitionExperiment(experiments[index], ExperimentStatus.READY, expVariants);
  if (!transition.success || !transition.experiment) {
    return { success: false, error: transition.error };
  }

  experiments[index] = transition.experiment;
  if (!saveExperiments(experiments)) {
    return { success: false, error: 'Quota exceeded. Failed to save ready state.' };
  }

  publishExperimentReady({ experimentId });
  return { success: true, experiment: transition.experiment };
}

/**
 * Resumes a paused experiment.
 */
export function resumeWorkflow(experimentId: string): { success: boolean; experiment?: Experiment; error?: string } {
  const experiments = loadExperiments();
  const index = experiments.findIndex(e => e.id === experimentId);
  if (index === -1) {
    return { success: false, error: 'Experiment not found.' };
  }

  const variants = loadVariants();
  const expVariants = variants.filter(v => v.experimentId === experimentId);

  const transition = transitionExperiment(experiments[index], ExperimentStatus.RUNNING, expVariants);
  if (!transition.success || !transition.experiment) {
    return { success: false, error: transition.error };
  }

  experiments[index] = transition.experiment;
  if (!saveExperiments(experiments)) {
    return { success: false, error: 'Quota exceeded. Failed to save resumed state.' };
  }

  return { success: true, experiment: transition.experiment };
}

/**
 * Ingests a performance snapshot observation. Idempotent check prevents duplicates.
 */
export function ingestObservationWorkflow(
  obsData: Omit<ExperimentObservation, 'id' | 'capturedAt'>
): { success: boolean; observation?: ExperimentObservation; newlyIngested?: boolean; error?: string } {
  const observations = loadObservations();

  // Check if this performance snapshot / metric observation already exists (idempotency)
  if (obsData.performanceSnapshotId) {
    const duplicate = observations.find(
      o =>
        o.performanceSnapshotId === obsData.performanceSnapshotId &&
        o.variantId === obsData.variantId &&
        o.metricName === obsData.metricName
    );
    if (duplicate) {
      return { success: true, observation: duplicate, newlyIngested: false };
    }
  }

  const snapshotPart = obsData.performanceSnapshotId || 'no-snapshot';
  const scenarioPart = obsData.metadata?.scenario || 'no-scenario';
  const seedPart = obsData.metadata?.seed || 'no-seed';
  const deterministicId = `obs-${obsData.experimentId}-${obsData.variantId}-${snapshotPart}-${obsData.metricName}-${scenarioPart}-${seedPart}`;

  const newObs: ExperimentObservation = {
    ...obsData,
    id: deterministicId,
    capturedAt: obsData.metadata?.capturedAt || '2026-07-17T03:30:00Z',
  };

  if (!saveObservations([...observations, newObs])) {
    return { success: false, error: 'Quota exceeded. Failed to save observation.' };
  }

  return { success: true, observation: newObs, newlyIngested: true };
}

/**
 * Archives an experiment.
 */
export function archiveExperimentWorkflow(experimentId: string): { success: boolean; experiment?: Experiment; error?: string } {
  const experiments = loadExperiments();
  const index = experiments.findIndex(e => e.id === experimentId);
  if (index === -1) {
    return { success: false, error: 'Experiment not found.' };
  }

  const transition = transitionExperiment(experiments[index], ExperimentStatus.ARCHIVED);
  if (!transition.success || !transition.experiment) {
    return { success: false, error: transition.error };
  }

  experiments[index] = transition.experiment;
  if (!saveExperiments(experiments)) {
    return { success: false, error: 'Quota exceeded. Failed to save archived state.' };
  }

  return { success: true, experiment: transition.experiment };
}

/**
 * Applies a decision on a recommendation (e.g. accepting a winner, creating follow-up).
 * Keeps historical experiment intact, recording a separate lineage trail.
 */
export function applyDecisionWorkflow(
  decisionData: Omit<ExperimentDecision, 'id' | 'createdAt'>
): { success: boolean; decision?: ExperimentDecision; error?: string } {
  const originalDecisions = loadDecisions();
  const originalRecommendations = loadRecommendations();
  const originalDrafts = loadPublicationDrafts();
  const originalPromptHistory = loadPromptHistoryFromStorage();

  const id = `dec-${Date.now()}`;
  const newDecision: ExperimentDecision = {
    ...decisionData,
    id,
    createdAt: new Date().toISOString(),
  };

  const updatedDecisions = [...originalDecisions, newDecision];

  // Set the recommendation status as APPLIED if linked
  const updatedRecommendations = [...originalRecommendations];
  if (newDecision.recommendationId) {
    const index = updatedRecommendations.findIndex(r => r.id === newDecision.recommendationId);
    if (index !== -1) {
      updatedRecommendations[index] = {
        ...updatedRecommendations[index],
        status: RecommendationStatus.APPLIED,
        updatedAt: new Date().toISOString()
      };
    }
  }

  // Load experiment and variants to check linked campaigns / assets
  const experiments = loadExperiments();
  const experiment = experiments.find(e => e.id === newDecision.experimentId);
  const variants = loadVariants();
  const winningVariant = variants.find(v => v.id === newDecision.selectedVariantId);

  let updatedDrafts = [...originalDrafts];
  let updatedPromptHistory = [...originalPromptHistory];

  if (newDecision.decision === 'accept_winner' && experiment) {
    // 1. Publishing Hub Draft Creation (if Campaign or Creative Intent/Plan is linked)
    const isCampaignLinked = !!(experiment.campaignId || experiment.creativePlanId || winningVariant?.campaignId);
    if (isCampaignLinked) {
      const now = new Date().toISOString();
      const newDraft: any = {
        id: `publication-${Date.now()}`,
        workspaceId: experiment.workspaceId || 'default-workspace',
        campaignId: experiment.campaignId || winningVariant?.campaignId,
        workflowId: 'experiment-winner-workflow',
        creativePlanId: experiment.creativePlanId,
        creativeAssetId: winningVariant?.creativeLibraryAssetId,
        cloudAssetId: winningVariant?.cloudAssetId,
        digitalHumanId: winningVariant?.digitalHumanId,
        productId: winningVariant?.productId,
        platform: experiment.platform || 'generic',
        connectionId: `publishing-connection-${experiment.platform || 'generic'}`,
        title: winningVariant?.title || `Winner - ${experiment.name}`,
        caption: winningVariant?.caption || `Optimized via experiment ${experiment.name}`,
        hashtags: [],
        mentions: [],
        status: 'draft',
        approvalRequired: true,
        timezone: 'UTC',
        adapterMode: 'mock',
        validation: { valid: true, issues: [], checkedAt: now, policyVersion: 'v1' },
        idempotencyKey: `experiment-winner-${experiment.id}-${winningVariant?.id || 'no-variant'}`,
        attemptCount: 0,
        metricsStatus: 'not-requested',
        createdAt: now,
        updatedAt: now,
      };

      const duplicateDraft = originalDrafts.find(d => d.idempotencyKey === newDraft.idempotencyKey);
      if (!duplicateDraft) {
        updatedDrafts = [newDraft, ...originalDrafts];
      }
    }

    // 2. Prompt Intelligence (Prompt Engine) Version Creation (if creative assets/prompts are being tested)
    const hasPromptAssets = !!(winningVariant?.hook || winningVariant?.CTA || winningVariant?.title || winningVariant?.promptHistoryId || winningVariant?.caption);
    if (hasPromptAssets) {
      const customInst = `Experiment Winner ${winningVariant?.name || 'Treatment'}. ${winningVariant?.description || ''}`;
      const duplicatePrompt = originalPromptHistory.some(p => p.configuration.customInstructions === customInst);
      if (!duplicatePrompt) {
        const newPromptEntry: any = {
          id: `prt-${Date.now()}`,
          generatedPrompt: `${winningVariant?.title || ''} ${winningVariant?.hook || ''} ${winningVariant?.CTA || ''} ${winningVariant?.caption || ''}`.trim() || `Optimized Prompt for ${experiment.name}`,
          createdAt: new Date().toISOString(),
          campaignId: experiment.campaignId,
          campaignName: experiment.name,
          configuration: {
            outputType: 'video',
            platform: 'veo-3',
            aspectRatio: '9:16',
            durationSeconds: 8,
            characterId: winningVariant?.digitalHumanId || '',
            productId: winningVariant?.productId || '',
            wardrobeItemId: winningVariant?.wardrobeItemId || '',
            sceneId: winningVariant?.sceneId || '',
            poseId: winningVariant?.poseId || '',
            customInstructions: customInst,
          }
        };
        updatedPromptHistory = [newPromptEntry, ...originalPromptHistory];
      }
    }
  }

  // Atomic storage writes
  const decSaved = saveDecisions(updatedDecisions);
  if (!decSaved) {
    return { success: false, error: 'Quota exceeded. Failed to save decision.' };
  }

  const recsSaved = saveRecommendations(updatedRecommendations);
  if (!recsSaved) {
    // Rollback decision
    saveDecisions(originalDecisions);
    return { success: false, error: 'Quota exceeded. Failed to update recommendation.' };
  }

  const draftsSaved = savePublicationDrafts(updatedDrafts);
  if (!draftsSaved) {
    // Rollback recommendation and decision
    saveRecommendations(originalRecommendations);
    saveDecisions(originalDecisions);
    return { success: false, error: 'Quota exceeded. Failed to save publication drafts.' };
  }

  const promptsSaved = savePromptHistoryToStorage(updatedPromptHistory);
  if (!promptsSaved) {
    // Rollback drafts, recommendations, and decisions
    savePublicationDrafts(originalDrafts);
    saveRecommendations(originalRecommendations);
    saveDecisions(originalDecisions);
    return { success: false, error: 'Quota exceeded. Failed to save prompt version.' };
  }

  return { success: true, decision: newDecision };
}
