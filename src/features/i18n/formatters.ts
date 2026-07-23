import type { SupportedLocale } from './types';

export function formatDate(date: Date | string | number, locale: SupportedLocale): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (!Number.isFinite(d.getTime())) return '';
  
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function formatDateTime(date: Date | string | number, locale: SupportedLocale): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (!Number.isFinite(d.getTime())) return '';

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);
}

export function formatNumber(value: number, locale: SupportedLocale, options?: Intl.NumberFormatOptions): string {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatPercentage(value: number, locale: SupportedLocale): string {
  if (!Number.isFinite(value)) return '0%';
  // Assuming value is a fraction (e.g., 0.123 -> 12.3%), let's format it.
  // We can pass style: 'percent' to NumberFormat
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDuration(seconds: number, locale: SupportedLocale): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0s';
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);

  if (locale === 'pt-BR') {
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  } else if (locale === 'es') {
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  } else {
    // English
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  }
}

export function formatRelativeDate(date: Date | string | number, locale: SupportedLocale): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (!Number.isFinite(d.getTime())) return '';

  const now = new Date();
  const diffInSeconds = Math.floor((d.getTime() - now.getTime()) / 1000);
  
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (Math.abs(diffInSeconds) < 60) {
    return rtf.format(diffInSeconds, 'second');
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (Math.abs(diffInMinutes) < 60) {
    return rtf.format(diffInMinutes, 'minute');
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (Math.abs(diffInHours) < 24) {
    return rtf.format(diffInHours, 'hour');
  }

  const diffInDays = Math.floor(diffInHours / 24);
  return rtf.format(diffInDays, 'day');
}
