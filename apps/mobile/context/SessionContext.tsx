import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { ApiError } from '@carp-partners/api-client';
import type { User, Subscription } from '@carp-partners/api-client';
import { apiClient } from '../lib/apiClient';
import { registerForPushNotificationsAsync } from '../lib/pushNotifications';

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface SessionContextValue {
  user: User | null;
  subscription: Subscription | null;
  status: SessionStatus;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Actualiza el usuario en memoria tras editar el perfil (nombre/avatar) */
  setUser: (user: User) => void;
  /** True si la suscripción da acceso (active | trialing | past_due, con period_end vigente o sin caducidad) */
  hasSubscription: boolean;
  refresh: () => Promise<{ user: User; subscription: Subscription | null }>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession debe usarse dentro de <SessionProvider>');
  return ctx;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');
  const pushRegisteredRef = useRef(false);

  // Registra el token de push una sola vez por sesión en memoria, solo si
  // el usuario tiene el toggle Push activado (ver pestaña Avisos de Perfil).
  // El envío real además se filtra en el backend por esta misma preferencia.
  useEffect(() => {
    if (status !== 'authenticated' || pushRegisteredRef.current) return;
    if (!user?.notification_preferences?.push) return;
    pushRegisteredRef.current = true;
    registerForPushNotificationsAsync();
  }, [status, user]);

  // Intenta restaurar la sesión desde el refreshToken guardado en SecureStore
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
    await apiClient.login(email, password);
    const me = await apiClient.getMe();
    setUser(me.user);
    setSubscription(me.subscription);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await apiClient.logout();
    pushRegisteredRef.current = false;
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
  // sin caducidad, si no, tiene que ser una fecha futura.
  const notExpired = !subscription?.period_end || new Date(subscription.period_end) > new Date();
  const hasSubscription =
    !!subscription && notExpired &&
    (subscription.status === 'active' || subscription.status === 'trialing' || subscription.status === 'past_due');

  return (
    <SessionContext.Provider value={{ user, subscription, status, login, logout, setUser, hasSubscription, refresh }}>
      {children}
    </SessionContext.Provider>
  );
}

export { ApiError };
