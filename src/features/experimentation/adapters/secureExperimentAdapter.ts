import { Experiment, ExperimentAnalysisResult, ExperimentVariant } from '../types';
import { AssignmentRecord } from '../experimentStorage';

/**
 * Contract-only Secure Experiment Adapter prepared for full-stack deployment.
 * Connects the frontend to secure backend services that handle real-time traffic allocation,
 * platform integration, credential storage, and aggregate metric syncs.
 * 
 * CRITICAL: The frontend MUST NEVER store, persist, or process privileged platform credentials
 * or ad account tokens. All such authorization and signature validation occurs strictly server-side.
 */
export class SecureExperimentAdapter {
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string = '/api/experiments') {
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * Proposes a new experiment design to the secure backend.
   */
  public async createExperiment(
    experiment: Omit<Experiment, 'id' | 'createdAt' | 'updatedAt'>,
    variants: Omit<ExperimentVariant, 'id' | 'createdAt' | 'updatedAt'>[]
  ): Promise<{ success: boolean; experimentId?: string; error?: string }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experiment, variants })
      });
      if (!response.ok) {
        const err = await response.json();
        return { success: false, error: err.message || 'Backend failed to design experiment' };
      }
      return await response.json();
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Triggers the secure backend to start traffic allocation.
   */
  public async startExperiment(experimentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${experimentId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        const err = await response.json();
        return { success: false, error: err.message || 'Failed to start experiment on server' };
      }
      return await response.json();
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Requests the backend to pause traffic allocation.
   */
  public async pauseExperiment(experimentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${experimentId}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        const err = await response.json();
        return { success: false, error: err.message || 'Failed to pause experiment on server' };
      }
      return await response.json();
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Requests the backend to terminate traffic allocation and freeze state.
   */
  public async stopExperiment(experimentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${experimentId}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        const err = await response.json();
        return { success: false, error: err.message || 'Failed to stop experiment on server' };
      }
      return await response.json();
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Requests a fresh statistical evaluation run on backend observations.
   */
  public async requestEvaluation(experimentId: string): Promise<{ success: boolean; analysis?: ExperimentAnalysisResult; error?: string }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${experimentId}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        const err = await response.json();
        return { success: false, error: err.message || 'Evaluation request failed' };
      }
      return await response.json();
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Fetches the current canonical configuration of an experiment from the backend.
   */
  public async fetchExperiment(experimentId: string): Promise<{ success: boolean; experiment?: Experiment; error?: string }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${experimentId}`);
      if (!response.ok) {
        const err = await response.json();
        return { success: false, error: err.message || 'Failed to retrieve experiment' };
      }
      return await response.json();
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Fetches aggregate variant assignments allocated by the backend router.
   */
  public async fetchAssignments(experimentId: string): Promise<{ success: boolean; assignments?: AssignmentRecord[]; error?: string }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${experimentId}/assignments`);
      if (!response.ok) {
        const err = await response.json();
        return { success: false, error: err.message || 'Failed to retrieve assignments' };
      }
      return await response.json();
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Fetches completed analytical results and current confidence interval matrices.
   */
  public async fetchResults(experimentId: string): Promise<{ success: boolean; results?: ExperimentAnalysisResult; error?: string }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/${experimentId}/results`);
      if (!response.ok) {
        const err = await response.json();
        return { success: false, error: err.message || 'Failed to fetch results' };
      }
      return await response.json();
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}
