import React, { createContext, useContext, useEffect, useState } from 'react';
import { fetchMe, login as apiLogin, logout as apiLogout, register as apiRegister, resetPassword as apiResetPassword, SessionUser } from '../api/auth';
import { hasSession } from '../api/client';
import { registerForPush, unregisterPush } from '../utils/push';

interface SessionContextValue {
  user: SessionUser | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; firstName: string; lastName: string; phone?: string }) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
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

  const value: SessionContextValue = {
    user,
    initializing,
    login: async (email, password) => {
      const r = await apiLogin(email, password);
      setUser(r.user);
    },
    register: async (input) => {
      const r = await apiRegister(input);
      setUser(r.user);
    },
    resetPassword: async (token, password) => {
      const r = await apiResetPassword(token, password);
      setUser(r.user);
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
