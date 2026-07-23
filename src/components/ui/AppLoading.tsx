import React from 'react';
import { useTranslation } from '@/features/i18n/useTranslation';

interface AppLoadingProps {
  variant?: 'spinner' | 'skeleton';
  className?: string;
}

export const AppLoading: React.FC<AppLoadingProps> = ({ variant = 'spinner', className = '' }) => {
  const { t } = useTranslation();
  if (variant === 'skeleton') {
    return <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-md h-6 w-full ${className}`}></div>;
  }

  return (
    <div className={`flex justify-center items-center ${className}`} role="status" aria-live="polite">
      <svg
        className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600 dark:text-blue-400"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        ></path>
      </svg>
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  );
};

export default AppLoading;
