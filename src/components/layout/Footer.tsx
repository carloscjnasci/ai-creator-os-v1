import React from 'react';
import { useTranslation } from '@/features/i18n';

const Footer: React.FC = () => {
  const { t } = useTranslation();
  return (
    <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-center py-3 text-sm text-gray-500 dark:text-gray-400">
      <span>{t('common.footerCopyright')} {t('common.version')} 1.0.0</span>
    </footer>
  );
};

export default Footer;
