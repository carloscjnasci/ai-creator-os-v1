import { 
  Experiment, 
  ExperimentVariant, 
  ExperimentObservation, 
  ExperimentAnalysisResult, 
  ExperimentRecommendation, 
  ExperimentDecision 
} from './types';
import { 
  experimentSchema, 
  experimentVariantSchema, 
  experimentObservationSchema, 
  experimentAnalysisResultSchema, 
  experimentRecommendationSchema, 
  experimentDecisionSchema 
} from './experimentSchemas';

// Stable localStorage Keys
export const EXPERIMENTS_KEY = 'ai_creator_os:experiments';
export const VARIANTS_KEY = 'ai_creator_os:experiment_variants';
export const OBSERVATIONS_KEY = 'ai_creator_os:experiment_observations';
export const ASSIGNMENTS_KEY = 'ai_creator_os:experiment_assignments';
export const ANALYSES_KEY = 'ai_creator_os:experiment_analyses';
export const RECOMMENDATIONS_KEY = 'ai_creator_os:experiment_recommendations';
export const DECISIONS_KEY = 'ai_creator_os:experiment_decisions';

/**
 * Sanitizes metadata to prevent storing sensitive info, credentials, 
 * or excessively large payloads.
 */
export function sanitizeMetadata(metadata?: Record<string, any>): Record<string, any> | undefined {
  if (!metadata) return undefined;
  
  const secretKeywords = ['token', 'secret', 'key', 'password', 'auth', 'credential', 'jwt', 'private', 'bearer'];
  
  const clean = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') {
      if (typeof obj === 'string') {
        // Drop standard indicators of binary or base64 or long data
        if (obj.startsWith('data:') || obj.length > 500) {
          return '[Data Truncated/Removed]';
        }
        return obj;
      }
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => clean(item)).filter(item => item !== undefined);
    }
    
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (secretKeywords.some(keyword => k.toLowerCase().includes(keyword))) {
        continue; // Skip keys containing secrets
      }
      res[k] = clean(v);
    }
    return res;
  };

  const sanitized = clean(metadata);
  
  // Size-limit check (keep total metadata serialized length under 4000 characters)
  if (JSON.stringify(sanitized).length > 4000) {
    return { _warning: 'Metadata size limit exceeded. Excess data dropped.' };
  }
  
  return sanitized;
}

/**
 * Safe helper to write data to localStorage with quota-exceeded handling.
 */
function safeWrite(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.error(`Failed to write to localStorage for key: ${key}`, err);
    return false;
  }
}

/**
 * Safe helper to read and parse array of objects with schema.
 * Keeps valid elements and discards invalid ones.
 */
function safeReadAndParseArray<T>(
  key: string,
  schema: { safeParse: (val: any) => { success: boolean; data?: T; error?: any } }
): T[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    
    const validRecords: T[] = [];
    for (const item of parsed) {
      const result = schema.safeParse(item);
      if (result.success && result.data) {
        validRecords.push(result.data);
      } else {
        console.warn(`Skipping malformed record in ${key}`, result.error);
      }
    }
    return validRecords;
  } catch (err) {
    console.error(`Malformed JSON for key: ${key}. Returning empty array.`, err);
    return [];
  }
}

// Experiments Storage
export function loadExperiments(): Experiment[] {
  return safeReadAndParseArray<Experiment>(EXPERIMENTS_KEY, experimentSchema);
}

export function saveExperiments(experiments: Experiment[]): boolean {
  return safeWrite(EXPERIMENTS_KEY, JSON.stringify(experiments));
}

// Variants Storage
export function loadVariants(): ExperimentVariant[] {
  return safeReadAndParseArray<ExperimentVariant>(VARIANTS_KEY, experimentVariantSchema);
}

export function saveVariants(variants: ExperimentVariant[]): boolean {
  const sanitized = variants.map(v => ({
    ...v,
    metadata: sanitizeMetadata(v.metadata)
  }));
  return safeWrite(VARIANTS_KEY, JSON.stringify(sanitized));
}

// Observations Storage
export function loadObservations(): ExperimentObservation[] {
  return safeReadAndParseArray<ExperimentObservation>(OBSERVATIONS_KEY, experimentObservationSchema);
}

export function saveObservations(observations: ExperimentObservation[]): boolean {
  const sanitized = observations.map(o => ({
    ...o,
    metadata: sanitizeMetadata(o.metadata)
  }));
  return safeWrite(OBSERVATIONS_KEY, JSON.stringify(sanitized));
}

// Assignments Storage (simple format, dictionary assignmentUnitId -> variantId)
export interface AssignmentRecord {
  experimentId: string;
  assignmentUnitId: string;
  variantId: string;
  assignedAt: string;
  metadata?: Record<string, any>;
}

export function loadAssignments(): AssignmentRecord[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(ASSIGNMENTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(item => item && typeof item === 'object' && item.experimentId && item.variantId);
    }
    return [];
  } catch {
    return [];
  }
}

export function saveAssignments(assignments: AssignmentRecord[]): boolean {
  const sanitized = assignments.map(a => ({
    ...a,
    metadata: sanitizeMetadata(a.metadata)
  }));
  return safeWrite(ASSIGNMENTS_KEY, JSON.stringify(sanitized));
}

// Analyses Storage
export function loadAnalyses(): ExperimentAnalysisResult[] {
  return safeReadAndParseArray<ExperimentAnalysisResult>(ANALYSES_KEY, experimentAnalysisResultSchema);
}

export function saveAnalyses(analyses: ExperimentAnalysisResult[]): boolean {
  return safeWrite(ANALYSES_KEY, JSON.stringify(analyses));
}

// Recommendations Storage
export function loadRecommendations(): ExperimentRecommendation[] {
  return safeReadAndParseArray<ExperimentRecommendation>(RECOMMENDATIONS_KEY, experimentRecommendationSchema);
}

export function saveRecommendations(recommendations: ExperimentRecommendation[]): boolean {
  return safeWrite(RECOMMENDATIONS_KEY, JSON.stringify(recommendations));
}

// Decisions Storage
export function loadDecisions(): ExperimentDecision[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(DECISIONS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const valid: ExperimentDecision[] = [];
      for (const item of parsed) {
        const result = experimentDecisionSchema.safeParse(item);
        if (result.success && result.data) {
          valid.push(result.data);
        }
      }
      return valid;
    }
    return [];
  } catch {
    return [];
  }
}

export function saveDecisions(decisions: ExperimentDecision[]): boolean {
  return safeWrite(DECISIONS_KEY, JSON.stringify(decisions));
}

/**
 * Subscribe to changes in localStorage keys.
 * Ignores unrelated keys. Returns a cleanup function.
 */
export function subscribeToStorageChanges(
  targetKey: string,
  callback: () => void
): () => void {
  const handler = (event: StorageEvent) => {
    if (event.key === targetKey) {
      callback();
    }
  };
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener('storage', handler);
  };
}

/**
 * Wipes all experimentation-related keys from localStorage.
 */
export function clearWorkspaceExperimentationData(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(EXPERIMENTS_KEY);
  localStorage.removeItem(VARIANTS_KEY);
  localStorage.removeItem(OBSERVATIONS_KEY);
  localStorage.removeItem(ASSIGNMENTS_KEY);
  localStorage.removeItem(ANALYSES_KEY);
  localStorage.removeItem(RECOMMENDATIONS_KEY);
  localStorage.removeItem(DECISIONS_KEY);
  localStorage.removeItem('ai_creator_os:experiment_secure_connector_state');
  localStorage.removeItem('ai_creator_os:experiment_sync_job_metadata');
  localStorage.removeItem('ai_creator_os:experiment_learning_signals');
}
