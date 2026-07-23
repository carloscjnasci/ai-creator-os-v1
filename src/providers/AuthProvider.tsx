
import React, { ReactNode, useEffect, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';

function hasFirebaseConfiguration(): boolean {
  return Boolean(
    import.meta.env.VITE_FIREBASE_API_KEY &&
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
      import.meta.env.VITE_FIREBASE_PROJECT_ID &&
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET &&
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID &&
      import.meta.env.VITE_FIREBASE_APP_ID
  );
}

interface AuthContextType {
  user: FirebaseUser | null;
  loading: boolean;
}

const AuthContext = React.createContext<AuthContextType>({ user: null, loading: true });

export function useAuth() {
  return React.useContext(AuthContext);
}

interface AuthProviderProps {
  children: ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;
    let unsubscribe: (() => void) | undefined;

    async function initializeAuth(): Promise<void> {
      if (!hasFirebaseConfiguration()) {
        if (isActive) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const [firebaseModule, authModule] = await Promise.all([
          import('@/lib/firebase/firebase'),
          import('firebase/auth'),
        ]);

        if (!isActive) {
          return;
        }

        const { auth } = firebaseModule;
        const { onAuthStateChanged } = authModule;

        if (!auth) {
          setUser(null);
          setLoading(false);
          return;
        }

        unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          if (!isActive) {
            return;
          }
          setUser(currentUser);
          setLoading(false);
        });
      } catch {
        if (isActive) {
          setUser(null);
          setLoading(false);
        }
      }
    }

    void initializeAuth();

    return () => {
      isActive = false;
      unsubscribe?.();
    };
  }, []);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
}
