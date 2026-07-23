import type { TranslationDictionary, SupportedLocale } from './types';
import { ptBR } from './locales/pt-BR';
import { en } from './locales/en';
import { es } from './locales/es';

export const allLocales: Record<SupportedLocale, TranslationDictionary> = {
  'pt-BR': ptBR,
  en,
  es,
};

export function checkDictionaryIntegrity(): {
  isValid: boolean;
  missingKeys: { locale: string; keyPath: string }[];
} {
  const missingKeys: { locale: string; keyPath: string }[] = [];
  const baseKeys = getFlatKeys(ptBR);

  const targets: { locale: SupportedLocale; dict: TranslationDictionary }[] = [
    { locale: 'en', dict: en },
    { locale: 'es', dict: es },
  ];

  for (const target of targets) {
    for (const keyPath of baseKeys) {
      if (!hasKeyPath(target.dict, keyPath)) {
        missingKeys.push({ locale: target.locale, keyPath });
      }
    }
  }

  return {
    isValid: missingKeys.length === 0,
    missingKeys,
  };
}

function getFlatKeys(obj: any, prefix = ''): string[] {
  let keys: string[] = [];
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        keys = keys.concat(getFlatKeys(obj[key], path));
      } else {
        keys.push(path);
      }
    }
  }
  return keys;
}

function hasKeyPath(obj: any, keyPath: string): boolean {
  const parts = keyPath.split('.');
  let current = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return false;
    }
  }
  return typeof current === 'string';
}
