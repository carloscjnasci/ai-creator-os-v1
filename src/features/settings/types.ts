import type { PromptOutputType, PromptPlatform, PromptAspectRatio } from '../prompt-engine/types';
import type { AnalyticsDateRange } from '../analytics/types';
import type { SupportedLocale } from '../i18n/types';

export const SETTINGS_THEME_PREFERENCES = [
  'system',
  'light',
  'dark',
] as const;

export type SettingsThemePreference =
  (typeof SETTINGS_THEME_PREFERENCES)[number];

export function isSettingsThemePreference(
  value: string,
): value is SettingsThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export interface SettingsPromptDefaults {
  outputType: PromptOutputType;
  platform: PromptPlatform;
  aspectRatio: PromptAspectRatio;
  durationSeconds: number;
}

export interface SettingsPreferences {
  theme: SettingsThemePreference;
  promptDefaults: SettingsPromptDefaults;
  analyticsDefaultRange: AnalyticsDateRange;
  locale?: SupportedLocale;
}

export const DEFAULT_SETTINGS_PREFERENCES: Readonly<SettingsPreferences> = {
  theme: 'system',
  promptDefaults: {
    outputType: 'video',
    platform: 'veo-3',
    aspectRatio: '9:16',
    durationSeconds: 8,
  },
  analyticsDefaultRange: '30-days',
  locale: 'pt-BR',
};

export function createDefaultSettingsPreferences(): SettingsPreferences {
  return {
    theme: DEFAULT_SETTINGS_PREFERENCES.theme,
    promptDefaults: {
      ...DEFAULT_SETTINGS_PREFERENCES.promptDefaults,
    },
    analyticsDefaultRange:
      DEFAULT_SETTINGS_PREFERENCES.analyticsDefaultRange,
    locale: DEFAULT_SETTINGS_PREFERENCES.locale,
  };
}
