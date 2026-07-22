'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiClient, ApiError } from '@carp-partners/api-client';
import type { User, Subscription } from '@carp-partners/api-client';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface SessionContextValue {
  user: User | null;
  subscription: Subscription | null;
  status: SessionStatus;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Actualiza el usuario en memoria tras editar el perfil (nombre/avatar) */
  setUser: (user: User) => void;
  /** True si la suscripción da acceso (active | trialing | past_due, con period_end vigente o sin caducidad) */
  hasSubscription: boolean;
  /** Vuelve a pedir /auth/me — lo usa /planes/activada mientras espera al webhook de Stripe */
  refresh: () => Promise<{ user: User; subscription: Subscription | null }>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession debe usarse dentro de <SessionProvider>');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');

  // Intenta restaurar la sesión desde el refreshToken guardado en localStorage
  useEffect(() => {
    apiClient
      .restoreSession()
      .then((data) => {
        if (data) {
          setUser(data.user);
          setSubscription(data.subscription);
          setStatus('authenticated');
        } else {
          setStatus('unauthenticated');
        }
      })
      .catch(() => setStatus('unauthenticated'));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiClient.login(email, password);
    // Cargamos suscripción inmediatamente
    const me = await apiClient.getMe();
    setUser(me.user);
    setSubscription(me.subscription);
    setStatus('authenticated');
    void data; // apiClient ya guardó los tokens
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    await apiClient.register(email, password, name);
    const me = await apiClient.getMe();
    setUser(me.user);
    setSubscription(me.subscription);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await apiClient.logout();
    setUser(null);
    setSubscription(null);
    setStatus('unauthenticated');
  }, []);

  const refresh = useCallback(async () => {
    const me = await apiClient.getMe();
    setUser(me.user);
    setSubscription(me.subscription);
    return me;
  }, []);

  // Mismo criterio que requireSubscription en el backend: period_end NULL =
  // sin caducidad, si no, tiene que ser una fecha futura. No basta con el
  // status — si no, una cortesía o un plan de pago caducado seguiría dando
  // acceso en el cliente hasta que se recargaran datos frescos de otra forma.
  const notExpired = !subscription?.period_end || new Date(subscription.period_end) > new Date();
  const hasSubscription =
    !!subscription && notExpired &&
    (subscription.status === 'active' || subscription.status === 'trialing' || subscription.status === 'past_due');

  return (
    <SessionContext.Provider value={{ user, subscription, status, login, register, logout, setUser, hasSubscription, refresh }}>
      {children}
    </SessionContext.Provider>
  );
}
