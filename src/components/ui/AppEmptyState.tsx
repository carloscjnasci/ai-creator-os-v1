import React from 'react';

interface AppEmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const AppEmptyState: React.FC<AppEmptyStateProps> = ({ icon, title, description, action }) => {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      <div className="mb-4 text-gray-400 dark:text-gray-600 text-6xl">{icon}</div>
      <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">{title}</h3>
      <p className="text-sm mb-4 text-gray-600 dark:text-gray-400 max-w-xs">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
};

export default AppEmptyState;
