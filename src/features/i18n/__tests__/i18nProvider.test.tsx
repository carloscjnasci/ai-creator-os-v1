import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';

// Configure React 18 act environment support to prevent warning
// @ts-ignore
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import { createRoot } from 'react-dom/client';
import { I18nProvider, useI18n } from '../I18nProvider';
import { useTranslation } from '../useTranslation';
import { SETTINGS_STORAGE_KEY, SETTINGS_CHANGED_EVENT } from '../../settings/settingsStorage';
import { getTranslationValue, missingKeysLog } from '../translationUtils';

// Helper to render React components into JSDOM cleanly with React 18 createRoot
function renderWithProvider(ui: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<I18nProvider>{ui}</I18nProvider>);
  });
  return {
    container,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('I18nProvider and Core Events (Sprint 14C)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = 'pt-BR';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Initial pt-BR rendered text & <html lang> updates', () => {
    const TestComponent = () => {
      const { t } = useTranslation();
      return <div id="text">{t('navigation.dashboard')}</div>;
    };
    const { container, cleanup } = renderWithProvider(<TestComponent />);
    expect(container.querySelector('#text')?.textContent).toBe('Painel'); // pt-BR default is Painel
    expect(document.documentElement.lang).toBe('pt-BR');
    cleanup();
  });

  it('2. Switching to English and Spanish changes visible text immediately with no page reload', () => {
    let changeLocaleRef: any;
    const TestComponent = () => {
      const { t, changeLocale } = useTranslation();
      changeLocaleRef = changeLocale;
      return <div id="text">{t('navigation.dashboard')}</div>;
    };
    const { container, cleanup } = renderWithProvider(<TestComponent />);
    expect(container.querySelector('#text')?.textContent).toBe('Painel');

    // Switch to English
    act(() => {
      const res = changeLocaleRef('en');
      expect(res.success).toBe(true);
    });
    expect(container.querySelector('#text')?.textContent).toBe('Dashboard'); // English
    expect(document.documentElement.lang).toBe('en');

    // Switch to Spanish
    act(() => {
      const res = changeLocaleRef('es');
      expect(res.success).toBe(true);
    });
    expect(container.querySelector('#text')?.textContent).toBe('Tablero'); // Spanish
    expect(document.documentElement.lang).toBe('es');

    cleanup();
  });

  it('3. Persisted locale survives provider remount', () => {
    const TestComponent = () => {
      const { t, changeLocale } = useTranslation();
      return (
        <div>
          <span id="text">{t('navigation.dashboard')}</span>
          <button id="btn" onClick={() => changeLocale('es')}>Switch</button>
        </div>
      );
    };

    const firstRender = renderWithProvider(<TestComponent />);
    act(() => {
      firstRender.container.querySelector('#btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(firstRender.container.querySelector('#text')?.textContent).toBe('Tablero');
    firstRender.cleanup();

    // Remount
    const secondRender = renderWithProvider(<TestComponent />);
    expect(secondRender.container.querySelector('#text')?.textContent).toBe('Tablero');
    secondRender.cleanup();
  });

  it('4. Failed locale write returns explicit failure', () => {
    // Mock Storage.prototype.setItem to throw an error
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    let changeResult: any;
    const TestComponent = () => {
      const { changeLocale } = useTranslation();
      return (
        <button
          id="btn"
          onClick={() => {
            changeResult = changeLocale('en');
          }}
        >
          Click
        </button>
      );
    };

    const { container, cleanup } = renderWithProvider(<TestComponent />);
    act(() => {
      container.querySelector('#btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(changeResult).toEqual({ success: false, error: 'settings.saveError' });
    cleanup();
  });

  it('5. Custom settings change event and cross-tab storage event updates the provider', () => {
    const TestComponent = () => {
      const { t } = useTranslation();
      return <div id="text">{t('navigation.dashboard')}</div>;
    };
    const { container, cleanup } = renderWithProvider(<TestComponent />);
    expect(container.querySelector('#text')?.textContent).toBe('Painel');

    // Simulate settings saved in another tab / components
    act(() => {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ locale: 'es' }));
      window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
    });
    expect(container.querySelector('#text')?.textContent).toBe('Tablero');

    // Simulate cross-tab StorageEvent
    act(() => {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ locale: 'en' }));
      window.dispatchEvent(new StorageEvent('storage', {
        key: SETTINGS_STORAGE_KEY,
        newValue: JSON.stringify({ locale: 'en' }),
      }));
    });
    expect(container.querySelector('#text')?.textContent).toBe('Dashboard');

    cleanup();
  });

  it('6. Unrelated storage keys are ignored', () => {
    const TestComponent = () => {
      const { t } = useTranslation();
      return <div id="text">{t('navigation.dashboard')}</div>;
    };
    const { container, cleanup } = renderWithProvider(<TestComponent />);

    // Fire storage event for unrelated key
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'unrelated_key',
        newValue: 'some_value',
      }));
    });
    expect(container.querySelector('#text')?.textContent).toBe('Painel'); // Untouched

    cleanup();
  });

  it('7. Falls back to pt-BR for missing keys and tracks absolute missing keys', () => {
    // Missing English key
    const missingInEnglish = getTranslationValue('en', 'dashboard.nonExistentKey');
    expect(missingInEnglish).toContain('[missing: dashboard.nonExistentKey]');
    expect(missingKeysLog).toContain('dashboard.nonExistentKey');
  });

  it('8. Safe unknown interpolation variables', () => {
    const result = getTranslationValue('pt-BR', 'common.success', { missingVar: 'hello' });
    expect(result).toBe('Sucesso'); // Doesn't crash, keeps clean output
  });

  it('9. PluralRules pluralization behaves correctly in zero, singular, and plural forms across all 3 languages', () => {
    // pt-BR
    expect(getTranslationValue('pt-BR', 'dashboard.stats.activeCampaigns', { count: 0 })).toBe('Nenhuma campanha ativa');
    expect(getTranslationValue('pt-BR', 'dashboard.stats.activeCampaigns', { count: 1 })).toBe('1 campanha ativa');
    expect(getTranslationValue('pt-BR', 'dashboard.stats.activeCampaigns', { count: 2 })).toBe('2 campanhas ativas');
    expect(getTranslationValue('pt-BR', 'dashboard.stats.activeCampaigns', { count: 10 })).toBe('10 campanhas ativas');

    // en
    expect(getTranslationValue('en', 'dashboard.stats.activeCampaigns', { count: 0 })).toBe('No active campaigns');
    expect(getTranslationValue('en', 'dashboard.stats.activeCampaigns', { count: 1 })).toBe('1 active campaign');
    expect(getTranslationValue('en', 'dashboard.stats.activeCampaigns', { count: 2 })).toBe('2 active campaigns');
    expect(getTranslationValue('en', 'dashboard.stats.activeCampaigns', { count: 10 })).toBe('10 active campaigns');

    // es
    expect(getTranslationValue('es', 'dashboard.stats.activeCampaigns', { count: 0 })).toBe('Ninguna campaña activa');
    expect(getTranslationValue('es', 'dashboard.stats.activeCampaigns', { count: 1 })).toBe('1 campaña activa');
    expect(getTranslationValue('es', 'dashboard.stats.activeCampaigns', { count: 2 })).toBe('2 campañas activas');
    expect(getTranslationValue('es', 'dashboard.stats.activeCampaigns', { count: 10 })).toBe('10 campañas activas');
  });
});
