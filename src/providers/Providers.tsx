import React, { ReactNode } from 'react';
import ThemeProvider from './ThemeProvider';
import AuthProvider from './AuthProvider';
import FirebaseProvider from './FirebaseProvider';
import { I18nProvider } from '../features/i18n/I18nProvider';

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <FirebaseProvider>
      <AuthProvider>
        <ThemeProvider>
          <I18nProvider>
            {children}
          </I18nProvider>
        </ThemeProvider>
      </AuthProvider>
    </FirebaseProvider>
  );
}
