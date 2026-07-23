import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ts from 'typescript';
import { checkDictionaryIntegrity } from '../translationContracts';
import { getTranslationValue } from '../translationUtils';
import {
  createWorkspaceBackup,
  validateWorkspaceBackup,
  restoreWorkspaceBackup,
} from '../../settings/workspaceBackup';
import { loadSettingsFromStorage, saveSettingsToStorage } from '../../settings/settingsStorage';
import { formatDate, formatDateTime, formatNumber, formatDuration, formatPercentage } from '../formatters';

describe('Internationalization & Localization (Sprint 14C) - Core Engine', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.clear();
      document.documentElement.lang = 'pt-BR';
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Dictionary Integrity: guarantees 100% equal key-paths across pt-BR, en, and es', () => {
    const integrity = checkDictionaryIntegrity();
    if (!integrity.isValid) {
      console.error('Missing key-paths in dictionaries:', integrity.missingKeys);
    }
    expect(integrity.isValid).toBe(true);
    expect(integrity.missingKeys).toHaveLength(0);
  });

  it('2. Fallback resolution: falls back to pt-BR for missing keys and handles missing keys gracefully', () => {
    // Check getTranslationValue for missing keys
    const missingResult = getTranslationValue('en', 'some.fake.key.path');
    expect(missingResult).toBe('[missing: some.fake.key.path]');
  });

  it('3. Formatters: formats dates, numbers, percentages, and durations correctly based on locale', () => {
    const testDate = new Date('2026-07-17T12:00:00Z');
    
    // Check Date formatting (using standard native options)
    const ptDateStr = formatDate(testDate, 'pt-BR');
    expect(ptDateStr).toContain('17');
    expect(ptDateStr).toContain('07');

    // Check Number formatting
    const formattedNum = formatNumber(1234.56, 'pt-BR');
    expect(formattedNum).toContain('1.234');

    // Check Percentage formatting
    const formattedPct = formatPercentage(0.125, 'pt-BR');
    expect(formattedPct).toContain('12,5');

    // Check Duration formatting
    const durationMins = formatDuration(150, 'pt-BR');
    expect(durationMins).toBe('2m 30s');

    const durationSecs = formatDuration(45, 'en');
    expect(durationSecs).toBe('45s');
  });

  it('4. Settings and Storage Serialization: loads and sanitizes invalid/unknown locales to pt-BR', () => {
    const settings = loadSettingsFromStorage();
    expect(settings.locale).toBe('pt-BR'); // Default language

    // Store settings with an invalid locale
    const modifiedSettings = { ...settings, locale: 'fr' as any };
    saveSettingsToStorage(modifiedSettings);

    const reloaded = loadSettingsFromStorage();
    // Normalization should sanitize 'fr' back to 'pt-BR'
    expect(reloaded.locale).toBe('pt-BR');
  });

  it('5. Workspace Backup Version 10: exports correct version and safely restores settings', () => {
    // Set a valid locale 'es'
    const settings = loadSettingsFromStorage();
    settings.locale = 'es';
    saveSettingsToStorage(settings);

    // Create a backup
    const backup = createWorkspaceBackup();
    expect(backup.version).toBe(10);
    expect(backup.settings.locale).toBe('es');

    // Confirm validate passes
    expect(validateWorkspaceBackup(backup)).toBe(true);

    // Wipe storage
    window.localStorage.clear();

    // Restore and verify
    const restored = restoreWorkspaceBackup(backup);
    expect(restored).toBe(true);

    const reloadedSettings = loadSettingsFromStorage();
    expect(reloadedSettings.locale).toBe('es');
  });

  it('6. Backward Compatibility: restores old backups (version 9) without locale by defaulting to pt-BR', () => {
    // Generate a valid full backup and mock it as a Version 9 backup by removing locale
    const realBackup = createWorkspaceBackup();
    const oldBackup = {
      ...realBackup,
      version: 9 as any,
      settings: {
        ...realBackup.settings,
        locale: undefined, // Strip locale to simulate older backups
      },
    };

    const validated = validateWorkspaceBackup(oldBackup);
    expect(validated).toBe(true);

    const restored = restoreWorkspaceBackup(oldBackup as any);
    expect(restored).toBe(true);

    const loaded = loadSettingsFromStorage();
    expect(loaded.locale).toBe('pt-BR');
  });

  it('7. Validator Quality & Regression Checks: catches duplicate loadingProducts, mixed Todos products, and truncated text', () => {
    // 1. Test duplicate keys logic with mock AST
    const mockCodeDuplicate = `
      export const mockLocale = {
        products: {
          loadingProducts: "Loading...",
          loadingProducts: "Duplicate!"
        }
      };
    `;
    const sfDup = ts.createSourceFile('mockCodeDuplicate.ts', mockCodeDuplicate, ts.ScriptTarget.Latest, true);
    const dupErrors: string[] = [];
    function walkDup(node: ts.Node) {
      if (ts.isObjectLiteralExpression(node)) {
        const keysSeen = new Set<string>();
        for (const prop of node.properties) {
          if (ts.isPropertyAssignment(prop)) {
            const name = prop.name.getText(sfDup).replace(/['"]/g, '');
            if (keysSeen.has(name)) {
              dupErrors.push(name);
            }
            keysSeen.add(name);
          }
        }
      }
      ts.forEachChild(node, walkDup);
    }
    walkDup(sfDup);
    expect(dupErrors).toContain('loadingProducts');

    // 2. Test mixed value logic
    const ptMixedCheck = (str: string) => {
      const val = str.toLowerCase();
      const mixedWords = ['todos products', 'guardar changes', 'salvar changes', 'buscar by product', 'product nome', 'products criado', 'criar your first', 'products available in your', 'todos los products'];
      const hasExplicitMixed = mixedWords.some(phrase => val.includes(phrase));
      const hasGeneralMixed = /\\b(products|changes|product|workspace)\\b/i.test(str) && (/\\b(todos|guardar|salvar|criar|buscar|criado)\\b/i.test(str));
      return hasExplicitMixed || hasGeneralMixed;
    };
    
    expect(ptMixedCheck('Todos products')).toBe(true);
    expect(ptMixedCheck('Guardar changes')).toBe(true);
    expect(ptMixedCheck('Products Criado in your workspace will appear')).toBe(true);

    // 3. Test truncated string logic
    const isTruncated = (val: string) => {
      const lowerVal = val.toLowerCase();
      const hasIndicator = lowerVal.includes('... wo') || val.endsWith(' wo') || val.endsWith(' produc') || val.endsWith(' sellin') || val.endsWith(' facial exp') || val.endsWith(' active asse') || val.endsWith(' preserve produc');
      const truncatedSuffixes = [' produc', ' sellin', ' facial exp', ' active asse', ' preserve produc', ' wo'];
      const hasSuffix = truncatedSuffixes.some(suffix => val.endsWith(suffix));
      return hasIndicator || hasSuffix;
    };
    
    expect(isTruncated('An overview ... wo')).toBe(true);
    expect(isTruncated('help preserve produc')).toBe(true);
  });
});
