import {
  CreativeRecipe,
  CreativeRecipeVersion,
  RecipeEvidence,
  RecipeScorecard,
  RecipeRecommendation,
  RecipeApplication,
} from './types';
import {
  creativeRecipeSchema,
  creativeRecipeVersionSchema,
  recipeEvidenceSchema,
  recipeScorecardSchema,
  recipeRecommendationSchema,
  recipeApplicationSchema,
} from './recipeSchemas';

// Stable localStorage Keys
export const RECIPES_KEY = 'ai_creator_os:creative_recipes';
export const RECIPE_VERSIONS_KEY = 'ai_creator_os:creative_recipe_versions';
export const RECIPE_EVIDENCE_KEY = 'ai_creator_os:creative_recipe_evidence';
export const RECIPE_SCORECARDS_KEY = 'ai_creator_os:creative_recipe_scorecards';
export const RECIPE_RECOMMENDATIONS_KEY = 'ai_creator_os:creative_recipe_recommendations';
export const RECIPE_APPLICATIONS_KEY = 'ai_creator_os:creative_recipes:applications';

export const CREATIVE_RECIPES_CHANGED_EVENT = 'ai-creator-os:recipes-changed';

/**
 * Sanitizes input values to prevent storing secret keys, credentials, binary, or heavy base64 data.
 */
export function sanitizeRecipePayload<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    if (obj.startsWith('data:') || obj.length > 4000) {
      return '[Data Truncated/Removed due to size or credentials]' as unknown as T;
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeRecipePayload(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const secretKeywords = ['token', 'secret', 'password', 'credential', 'jwt', 'bearer', 'apikey', 'privatekey', 'accesskey', 'authkey', 'clientkey', 'secretkey'];
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      const lowerKey = k.toLowerCase();
      const isSecret = secretKeywords.some(keyword => lowerKey.includes(keyword)) || 
                       lowerKey.includes('_key') || 
                       lowerKey.includes('-key') ||
                       lowerKey === 'credentials';
      if (isSecret) {
        continue; // Skip credential properties
      }
      cleaned[k] = sanitizeRecipePayload(v);
    }
    return cleaned as T;
  }
  return obj;
}

/**
 * Safe helper to write data to localStorage with quota-exceeded handling.
 * Throws an explicit error if write fails so that calling service/workflow can roll back.
 */
function safeWrite(key: string, value: string): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, value);
    
    // Dispatch custom event for same-tab notifications
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CREATIVE_RECIPES_CHANGED_EVENT, { detail: { key } }));
    }
    return true;
  } catch (err) {
    console.error(`Failed to write to localStorage for key: ${key}`, err);
    throw new Error(`QuotaExceededError: LocalStorage write failed for ${key}`);
  }
}

/**
 * Safe helper to read and parse array of objects with a schema.
 * Keeps valid elements, discards invalid/malformed ones and logs skipping warning.
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

// 1. Creative Recipes Storage
export function loadRecipes(): CreativeRecipe[] {
  return safeReadAndParseArray<CreativeRecipe>(RECIPES_KEY, creativeRecipeSchema);
}

export function saveRecipes(recipes: CreativeRecipe[]): boolean {
  const sanitized = recipes.map(r => sanitizeRecipePayload(r));
  return safeWrite(RECIPES_KEY, JSON.stringify(sanitized));
}

// 2. Recipe Versions Storage
export function loadRecipeVersions(): CreativeRecipeVersion[] {
  return safeReadAndParseArray<CreativeRecipeVersion>(RECIPE_VERSIONS_KEY, creativeRecipeVersionSchema);
}

export function saveRecipeVersions(versions: CreativeRecipeVersion[]): boolean {
  const sanitized = versions.map(v => sanitizeRecipePayload(v));
  return safeWrite(RECIPE_VERSIONS_KEY, JSON.stringify(sanitized));
}

// 3. Recipe Evidence Storage
export function loadRecipeEvidence(): RecipeEvidence[] {
  return safeReadAndParseArray<RecipeEvidence>(RECIPE_EVIDENCE_KEY, recipeEvidenceSchema);
}

export function saveRecipeEvidence(evidence: RecipeEvidence[]): boolean {
  const sanitized = evidence.map(e => sanitizeRecipePayload(e));
  return safeWrite(RECIPE_EVIDENCE_KEY, JSON.stringify(sanitized));
}

// 4. Recipe Scorecards Storage
export function loadRecipeScorecards(): RecipeScorecard[] {
  return safeReadAndParseArray<RecipeScorecard>(RECIPE_SCORECARDS_KEY, recipeScorecardSchema);
}

export function saveRecipeScorecards(scorecards: RecipeScorecard[]): boolean {
  const sanitized = scorecards.map(s => sanitizeRecipePayload(s));
  return safeWrite(RECIPE_SCORECARDS_KEY, JSON.stringify(sanitized));
}

// 5. Recipe Recommendations Storage
export function loadRecipeRecommendations(): RecipeRecommendation[] {
  return safeReadAndParseArray<RecipeRecommendation>(RECIPE_RECOMMENDATIONS_KEY, recipeRecommendationSchema);
}

export function saveRecipeRecommendations(recs: RecipeRecommendation[]): boolean {
  const sanitized = recs.map(r => sanitizeRecipePayload(r));
  return safeWrite(RECIPE_RECOMMENDATIONS_KEY, JSON.stringify(sanitized));
}

// 6. Recipe Applications Storage
export function loadRecipeApplications(): RecipeApplication[] {
  return safeReadAndParseArray<RecipeApplication>(RECIPE_APPLICATIONS_KEY, recipeApplicationSchema);
}

export function saveRecipeApplications(apps: RecipeApplication[]): boolean {
  const sanitized = apps.map(a => sanitizeRecipePayload(a));
  return safeWrite(RECIPE_APPLICATIONS_KEY, JSON.stringify(sanitized));
}

/**
 * Subscribes to changes in recipe storage keys (for cross-component sync)
 */
export function subscribeToRecipeStorage(
  key: string,
  listener: () => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleCustomEvent = (event: Event) => {
    const customEvent = event as CustomEvent;
    if (customEvent.detail?.key === key) {
      listener();
    }
  };

  const handleStorageEvent = (event: StorageEvent) => {
    if (event.storageArea === localStorage && event.key === key) {
      listener();
    }
  };

  window.addEventListener(CREATIVE_RECIPES_CHANGED_EVENT, handleCustomEvent);
  window.addEventListener('storage', handleStorageEvent);

  return () => {
    window.removeEventListener(CREATIVE_RECIPES_CHANGED_EVENT, handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
  };
}

/**
 * Clear all creative recipe related storage keys.
 */
export function clearAllRecipeStorageKeys(): void {
  if (typeof localStorage === 'undefined') return;
  const keys = [
    RECIPES_KEY,
    RECIPE_VERSIONS_KEY,
    RECIPE_EVIDENCE_KEY,
    RECIPE_SCORECARDS_KEY,
    RECIPE_RECOMMENDATIONS_KEY,
    RECIPE_APPLICATIONS_KEY,
  ];
  for (const k of keys) {
    try {
      localStorage.removeItem(k);
    } catch (e) {
      console.error(`Failed to remove key ${k}`, e);
    }
  }
}
