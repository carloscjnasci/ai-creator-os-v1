import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { SupportedLocale } from './types';
import { sanitizeLocale } from './localeConfig';
import { getTranslationValue } from './translationUtils';
import {
  loadSettingsFromStorage,
  saveSettingsToStorage,
  SETTINGS_CHANGED_EVENT,
  SETTINGS_STORAGE_KEY,
} from '../settings/settingsStorage';

interface I18nContextType {
  locale: SupportedLocale;
  t: (keyPath: string, variables?: Record<string, any>) => string;
  changeLocale: (newLocale: SupportedLocale) => { success: boolean; error?: string };
}

const I18nContext = createContext<I18nContextType | null>(null);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load initial settings and derive locale
  const [locale, setLocale] = useState<SupportedLocale>(() => {
    const settings = loadSettingsFromStorage();
    const parsedLocale = sanitizeLocale(settings.locale);
    
    // Update HTML doc language immediately during initialization
    if (typeof document !== 'undefined') {
      document.documentElement.lang = parsedLocale;
    }
    return parsedLocale;
  });

  // Sync state with storage and document element
  const syncLocale = useCallback((newLocale: SupportedLocale) => {
    setLocale((prev) => {
      if (prev === newLocale) return prev;
      if (typeof document !== 'undefined') {
        document.documentElement.lang = newLocale;
      }
      return newLocale;
    });
  }, []);

  // Set up event listeners for settings updates and cross-tab storage changes
  useEffect(() => {
    const handleSettingsChanged = () => {
      const settings = loadSettingsFromStorage();
      const currentLocale = sanitizeLocale(settings.locale);
      syncLocale(currentLocale);
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === SETTINGS_STORAGE_KEY) {
        const settings = loadSettingsFromStorage();
        const currentLocale = sanitizeLocale(settings.locale);
        syncLocale(currentLocale);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(SETTINGS_CHANGED_EVENT, handleSettingsChanged);
      window.addEventListener('storage', handleStorageEvent);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(SETTINGS_CHANGED_EVENT, handleSettingsChanged);
        window.removeEventListener('storage', handleStorageEvent);
      }
    };
  }, [syncLocale]);

  // Expose changeLocale to update settings
  const changeLocale = useCallback((newLocale: SupportedLocale) => {
    const sanitized = sanitizeLocale(newLocale);
    const settings = loadSettingsFromStorage();
    settings.locale = sanitized;
    const ok = saveSettingsToStorage(settings);
    if (ok) {
      syncLocale(sanitized);
      return { success: true };
    }
    return { success: false, error: 'settings.saveError' };
  }, [syncLocale]);

  // Translation function bound to current locale
  const t = useCallback((keyPath: string, variables?: Record<string, any>) => {
    return getTranslationValue(locale, keyPath, variables);
  }, [locale]);

  const value = React.useMemo(() => ({
    locale,
    t,
    changeLocale,
  }), [locale, t, changeLocale]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
};

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
