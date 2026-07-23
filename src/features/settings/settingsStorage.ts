import {
  PROMPT_OUTPUT_TYPES,
  PROMPT_PLATFORMS,
  PROMPT_ASPECT_RATIOS,
} from '../prompt-engine/types';
import type {
  PromptOutputType,
  PromptPlatform,
  PromptAspectRatio,
} from '../prompt-engine/types';
import { ANALYTICS_DATE_RANGES } from '../analytics/types';
import type { AnalyticsDateRange } from '../analytics/types';
import {
  createDefaultSettingsPreferences,
  isSettingsThemePreference,
} from './types';
import type {
  SettingsPreferences,
  SettingsThemePreference,
} from './types';
import { sanitizeLocale } from '../i18n/localeConfig';

export const SETTINGS_STORAGE_KEY = 'ai-creator-os.settings.v1';
export const LEGACY_THEME_STORAGE_KEY = 'ai-creator-os-theme';

export const SETTINGS_CHANGED_EVENT =
  'ai-creator-os:settings-changed';

export function notifySettingsChanged(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new Event(SETTINGS_CHANGED_EVENT),
  );
}

function getBrowserLocalStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isPromptOutputType(val: unknown): val is PromptOutputType {
  return typeof val === 'string' && (PROMPT_OUTPUT_TYPES as readonly string[]).includes(val);
}

function isPromptPlatform(val: unknown): val is PromptPlatform {
  return typeof val === 'string' && (PROMPT_PLATFORMS as readonly string[]).includes(val);
}

function isPromptAspectRatio(val: unknown): val is PromptAspectRatio {
  return typeof val === 'string' && (PROMPT_ASPECT_RATIOS as readonly string[]).includes(val);
}

function isAnalyticsDateRange(val: unknown): val is AnalyticsDateRange {
  return typeof val === 'string' && (ANALYTICS_DATE_RANGES as readonly string[]).includes(val);
}

function normalizeSettingsPreferences(
  value: unknown,
  legacyTheme?: string | null,
): SettingsPreferences {
  const defaults = createDefaultSettingsPreferences();

  if (typeof value !== 'object' || value === null) {
    const result = createDefaultSettingsPreferences();
    if (legacyTheme === 'light' || legacyTheme === 'dark') {
      result.theme = legacyTheme;
    }
    return result;
  }

  const obj = value as Record<string, unknown>;

  // Theme preference validation
  let themePreference: SettingsThemePreference = defaults.theme;
  if (typeof obj.theme === 'string' && isSettingsThemePreference(obj.theme)) {
    themePreference = obj.theme;
  } else if (legacyTheme === 'light' || legacyTheme === 'dark') {
    themePreference = legacyTheme;
  }

  // Prompt defaults validation
  const promptDefaultsObj = obj.promptDefaults;
  const promptDefaults = { ...defaults.promptDefaults };

  if (typeof promptDefaultsObj === 'object' && promptDefaultsObj !== null) {
    const pd = promptDefaultsObj as Record<string, unknown>;

    if (isPromptOutputType(pd.outputType)) {
      promptDefaults.outputType = pd.outputType;
    }
    if (isPromptPlatform(pd.platform)) {
      promptDefaults.platform = pd.platform;
    }
    if (isPromptAspectRatio(pd.aspectRatio)) {
      promptDefaults.aspectRatio = pd.aspectRatio;
    }
    if (
      typeof pd.durationSeconds === 'number' &&
      Number.isFinite(pd.durationSeconds) &&
      Number.isInteger(pd.durationSeconds) &&
      pd.durationSeconds >= 1 &&
      pd.durationSeconds <= 60
    ) {
      promptDefaults.durationSeconds = pd.durationSeconds;
    }
  }

  // Analytics default range validation
  let analyticsDefaultRange = defaults.analyticsDefaultRange;
  if (isAnalyticsDateRange(obj.analyticsDefaultRange)) {
    analyticsDefaultRange = obj.analyticsDefaultRange;
  }

  // Locale preference validation
  let localePreference = defaults.locale;
  if (obj.locale !== undefined) {
    localePreference = sanitizeLocale(obj.locale);
  }

  return {
    theme: themePreference,
    promptDefaults,
    analyticsDefaultRange,
    locale: localePreference,
  };
}

export function parseStoredSettings(
  serializedSettings: string | null,
  legacyTheme?: string | null,
): SettingsPreferences {
  if (serializedSettings === null) {
    return normalizeSettingsPreferences(null, legacyTheme);
  }

  try {
    const parsed = JSON.parse(serializedSettings);
    return normalizeSettingsPreferences(parsed, legacyTheme);
  } catch (e) {
    return normalizeSettingsPreferences(null, legacyTheme);
  }
}

export function loadSettingsFromStorage():
  SettingsPreferences {
  const storage = getBrowserLocalStorage();

  if (storage === null) {
    return createDefaultSettingsPreferences();
  }

  try {
    const serialized = storage.getItem(
      SETTINGS_STORAGE_KEY,
    );

    const legacyTheme = storage.getItem(
      LEGACY_THEME_STORAGE_KEY,
    );

    return parseStoredSettings(
      serialized,
      legacyTheme,
    );
  } catch {
    return createDefaultSettingsPreferences();
  }
}

export function saveSettingsToStorage(
  settings: SettingsPreferences,
): boolean {
  const storage = getBrowserLocalStorage();

  if (storage === null) {
    return false;
  }

  try {
    const normalized =
      normalizeSettingsPreferences(settings);

    storage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify(normalized),
    );

    notifySettingsChanged();

    return true;
  } catch {
    return false;
  }
}
