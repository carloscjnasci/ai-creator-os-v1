import React, { ReactNode } from 'react';

interface MainContentProps {
  children: ReactNode;
}

const MainContent: React.FC<MainContentProps> = ({ children }) => {
  return (
    <main className="flex-1 p-6 overflow-auto max-w-full sm:max-w-7xl mx-auto">
      {children}
    </main>
  );
};

export default MainContent;
