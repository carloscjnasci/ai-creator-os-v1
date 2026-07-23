import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Info,
  SlidersHorizontal,
  ShieldAlert,
} from 'lucide-react';
import { AppButton } from '@/components/ui/AppButton';
import {
  AppCard,
  AppCardHeader,
  AppCardTitle,
  AppCardDescription,
  AppCardContent,
} from '@/components/ui/AppCard';
import { AppInput } from '@/components/ui/AppInput';
import { AppModal } from '@/components/ui/AppModal';
import { AppSelect } from '@/components/ui/AppSelect';

import {
  createDefaultSettingsPreferences,
  isSettingsThemePreference,
} from '../types';
import type {
  SettingsPreferences,
} from '../types';
import type { SupportedLocale } from '../../i18n/types';
import { useTranslation } from '../../i18n/useTranslation';

import {
  SETTINGS_STORAGE_KEY,
  loadSettingsFromStorage,
  saveSettingsToStorage,
} from '../settingsStorage';

import {
  PROMPT_OUTPUT_TYPES,
  PROMPT_PLATFORMS,
  PROMPT_ASPECT_RATIOS,
} from '../../prompt-engine/types';
import type {
  PromptOutputType,
  PromptPlatform,
  PromptAspectRatio,
} from '../../prompt-engine/types';

import { ANALYTICS_DATE_RANGES } from '../../analytics/types';
import type { AnalyticsDateRange } from '../../analytics/types';

import {
  createWorkspaceBackup,
  validateWorkspaceBackup,
  restoreWorkspaceBackup,
  clearWorkspaceStorage,
  type WorkspaceBackupPayload,
} from '../workspaceBackup';

function cloneSettingsPreferences(
  preferences: SettingsPreferences,
): SettingsPreferences {
  return {
    theme: preferences.theme,
    promptDefaults: {
      ...preferences.promptDefaults,
    },
    analyticsDefaultRange: preferences.analyticsDefaultRange,
    locale: preferences.locale,
  };
}

function areSettingsPreferencesEqual(
  first: SettingsPreferences,
  second: SettingsPreferences,
): boolean {
  return (
    first.theme === second.theme &&
    first.promptDefaults.outputType === second.promptDefaults.outputType &&
    first.promptDefaults.platform === second.promptDefaults.platform &&
    first.promptDefaults.aspectRatio === second.promptDefaults.aspectRatio &&
    first.promptDefaults.durationSeconds === second.promptDefaults.durationSeconds &&
    first.analyticsDefaultRange === second.analyticsDefaultRange &&
    first.locale === second.locale
  );
}

function validatePreferences(
  preferences: SettingsPreferences,
  translate: (key: string) => string,
): {
  valid: boolean;
  durationError: string | null;
  generalError: string | null;
} {
  // Theme check
  if (!isSettingsThemePreference(preferences.theme)) {
    return {
      valid: false,
      durationError: null,
      generalError: translate('pages.settings.invalidPreferenceValues'),
    };
  }

  // Prompt defaults check
  const pd = preferences.promptDefaults;
  const isOutputTypeValid = (PROMPT_OUTPUT_TYPES as readonly string[]).includes(pd.outputType);
  const isPlatformValid = (PROMPT_PLATFORMS as readonly string[]).includes(pd.platform);
  const isAspectRatioValid = (PROMPT_ASPECT_RATIOS as readonly string[]).includes(pd.aspectRatio);

  if (!isOutputTypeValid || !isPlatformValid || !isAspectRatioValid) {
    return {
      valid: false,
      durationError: null,
      generalError: translate('pages.settings.invalidPreferenceValues'),
    };
  }

  // Duration validation
  const dur = pd.durationSeconds;
  if (typeof dur !== 'number' || !Number.isFinite(dur)) {
    return {
      valid: false,
      durationError: translate('pages.settings.defaultDurationWholeNumber'),
      generalError: null,
    };
  }

  if (!Number.isInteger(dur)) {
    return {
      valid: false,
      durationError: translate('pages.settings.defaultDurationWholeNumber'),
      generalError: null,
    };
  }

  if (dur < 1 || dur > 60) {
    return {
      valid: false,
      durationError: translate('pages.settings.defaultDurationRange'),
      generalError: null,
    };
  }

  // Analytics default range check
  if (!(ANALYTICS_DATE_RANGES as readonly string[]).includes(preferences.analyticsDefaultRange)) {
    return {
      valid: false,
      durationError: null,
      generalError: translate('pages.settings.invalidPreferenceValues'),
    };
  }

  // Locale check
  if (preferences.locale && !['pt-BR', 'en', 'es'].includes(preferences.locale)) {
    return {
      valid: false,
      durationError: null,
      generalError: translate('pages.settings.invalidPreferenceValues'),
    };
  }

  return { valid: true, durationError: null, generalError: null };
}

function isPromptOutputType(value: string): value is PromptOutputType {
  return (PROMPT_OUTPUT_TYPES as readonly string[]).includes(value);
}

function isPromptPlatform(value: string): value is PromptPlatform {
  return (PROMPT_PLATFORMS as readonly string[]).includes(value);
}

function isPromptAspectRatio(value: string): value is PromptAspectRatio {
  return (PROMPT_ASPECT_RATIOS as readonly string[]).includes(value);
}

function isAnalyticsDateRange(value: string): value is AnalyticsDateRange {
  return (ANALYTICS_DATE_RANGES as readonly string[]).includes(value);
}

export function SettingsPage() {
  const { t, formatDate } = useTranslation();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [savedPreferences, setSavedPreferences] = useState<SettingsPreferences>(
    createDefaultSettingsPreferences,
  );
  const [draftPreferences, setDraftPreferences] = useState<SettingsPreferences>(
    createDefaultSettingsPreferences,
  );

  const [storageStatus, setStorageStatus] = useState<
    'idle' | 'saving' | 'saved' | 'error'
  >('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [durationError, setDurationError] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isRestoreDefaultsModalOpen, setIsRestoreDefaultsModalOpen] = useState<boolean>(false);
  const [crossTabConflictMsg, setCrossTabConflictMsg] = useState<string | null>(null);

  // Backup and clear states
  const [pendingBackup, setPendingBackup] = useState<WorkspaceBackupPayload | null>(null);
  const [selectedBackupFilename, setSelectedBackupFilename] = useState('');
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [isClearWorkspaceModalOpen, setIsClearWorkspaceModalOpen] = useState(false);
  const [clearConfirmationText, setClearConfirmationText] = useState('');

  const backupFileInputRef = useRef<HTMLInputElement | null>(null);

  function resetBackupFileInput(): void {
    if (backupFileInputRef.current) {
      backupFileInputRef.current.value = '';
    }
    setSelectedBackupFilename('');
  }

  function closeClearWorkspaceModal(): void {
    setIsClearWorkspaceModalOpen(false);
    setClearConfirmationText('');
  }

  // Load preferences once on mount
  useEffect(() => {
    const loaded = loadSettingsFromStorage();
    setSavedPreferences(cloneSettingsPreferences(loaded));
    setDraftPreferences(cloneSettingsPreferences(loaded));
    setIsLoading(false);
    setStorageStatus('saved');
  }, []);

  // Detect unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return !areSettingsPreferencesEqual(draftPreferences, savedPreferences);
  }, [draftPreferences, savedPreferences]);

  // Keep a stable ref of unsaved changes for the storage listener
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  // Listen for cross-tab preference updates
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.storageArea !== window.localStorage) {
        return;
      }

      if (e.key === SETTINGS_STORAGE_KEY || e.key === null) {
        const loaded = loadSettingsFromStorage();
        setSavedPreferences(cloneSettingsPreferences(loaded));

        if (!hasUnsavedChangesRef.current) {
          setDraftPreferences(cloneSettingsPreferences(loaded));
          setCrossTabConflictMsg(null);
        } else {
          setCrossTabConflictMsg(
            e.key === null
              ? t('pages.settings.storageResetAnotherTab')
              : t('pages.settings.preferencesChangedAnotherTab')
          );
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Handle changes for fields with strict validation checks
  const handleLocaleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextLocale = e.target.value as SupportedLocale;
    setDraftPreferences((curr) => ({ ...curr, locale: nextLocale }));
  };

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextTheme = e.target.value;
    if (isSettingsThemePreference(nextTheme)) {
      setDraftPreferences((curr) => ({ ...curr, theme: nextTheme }));
    }
  };

  const handleOutputTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextVal = e.target.value;
    if (isPromptOutputType(nextVal)) {
      setDraftPreferences((curr) => ({
        ...curr,
        promptDefaults: { ...curr.promptDefaults, outputType: nextVal },
      }));
    }
  };

  const handlePlatformChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextVal = e.target.value;
    if (isPromptPlatform(nextVal)) {
      setDraftPreferences((curr) => ({
        ...curr,
        promptDefaults: { ...curr.promptDefaults, platform: nextVal },
      }));
    }
  };

  const handleAspectRatioChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextVal = e.target.value;
    if (isPromptAspectRatio(nextVal)) {
      setDraftPreferences((curr) => ({
        ...curr,
        promptDefaults: { ...curr.promptDefaults, aspectRatio: nextVal },
      }));
    }
  };

  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDurationError(null);
    setErrorMsg(null);

    const val = e.target.value;
    if (val === '') {
      setDraftPreferences((curr) => ({
        ...curr,
        promptDefaults: { ...curr.promptDefaults, durationSeconds: NaN },
      }));
      return;
    }

    const parsed = Number(val);
    setDraftPreferences((curr) => ({
      ...curr,
      promptDefaults: { ...curr.promptDefaults, durationSeconds: parsed },
    }));
  };

  const handleAnalyticsRangeChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const nextVal = e.target.value;
    if (isAnalyticsDateRange(nextVal)) {
      setDraftPreferences((curr) => ({
        ...curr,
        analyticsDefaultRange: nextVal,
      }));
    }
  };

  // Actions
  const handleSave = () => {
    if (isLoading || !hasUnsavedChanges || storageStatus === 'saving') {
      return;
    }

    setSaveSuccessMsg(null);
    setErrorMsg(null);
    setDurationError(null);

    const validation = validatePreferences(draftPreferences, t);
    if (!validation.valid) {
      if (validation.durationError) {
        setDurationError(validation.durationError);
      }
      if (validation.generalError) {
        setErrorMsg(validation.generalError);
      }
      return;
    }

    setStorageStatus('saving');
    const success = saveSettingsToStorage(draftPreferences);
    if (success) {
      setSavedPreferences(cloneSettingsPreferences(draftPreferences));
      setStorageStatus('saved');
      setSaveSuccessMsg(t('settings.preferencesSaved'));
      setCrossTabConflictMsg(null);
    } else {
      setStorageStatus('error');
      setErrorMsg(t('settings.unableToSave'));
    }
  };

  const handleDiscard = () => {
    if (!hasUnsavedChanges || isLoading || storageStatus === 'saving') {
      return;
    }

    setDraftPreferences(cloneSettingsPreferences(savedPreferences));
    setDurationError(null);
    setErrorMsg(null);
    setSaveSuccessMsg(t('settings.changesDiscarded'));
    setCrossTabConflictMsg(null);
  };

  const handleRestoreDefaults = () => {
    setIsRestoreDefaultsModalOpen(true);
  };

  const confirmRestoreDefaults = () => {
    setIsRestoreDefaultsModalOpen(false);
    setSaveSuccessMsg(null);
    setErrorMsg(null);
    setDurationError(null);

    const defaults = createDefaultSettingsPreferences();
    const validation = validatePreferences(defaults, t);
    if (!validation.valid) {
      setStorageStatus('error');
      setErrorMsg(t('settings.unableToRestore'));
      return;
    }

    setStorageStatus('saving');
    const success = saveSettingsToStorage(defaults);
    if (success) {
      setSavedPreferences(cloneSettingsPreferences(defaults));
      setDraftPreferences(cloneSettingsPreferences(defaults));
      setStorageStatus('saved');
      setSaveSuccessMsg(t('settings.defaultsRestored'));
      setCrossTabConflictMsg(null);
    } else {
      setStorageStatus('error');
      setErrorMsg(t('settings.unableToRestore'));
    }
  };

  // Backup and Restore Actions
  const handleDownloadWorkspaceBackup = (): void => {
    let url: string | null = null;
    let anchor: HTMLAnchorElement | null = null;
    try {
      const backup = createWorkspaceBackup();
      const serializedBackup = JSON.stringify(backup, null, 2);
      const blob = new Blob(
        [serializedBackup],
        {
          type: 'application/json',
        },
      );
      url = URL.createObjectURL(blob);
      const dateStr = backup.exportedAt.substring(0, 10);
      const filename = `ai-creator-os-backup-${dateStr}.json`;

      anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();

      setSaveSuccessMsg(t('pages.settings.backupDownloaded'));
      setErrorMsg(null);
    } catch {
      setErrorMsg(t('pages.settings.backupCreateError'));
      setSaveSuccessMsg(null);
    } finally {
      if (anchor && anchor.parentNode) {
        anchor.parentNode.removeChild(anchor);
      }
      if (url) {
        URL.revokeObjectURL(url);
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const selectedFile = files[0];
    setSelectedBackupFilename(selectedFile.name);

    try {
      const serializedBackup = await selectedFile.text();
      if (serializedBackup.trim().length === 0) {
        setErrorMsg(t('pages.settings.emptyBackupFile'));
        setSaveSuccessMsg(null);
        resetBackupFileInput();
        return;
      }

      let parsedValue: unknown;
      try {
        parsedValue = JSON.parse(serializedBackup);
      } catch {
        setErrorMsg(t('pages.settings.invalidJsonFile'));
        setSaveSuccessMsg(null);
        resetBackupFileInput();
        return;
      }

      if (typeof parsedValue === 'object' && parsedValue !== null) {
        const obj = parsedValue as Record<string, unknown>;
        if ('version' in obj && typeof obj.version === 'number' && obj.version !== 1 && obj.version !== 2) {
          setErrorMsg(t('pages.settings.unsupportedBackupVersion'));
          setSaveSuccessMsg(null);
          resetBackupFileInput();
          return;
        }
      }

      if (!validateWorkspaceBackup(parsedValue)) {
        setErrorMsg(t('pages.settings.invalidWorkspaceBackup'));
        setSaveSuccessMsg(null);
        resetBackupFileInput();
        return;
      }

      setPendingBackup(parsedValue);
      setErrorMsg(null);
      setIsRestoreModalOpen(true);
    } catch {
      setErrorMsg(t('pages.settings.backupReadError'));
      setSaveSuccessMsg(null);
      resetBackupFileInput();
    }
  };

  const handleConfirmRestore = () => {
    if (!pendingBackup) {
      return;
    }

    if (!validateWorkspaceBackup(pendingBackup)) {
      setErrorMsg(t('pages.settings.invalidWorkspaceBackup'));
      setSaveSuccessMsg(null);
      setIsRestoreModalOpen(false);
      resetBackupFileInput();
      return;
    }

    const success = restoreWorkspaceBackup(pendingBackup);
    if (success) {
      const loaded = loadSettingsFromStorage();
      setSavedPreferences(cloneSettingsPreferences(loaded));
      setDraftPreferences(cloneSettingsPreferences(loaded));

      setDurationError(null);
      setErrorMsg(null);
      setCrossTabConflictMsg(null);
      setSaveSuccessMsg(t('pages.settings.backupRestored'));

      setIsRestoreModalOpen(false);
      setPendingBackup(null);
      resetBackupFileInput();
    } else {
      setErrorMsg(t('pages.settings.backupRestoreError'));
      setSaveSuccessMsg(null);
      setIsRestoreModalOpen(false);
    }
  };

  const handleCancelRestore = () => {
    setIsRestoreModalOpen(false);
    setPendingBackup(null);
    resetBackupFileInput();
  };

  const handleClearWorkspace = (): void => {
    if (clearConfirmationText !== 'CLEAR') {
      return;
    }

    const success = clearWorkspaceStorage();
    if (success) {
      const clearedPreferences = loadSettingsFromStorage();
      setSavedPreferences(cloneSettingsPreferences(clearedPreferences));
      setDraftPreferences(cloneSettingsPreferences(clearedPreferences));

      setDurationError(null);
      setErrorMsg(null);
      setCrossTabConflictMsg(null);
      setSaveSuccessMsg(t('pages.settings.workspaceCleared'));

      resetBackupFileInput();
      closeClearWorkspaceModal();
    } else {
      setErrorMsg(t('pages.settings.workspaceClearError'));
      setSaveSuccessMsg(null);
      closeClearWorkspaceModal();
    }
  };

  // Priority-based status messages (Task 15)
  const statusInfo = useMemo(() => {
    // 1. Form Validation Error
    if (durationError) {
      return { text: durationError, type: 'error' as const };
    }
    // 2 & 3. Import Validation, Restore or Clear Errors
    if (errorMsg) {
      return { text: errorMsg, type: 'error' as const };
    }
    if (storageStatus === 'error') {
      return {
        text: t('pages.settings.unableToSave'),
        type: 'error' as const,
      };
    }
    // 4. Successful actions
    if (saveSuccessMsg) {
      return { text: saveSuccessMsg, type: 'success' as const };
    }
    // 5. Synchronization Information
    if (crossTabConflictMsg) {
      return { text: crossTabConflictMsg, type: 'info' as const };
    }
    // 6. Saved-State text
    if (storageStatus === 'saving') {
      return { text: t('pages.settings.savingPreferences'), type: 'info' as const };
    }
    if (storageStatus === 'saved') {
      return {
        text: t('pages.settings.preferencesSaved'),
        type: 'success' as const,
      };
    }
    return null;
  }, [durationError, errorMsg, storageStatus, saveSuccessMsg, crossTabConflictMsg]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
        <SlidersHorizontal
          className="h-12 w-12 text-blue-500 animate-pulse mb-4"
          aria-hidden="true"
        />
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('pages.settings.loadingLocalPreferences')}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{t('pages.settings.readingSavedSettingsFromThisBrowser')}</p>
      </div>
    );
  }

  const themeDescriptions: Record<string, string> = {
    system: t('pages.settings.followDevice'),
    light: t('pages.settings.alwaysLight'),
    dark: t('pages.settings.alwaysDark'),
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8" id="settings-page">
      {/* Page Header */}
      <div className="border-b border-border pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <span className="text-xs font-semibold tracking-wider uppercase text-blue-600 dark:text-blue-400">
            {t('settings.workspaceConfig')}
          </span>
          <div className="flex items-center gap-2 mt-1">
            <SettingsIcon
              className="h-7 w-7 text-gray-900 dark:text-gray-100"
              aria-hidden="true"
            />
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
              {t('settings.title')}
            </h1>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('settings.description')}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 italic">
            {t('settings.settingsStoredLocally')}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <AppButton
            variant="outline"
            onClick={handleDiscard}
            disabled={!hasUnsavedChanges || storageStatus === 'saving'}
            leftIcon={<RotateCcw className="h-4 w-4" />}
            size="sm"
            id="settings-discard-btn"
          >
            {t('settings.discardChanges')}
          </AppButton>
          <AppButton
            variant="primary"
            onClick={handleSave}
            disabled={!hasUnsavedChanges || storageStatus === 'saving'}
            leftIcon={<Save className="h-4 w-4" />}
            size="sm"
            id="settings-save-btn"
          >
            {t('settings.savePreferences')}
          </AppButton>
          <AppButton
            variant="danger"
            onClick={handleRestoreDefaults}
            disabled={storageStatus === 'saving'}
            leftIcon={<RotateCcw className="h-4 w-4" />}
            size="sm"
            id="settings-restore-btn"
          >
            {t('settings.restoreDefaultsBtn')}
          </AppButton>
        </div>
      </div>

      {/* Status & Unsaved changes notifications */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Change status */}
        <div
          className={`flex items-center gap-2 p-3 rounded-md border text-sm ${
            hasUnsavedChanges
              ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-400'
              : 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400'
          }`}
          role="status"
        >
          <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="font-medium">
            {hasUnsavedChanges
              ? t('settings.hasUnsavedChanges')
              : t('settings.allChangesSaved')}
          </span>
        </div>

        {/* Priority Status bar (Task 15) */}
        {statusInfo && (
          <div
            className={`flex items-center gap-2 p-3 rounded-md border text-sm ${
              statusInfo.type === 'error'
                ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 text-red-800 dark:text-red-400'
                : statusInfo.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-400'
                : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50 text-blue-800 dark:text-blue-400'
            }`}
            aria-live="polite"
          >
            {statusInfo.type === 'error' ? (
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : statusInfo.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span className="font-medium">{statusInfo.text}</span>
          </div>
        )}
      </div>

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Appearance Section */}
          <AppCard id="settings-appearance-card">
            <AppCardHeader>
              <AppCardTitle>{t('settings.appearance')}</AppCardTitle>
              <AppCardDescription>
                {t('settings.appearanceDescription')}
              </AppCardDescription>
            </AppCardHeader>
            <AppCardContent className="space-y-4">
              <AppSelect
                label={t('settings.themePreference')}
                options={[
                  { value: 'system', label: t('settings.useSystemSetting') },
                  { value: 'light', label: t('settings.light') },
                  { value: 'dark', label: t('settings.dark') },
                ]}
                value={draftPreferences.theme}
                onChange={handleThemeChange}
                id="theme-select"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {themeDescriptions[draftPreferences.theme] ||
                  t('settings.useSystemSetting')}
              </p>
              <div className="mt-4 p-3 bg-muted/40 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('settings.themeAppliedAuto')}
                </p>
              </div>
            </AppCardContent>
          </AppCard>

          {/* Language Section */}
          <AppCard id="settings-language-card">
            <AppCardHeader>
              <AppCardTitle>{t('settings.language')}</AppCardTitle>
              <AppCardDescription>
                {t('settings.languageDescription')}
              </AppCardDescription>
            </AppCardHeader>
            <AppCardContent className="space-y-4">
              <AppSelect
                label={t('settings.languageSelectorLabel')}
                options={[
                  { value: 'pt-BR', label: t('settings.langPtBr') },
                  { value: 'en', label: t('settings.langEn') },
                  { value: 'es', label: t('settings.langEs') },
                ]}
                value={draftPreferences.locale || 'pt-BR'}
                onChange={handleLocaleChange}
                id="locale-select"
                aria-label={t('settings.languageSelectorLabel')}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {t('settings.languageFooter')}
              </p>
            </AppCardContent>
          </AppCard>

          {/* Analytics Defaults Section */}
          <AppCard id="settings-analytics-card">
            <AppCardHeader>
              <AppCardTitle>{t('settings.analyticsDefaults')}</AppCardTitle>
              <AppCardDescription>
                {t('settings.analyticsDefaultsDescription')}
              </AppCardDescription>
            </AppCardHeader>
            <AppCardContent className="space-y-4">
              <AppSelect
                label={t('settings.defaultActivityRange')}
                options={[
                  { value: '7-days', label: t('settings.last7Days') },
                  { value: '30-days', label: t('settings.last30Days') },
                  { value: '90-days', label: t('settings.last90Days') },
                  { value: 'all-time', label: t('settings.allTime') },
                ]}
                value={draftPreferences.analyticsDefaultRange}
                onChange={handleAnalyticsRangeChange}
                id="analytics-range-select"
                description={t('settings.analyticsPreferenceApplied')}
              />
            </AppCardContent>
          </AppCard>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Prompt Engine Defaults Section */}
          <AppCard id="settings-prompt-card">
            <AppCardHeader>
              <AppCardTitle>{t('settings.promptDefaultsTitle')}</AppCardTitle>
              <AppCardDescription>
                {t('settings.promptDefaultsDescription')}
              </AppCardDescription>
            </AppCardHeader>
            <AppCardContent className="space-y-4">
              <AppSelect
                label={t('settings.defaultOutputType')}
                options={[
                  { value: 'video', label: t('settings.video') },
                  { value: 'image', label: t('settings.image') },
                ]}
                value={draftPreferences.promptDefaults.outputType}
                onChange={handleOutputTypeChange}
                id="prompt-output-type-select"
              />

              <AppSelect
                label={t('settings.defaultTargetPlatform')}
                options={[
                  { value: 'veo-3', label: t('settings.platformVeo3') },
                  { value: 'grok', label: t('settings.platformGrok') },
                  { value: 'nano-banana', label: t('settings.platformBanana') },
                  { value: 'generic', label: t('settings.platformGeneric') },
                ]}
                value={draftPreferences.promptDefaults.platform}
                onChange={handlePlatformChange}
                id="prompt-platform-select"
              />

              <AppSelect
                label={t('settings.defaultAspectRatio')}
                options={PROMPT_ASPECT_RATIOS.map((r) => ({
                  value: r,
                  label: r,
                }))}
                value={draftPreferences.promptDefaults.aspectRatio}
                onChange={handleAspectRatioChange}
                id="prompt-aspect-ratio-select"
              />

              <AppInput
                label={t('settings.defaultVideoDuration')}
                type="number"
                min={1}
                max={60}
                step={1}
                value={
                  Number.isNaN(draftPreferences.promptDefaults.durationSeconds)
                    ? ''
                    : draftPreferences.promptDefaults.durationSeconds
                }
                onChange={handleDurationChange}
                id="prompt-duration-input"
                errorMessage={durationError || undefined}
                helperText={t('settings.promptDurationHelper')}
                required
              />
            </AppCardContent>
          </AppCard>

          {/* Local Storage Information Card */}
          <AppCard id="settings-info-card">
            <AppCardHeader>
              <AppCardTitle>{t('settings.localPreferenceStorage')}</AppCardTitle>
              <AppCardDescription>
                {t('settings.localPreferenceStorageDescription')}
              </AppCardDescription>
            </AppCardHeader>
            <AppCardContent>
              <div className="divide-y divide-border text-sm">
                <div className="py-2.5 flex justify-between">
                  <span className="text-muted-foreground">{t('settings.settingsKeyVersion')}</span>
                  <span className="font-mono font-semibold">{t('pages.settings.v1')}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-muted-foreground">{t('settings.firebaseRequirement')}</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">{t('settings.optional')}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-muted-foreground">{t('settings.externalSync')}</span>
                  <span className="font-semibold text-gray-500">{t('settings.notEnabled')}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-muted-foreground">{t('settings.sensitiveCredentials')}</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{t('settings.none')}</span>
                </div>
              </div>
            </AppCardContent>
          </AppCard>
        </div>
      </div>

      {/* Backup and Restore Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Workspace Backup Card */}
        <AppCard id="settings-backup-card">
          <AppCardHeader>
            <AppCardTitle>{t('settings.workspaceBackup')}</AppCardTitle>
            <AppCardDescription>
              {t('settings.workspaceBackupDescription')}
            </AppCardDescription>
          </AppCardHeader>
          <AppCardContent className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('settings.workspaceBackupAlert')}
            </p>
            <AppButton
              variant="outline"
              fullWidth
              onClick={handleDownloadWorkspaceBackup}
              leftIcon={<Save className="h-4 w-4" />}
              id="settings-download-backup-btn"
            >
              {t('settings.exportBackup')}
            </AppButton>
          </AppCardContent>
        </AppCard>

        {/* Restore Workspace Backup Card */}
        <AppCard id="settings-restore-card">
          <AppCardHeader>
            <AppCardTitle>{t('settings.restoreWorkspaceBackup')}</AppCardTitle>
            <AppCardDescription>
              {t('settings.restoreWorkspaceBackupDescription')}
            </AppCardDescription>
          </AppCardHeader>
          <AppCardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="backup-file-input" className="text-sm font-medium text-foreground">
                {t('settings.chooseBackupFile')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  ref={backupFileInputRef}
                  type="file"
                  id="backup-file-input"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <AppButton
                  type="button"
                  variant="outline"
                  onClick={() => backupFileInputRef.current?.click()}
                  id="choose-backup-file-btn"
                >
                  {t('settings.chooseBackupFile')}
                </AppButton>
                {selectedBackupFilename && (
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={selectedBackupFilename}>
                    {selectedBackupFilename}
                  </span>
                )}
              </div>
            </div>
          </AppCardContent>
        </AppCard>
      </div>

      {/* Danger Zone */}
      <AppCard id="settings-danger-zone-card" className="border-red-200 dark:border-red-900/50 bg-red-50/20 dark:bg-red-950/5">
        <AppCardHeader>
          <AppCardTitle className="text-red-700 dark:text-red-400">{t('settings.dangerZone')}</AppCardTitle>
          <AppCardDescription>
            {t('settings.dangerZoneDescription')}
          </AppCardDescription>
        </AppCardHeader>
        <AppCardContent className="space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t('settings.clearWorkspaceDescription')}
          </p>
          <div className="flex justify-start">
            <AppButton
              variant="danger"
              onClick={() => {
                setClearConfirmationText('');
                setIsClearWorkspaceModalOpen(true);
              }}
              id="settings-clear-workspace-btn"
            >
              {t('settings.clearWorkspaceBtn')}
            </AppButton>
          </div>
        </AppCardContent>
      </AppCard>

      {/* Restore Defaults Confirmation Modal */}
      <AppModal
        isOpen={isRestoreDefaultsModalOpen}
        onClose={() => setIsRestoreDefaultsModalOpen(false)}
        title={t('pages.settings.restoreDefaultPreferences')}
      >
        <div className="space-y-4 pt-2">
          <div className="flex gap-3 text-sm text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-900/50">
            <ShieldAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
            <p className="leading-relaxed">{t('pages.settings.thisWillReplaceYourSavedAppearancePrompt')}</p>
          </div>
          <p className="text-xs text-muted-foreground">{t('pages.settings.yourCreativelibraryRecordsCharactersProd')}</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <AppButton
              variant="outline"
              onClick={() => setIsRestoreDefaultsModalOpen(false)}
              size="sm"
              id="settings-restore-cancel-btn"
            >{t('pages.settings.cancel')}</AppButton>
            <AppButton
              variant="danger"
              onClick={confirmRestoreDefaults}
              size="sm"
              id="settings-restore-confirm-btn"
            >{t('pages.settings.restoreDefaults')}</AppButton>
          </div>
        </div>
      </AppModal>

      {/* Restore Workspace Backup Confirmation Modal */}
      <AppModal
        isOpen={isRestoreModalOpen}
        onClose={handleCancelRestore}
        title={t('pages.settings.restoreWorkspaceBackup')}
      >
        <div className="space-y-4 pt-2">
          <div className="flex gap-3 text-sm text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200 dark:border-amber-900/50">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
            <div>
              <p className="font-semibold">{t('pages.settings.restoringThisBackupWillReplaceTheCurrent')}</p>
              {hasUnsavedChanges && (
                <p className="mt-1 text-xs">{t('pages.settings.yourCurrentUnsavedPreferenceChangesWillA')}</p>
              )}
            </div>
          </div>

          {pendingBackup && (
            <div className="p-4 bg-muted/40 border border-border rounded-lg space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('pages.settings.backupSummary')}</h3>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                <div>{t('pages.settings.exportDate')}</div>
                <div className="font-medium text-right">{pendingBackup.exportedAt ? formatDate(pendingBackup.exportedAt) : 'N/A'}</div>
                <div>{t('pages.settings.campaigns')}</div>
                <div className="font-medium text-right">{pendingBackup.campaigns?.length || 0}</div>
                <div>{t('pages.settings.characters')}</div>
                <div className="font-medium text-right">{pendingBackup.characters?.length || 0}</div>
                <div>{t('pages.settings.products')}</div>
                <div className="font-medium text-right">{pendingBackup.products?.length || 0}</div>
                <div>{t('pages.settings.wardrobeItems')}</div>
                <div className="font-medium text-right">{pendingBackup.wardrobe?.length || 0}</div>
                <div>{t('pages.settings.scenes')}</div>
                <div className="font-medium text-right">{pendingBackup.scenes?.length || 0}</div>
                <div>{t('pages.settings.poses')}</div>
                <div className="font-medium text-right">{pendingBackup.poses?.length || 0}</div>
                <div>{t('pages.settings.prompthistoryEntries')}</div>
                <div className="font-medium text-right">{pendingBackup.promptHistory?.length || 0}</div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <AppButton
              variant="outline"
              onClick={handleCancelRestore}
              size="sm"
              id="settings-restore-backup-cancel"
            >{t('pages.settings.cancel')}</AppButton>
            <AppButton
              variant="primary"
              onClick={handleConfirmRestore}
              size="sm"
              id="settings-restore-backup-confirm"
            >{t('pages.settings.restoreWorkspace')}</AppButton>
          </div>
        </div>
      </AppModal>

      {/* Clear Workspace Data Modal */}
      <AppModal
        isOpen={isClearWorkspaceModalOpen}
        onClose={closeClearWorkspaceModal}
        title={t('pages.settings.clearWorkspaceData')}
      >
        <div className="space-y-4 pt-2">
          <div className="flex gap-3 text-sm text-red-800 dark:text-red-400 bg-red-50 dark:bg-red-950/20 p-3 rounded-lg border border-red-200 dark:border-red-900/50">
            <ShieldAlert className="h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
            <div>
              <p className="font-semibold">{t('pages.settings.thisWillPermanentlyRemoveCampaignsCreati')}</p>
              <p className="mt-1 text-xs font-medium">{t('pages.settings.thisActionCannotBeUndoneUnlessYouHaveDow')}</p>
              {hasUnsavedChanges && (
                <p className="mt-1 text-xs">{t('pages.settings.yourCurrentUnsavedPreferenceChangesWillA')}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="clear-confirmation-input" className="block text-sm font-medium text-foreground">{t('pages.settings.typeClearToConfirm')}</label>
            <AppInput
              type="text"
              id="clear-confirmation-input"
              value={clearConfirmationText}
              onChange={(e) => setClearConfirmationText(e.target.value)}
              placeholder={t('pages.settings.typeClearInAllCaps')}
              fullWidth
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <AppButton
              variant="outline"
              onClick={closeClearWorkspaceModal}
              size="sm"
              id="settings-clear-cancel"
            >{t('pages.settings.cancel')}</AppButton>
            <AppButton
              variant="danger"
              disabled={clearConfirmationText !== 'CLEAR'}
              onClick={handleClearWorkspace}
              size="sm"
              id="settings-clear-confirm"
            >{t('pages.settings.clearWorkspace')}</AppButton>
          </div>
        </div>
      </AppModal>
    </div>
  );
}

export default SettingsPage;
