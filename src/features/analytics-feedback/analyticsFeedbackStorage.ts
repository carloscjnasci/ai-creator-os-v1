import { 
  PerformanceSnapshot, 
  PerformanceScorecard, 
  AnalyticsInsight, 
  AnalyticsRecommendation, 
  FeedbackDecision,
  CalibrationRecord,
  LearningContext
} from './types';
import { 
  performanceSnapshotSchema, 
  performanceScorecardSchema, 
  analyticsInsightSchema, 
  analyticsRecommendationSchema 
} from './analyticsFeedbackSchemas';

// Stable localStorage keys
export const SNAPSHOTS_KEY = 'ai_creator_os:performance_snapshots';
export const SCORECARDS_KEY = 'ai_creator_os:scorecards';
export const INSIGHTS_KEY = 'ai_creator_os:insights';
export const RECOMMENDATIONS_KEY = 'ai_creator_os:recommendations';
export const DECISIONS_KEY = 'ai_creator_os:feedback_decisions';
export const CALIBRATIONS_KEY = 'ai_creator_os:calibration_records';
export const LEARNING_CONTEXT_KEY = 'ai_creator_os:learning_context';

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
        return obj.substring(0, 1000); // truncate long strings
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

// Performance Snapshots Storage
export function loadSnapshots(): PerformanceSnapshot[] {
  return safeReadAndParseArray<PerformanceSnapshot>(SNAPSHOTS_KEY, performanceSnapshotSchema);
}

export function saveSnapshots(snapshots: PerformanceSnapshot[]): boolean {
  const sanitized = snapshots.map(s => ({
    ...s,
    metadata: sanitizeMetadata(s.metadata)
  }));
  return safeWrite(SNAPSHOTS_KEY, JSON.stringify(sanitized));
}

// Performance Scorecards Storage
export function loadScorecards(): PerformanceScorecard[] {
  return safeReadAndParseArray<PerformanceScorecard>(SCORECARDS_KEY, performanceScorecardSchema);
}

export function saveScorecards(scorecards: PerformanceScorecard[]): boolean {
  return safeWrite(SCORECARDS_KEY, JSON.stringify(scorecards));
}

// Analytics Insights Storage
export function loadInsights(): AnalyticsInsight[] {
  return safeReadAndParseArray<AnalyticsInsight>(INSIGHTS_KEY, analyticsInsightSchema);
}

export function saveInsights(insights: AnalyticsInsight[]): boolean {
  return safeWrite(INSIGHTS_KEY, JSON.stringify(insights));
}

// Analytics Recommendations Storage
export function loadRecommendations(): AnalyticsRecommendation[] {
  return safeReadAndParseArray<AnalyticsRecommendation>(RECOMMENDATIONS_KEY, analyticsRecommendationSchema);
}

export function saveRecommendations(recommendations: AnalyticsRecommendation[]): boolean {
  return safeWrite(RECOMMENDATIONS_KEY, JSON.stringify(recommendations));
}

// Feedback Decisions Storage (uses direct simple parsing since it's lightweight, or schema)
export function loadDecisions(): FeedbackDecision[] {
  const raw = localStorage.getItem(DECISIONS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(item => item && typeof item === 'object' && item.id);
    }
    return [];
  } catch {
    return [];
  }
}

export function saveDecisions(decisions: FeedbackDecision[]): boolean {
  return safeWrite(DECISIONS_KEY, JSON.stringify(decisions));
}

// Calibration Records Storage
export function loadCalibrations(): CalibrationRecord[] {
  const raw = localStorage.getItem(CALIBRATIONS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(item => item && typeof item === 'object' && item.id);
    }
    return [];
  } catch {
    return [];
  }
}

export function saveCalibrations(calibrations: CalibrationRecord[]): boolean {
  return safeWrite(CALIBRATIONS_KEY, JSON.stringify(calibrations));
}

// Learning Context Storage
export function loadLearningContext(): LearningContext {
  const raw = localStorage.getItem(LEARNING_CONTEXT_KEY);
  const defaultContext: LearningContext = {
    acceptedRecommendationIds: [],
    rejectedRecommendationIds: [],
    highPerformingPatterns: [],
    weakPatterns: [],
    platformPreferences: {},
    productPerformancePatterns: {},
    digitalHumanPerformancePatterns: {},
    promptPerformancePatterns: {},
    disabledSignals: [],
    updatedAt: new Date().toISOString()
  };
  if (!raw) return defaultContext;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        ...defaultContext,
        ...parsed,
      };
    }
    return defaultContext;
  } catch {
    return defaultContext;
  }
}

export function saveLearningContext(context: LearningContext): boolean {
  return safeWrite(LEARNING_CONTEXT_KEY, JSON.stringify(context));
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
