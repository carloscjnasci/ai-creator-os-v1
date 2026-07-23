import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  loadSettingsFromStorage,
  SETTINGS_STORAGE_KEY,
  LEGACY_THEME_STORAGE_KEY,
  saveSettingsToStorage,
  SETTINGS_CHANGED_EVENT,
} from '../features/settings/settingsStorage';
import type { SettingsThemePreference } from '../features/settings/types';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  resolvedTheme: Theme;
  setTheme: (theme?: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getInitialThemePreference():
  SettingsThemePreference {
  return loadSettingsFromStorage().theme;
}

interface ThemeProviderProps {
  children: ReactNode;
}

export default function ThemeProvider({ children }: ThemeProviderProps) {
  const [themePreference, setThemePreference] = useState<SettingsThemePreference>(
    getInitialThemePreference,
  );
  const [systemTheme, setSystemTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const handleSettingsChanged = (): void => {
      setThemePreference(
        loadSettingsFromStorage().theme,
      );
    };

    window.addEventListener(
      SETTINGS_CHANGED_EVENT,
      handleSettingsChanged,
    );

    return () => {
      window.removeEventListener(
        SETTINGS_CHANGED_EVENT,
        handleSettingsChanged,
      );
    };
  }, []);

  const resolvedTheme = useMemo<Theme>(() => {
    if (themePreference === 'light') return 'light';
    if (themePreference === 'dark') return 'dark';
    return systemTheme;
  }, [themePreference, systemTheme]);

  // Handle setting/toggling the theme explicitly
  const setTheme = (
    requestedTheme?: Theme,
  ): void => {
    const currentSettings =
      loadSettingsFromStorage();

    const nextTheme =
      requestedTheme ??
      (
        resolvedTheme === 'dark'
          ? 'light'
          : 'dark'
      );

    if (
      saveSettingsToStorage({
        ...currentSettings,
        theme: nextTheme,
      })
    ) {
      setThemePreference(nextTheme);
    }
  };

  // Synchronize DOM elements and local state when resolvedTheme changes
  useEffect(() => {
    document.documentElement.classList.toggle(
      'dark',
      resolvedTheme === 'dark',
    );
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  // Listener for cross-tab theme changes (both settings and legacy keys)
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (
        event.storageArea !== window.localStorage
      ) {
        return;
      }
      if (
        event.key === SETTINGS_STORAGE_KEY ||
        event.key === LEGACY_THEME_STORAGE_KEY ||
        event.key === null
      ) {
        setThemePreference(
          loadSettingsFromStorage().theme,
        );
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // System theme changes listener (only active when preference is 'system')
  useEffect(() => {
    if (themePreference !== 'system') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener(
      'change',
      handleSystemThemeChange,
    );

    // Sync initial value in case it changed
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');

    return () => {
      mediaQuery.removeEventListener(
        'change',
        handleSystemThemeChange,
      );
    };
  }, [themePreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ resolvedTheme, setTheme }),
    [resolvedTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider.');
  }

  return context;
}
