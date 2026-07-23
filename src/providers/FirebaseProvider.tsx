import { ReactNode } from 'react';

interface FirebaseProviderProps {
  children: ReactNode;
}

export default function FirebaseProvider({ children }: FirebaseProviderProps) {
  // Wrap app components needing firebase context here if needed
  return <>{children}</>;
}
