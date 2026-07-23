export type {
  SettingsPreferences,
  SettingsPromptDefaults,
  SettingsThemePreference,
} from './types';

export {
  DEFAULT_SETTINGS_PREFERENCES,
  SETTINGS_THEME_PREFERENCES,
  createDefaultSettingsPreferences,
  isSettingsThemePreference,
} from './types';

export {
  LEGACY_THEME_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  loadSettingsFromStorage,
  parseStoredSettings,
  saveSettingsToStorage,
} from './settingsStorage';

export {
  SettingsPage,
  default,
} from './pages/SettingsPage';

export type { WorkspaceBackupPayload } from './workspaceBackup';
export {
  createWorkspaceBackup,
  validateWorkspaceBackup,
  restoreWorkspaceBackup,
  clearWorkspaceStorage,
} from './workspaceBackup';

