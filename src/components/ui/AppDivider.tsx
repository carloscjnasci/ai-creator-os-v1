import React from 'react';

interface AppDividerProps {
  className?: string;
}

export const AppDivider: React.FC<AppDividerProps> = ({ className = '' }) => {
  return <hr className={`border-t border-gray-300 dark:border-gray-700 my-4 ${className}`} />;
};

export default AppDivider;
