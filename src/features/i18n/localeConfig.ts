import type { SupportedLocale } from './types';

export const SUPPORTED_LOCALES: SupportedLocale[] = ['pt-BR', 'en', 'es'];

export const DEFAULT_LOCALE: SupportedLocale = 'pt-BR';

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  'pt-BR': 'Português (Brasil)',
  en: 'English',
  es: 'Español',
};

export function sanitizeLocale(locale: unknown): SupportedLocale {
  if (typeof locale === 'string' && (SUPPORTED_LOCALES as string[]).includes(locale)) {
    return locale as SupportedLocale;
  }
  return DEFAULT_LOCALE;
}
