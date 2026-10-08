import React, { createContext, useContext, useEffect, useState } from 'react';
import { fetchMe, login as apiLogin, logout as apiLogout, register as apiRegister, resetPassword as apiResetPassword, SessionUser } from '../api/auth';
import { hasSession } from '../api/client';
import { registerForPush, unregisterPush } from '../utils/push';

interface SessionContextValue {
  user: SessionUser | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: Parameters<typeof apiRegister>[0]) => Promise<void>;
  resetPassword: (token: string, password: string, acceptedTermsVersion?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        if (await hasSession()) {
          const me = await fetchMe();
          setUser(me);
        }
      } catch {
        setUser(null);
      } finally {
        setInitializing(false);
      }
    })();
  }, []);

  // Dès qu'un compte est connecté, l'appareil s'inscrit aux notifications.
  const userId = user?.id;
  useEffect(() => {
    if (userId) void registerForPush();
  }, [userId]);

  // La réponse de connexion ne contient que l'essentiel ; le profil complet
  // (type de compte, société, adresse) est relu aussitôt, sinon l'écran
  // « Mes informations » repartait de valeurs vides.
  const loadFullProfile = async () => {
    try { setUser(await fetchMe()); } catch { /* on garde le profil minimal */ }
  };

  const value: SessionContextValue = {
    user,
    initializing,
    login: async (email, password) => {
      const r = await apiLogin(email, password);
      setUser(r.user);
      void loadFullProfile();
    },
    register: async (input) => {
      const r = await apiRegister(input);
      setUser(r.user);
      void loadFullProfile();
    },
    resetPassword: async (token, password, acceptedTermsVersion) => {
      const r = await apiResetPassword(token, password, acceptedTermsVersion);
      setUser(r.user);
      void loadFullProfile();
    },
    logout: async () => {
      // Avant de fermer la session : la route exige d'être connecté.
      await unregisterPush();
      await apiLogout();
      setUser(null);
    },
    refresh: async () => {
      try { setUser(await fetchMe()); } catch { setUser(null); }
    },
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within <SessionProvider>');
  return ctx;
}
