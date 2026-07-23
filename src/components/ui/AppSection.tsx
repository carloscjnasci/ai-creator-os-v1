import React from 'react';

interface AppSectionProps {
  children?: React.ReactNode;
  className?: string;
}

export const AppSection: React.FC<AppSectionProps> = ({ children, className = '' }) => {
  return <section className={`mb-8 ${className}`}>{children}</section>;
};

export default AppSection;
