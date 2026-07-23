import { useI18n } from './I18nProvider';
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercentage,
  formatDuration,
  formatRelativeDate,
} from './formatters';

export function useTranslation() {
  const { locale, t, changeLocale } = useI18n();

  return {
    locale,
    t,
    changeLocale,
    formatDate: (date: Date | string | number) => formatDate(date, locale),
    formatDateTime: (date: Date | string | number) => formatDateTime(date, locale),
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) => formatNumber(value, locale, options),
    formatPercentage: (value: number) => formatPercentage(value, locale),
    formatDuration: (seconds: number) => formatDuration(seconds, locale),
    formatRelativeDate: (date: Date | string | number) => formatRelativeDate(date, locale),
  };
}
