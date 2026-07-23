import type { SupportedLocale, TranslationDictionary } from './types';
import { ptBR } from './locales/pt-BR';
import { en } from './locales/en';
import { es } from './locales/es';
import { DEFAULT_LOCALE } from './localeConfig';

const DICTIONARIES: Record<SupportedLocale, TranslationDictionary> = {
  'pt-BR': ptBR,
  en,
  es,
};

// Simple in-memory flag for missing key tracking in tests/development
export const missingKeysLog: string[] = [];

export function getTranslationValue(
  locale: SupportedLocale,
  keyPath: string,
  variables?: Record<string, any>
): string {
  const parts = keyPath.split('.');
  const hasCount = variables && typeof variables.count === 'number';
  let result: any = undefined;

  // 1. If pluralization count is provided, look up plural keys first
  if (hasCount) {
    const countVal = variables.count;
    const pluralRules = new Intl.PluralRules(locale);
    const category = pluralRules.select(countVal); // 'zero' | 'one' | 'two' | 'few' | 'many' | 'other'

    const lastPart = parts[parts.length - 1];
    const prefixParts = parts.slice(0, -1);

    const zeroParts = countVal === 0 ? [...prefixParts, `${lastPart}_zero`] : [];
    const categoryParts = [...prefixParts, `${lastPart}_${category}`];
    const otherParts = [...prefixParts, `${lastPart}_other`];

    // Try zero specific form
    if (countVal === 0) {
      result = getValueByPath(DICTIONARIES[locale], zeroParts);
      if (typeof result !== 'string' && locale !== DEFAULT_LOCALE) {
        result = getValueByPath(DICTIONARIES[DEFAULT_LOCALE], zeroParts);
      }
    }

    // Try category specific form (one, etc.)
    if (typeof result !== 'string') {
      result = getValueByPath(DICTIONARIES[locale], categoryParts);
      if (typeof result !== 'string' && locale !== DEFAULT_LOCALE) {
        result = getValueByPath(DICTIONARIES[DEFAULT_LOCALE], categoryParts);
      }
    }

    // Try "other" fallback form
    if (typeof result !== 'string') {
      result = getValueByPath(DICTIONARIES[locale], otherParts);
      if (typeof result !== 'string' && locale !== DEFAULT_LOCALE) {
        result = getValueByPath(DICTIONARIES[DEFAULT_LOCALE], otherParts);
      }
    }
  }

  // 2. Fall back to base key lookup if no plural form matches or count not provided
  if (typeof result !== 'string') {
    result = getValueByPath(DICTIONARIES[locale], parts);
    if (typeof result !== 'string' && locale !== DEFAULT_LOCALE) {
      result = getValueByPath(DICTIONARIES[DEFAULT_LOCALE], parts);
    }
  }

  // 3. Handle absolute missing keys
  if (typeof result !== 'string') {
    if (variables && typeof variables.defaultValue === 'string') {
      return interpolateVariables(variables.defaultValue, variables);
    }
    const missingWarning = `[missing: ${keyPath}]`;
    if (!missingKeysLog.includes(keyPath)) {
      missingKeysLog.push(keyPath);
    }
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`Translation key not found: ${keyPath}`);
    }
    return missingWarning;
  }

  // 4. Perform variable interpolation
  return interpolateVariables(result, variables);
}

function getValueByPath(obj: any, parts: string[]): any {
  let current = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return current;
}

function interpolateVariables(template: string, variables?: Record<string, any>): string {
  if (!variables) {
    return template;
  }

  // Safe variable replacement to avoid eval, Function, or template-execution security issues
  return template.replace(/\{([^{}]+)\}/g, (match, name) => {
    const trimmedName = name.trim();
    if (trimmedName in variables) {
      const val = variables[trimmedName];
      return val !== undefined && val !== null ? String(val) : '';
    }
    return match; // Keep the placeholder if no value is provided (or we can return empty/safe string)
  });
}
