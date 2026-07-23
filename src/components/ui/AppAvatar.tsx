import React from 'react';
import { useTranslation } from '@/features/i18n/useTranslation';

interface AppAvatarProps {
  src?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClass = {
  sm: 'w-6 h-6',
  md: 'w-10 h-10',
  lg: 'w-16 h-16',
};

export const AppAvatar: React.FC<AppAvatarProps> = ({ src, alt, size = 'md', className = '' }) => {
  const { t } = useTranslation();
  const displayAlt = alt !== undefined ? alt : t('pages.components.userAvatar');

  return (
    <img
      src={src}
      alt={displayAlt}
      className={`rounded-full object-cover ${sizeClass[size]} ${className}`}
      loading="lazy"
      draggable={false}
    />
  );
};

export default AppAvatar;
