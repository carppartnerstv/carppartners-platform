'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  readConsentCookie,
  writeConsentCookie,
  deleteGoogleAnalyticsCookies,
  type ConsentState,
} from '@/lib/cookieConsent';

interface CookieConsentContextValue {
  /** null = el usuario todavía no ha decidido nada. */
  consent: ConsentState | null;
  /** true solo tras montar en cliente y comprobar que no hay cookie de consentimiento guardada. */
  bannerVisible: boolean;
  settingsOpen: boolean;
  acceptAll: () => void;
  rejectAll: () => void;
  savePreferences: (analytics: boolean) => void;
  openSettings: () => void;
  closeSettings: () => void;
}

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

// Gestiona la decisión de cookies (RGPD/ePrivacy): se persiste en una
// cookie propia (`cp_consent`, 12 meses) para no volver a preguntar en cada
// visita, y expone acceptAll/rejectAll/savePreferences para que el banner y
// el panel de configuración la cambien. No decide POR SÍ SOLO si mostrar el
// banner en esta ruta — de eso se encarga CookieConsentGate, que es quien
// sabe si la página actual es pública o de suscriptor.
export function CookieConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [mounted, setMounted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setConsent(readConsentCookie());
    setMounted(true);
  }, []);

  const apply = useCallback((next: ConsentState) => {
    setConsent((prev) => {
      const hadAnalytics = prev?.analytics === true;
      writeConsentCookie(next);
      if (hadAnalytics && !next.analytics) {
        // Revocar tras haber tenido GA activo: borra lo que ya hubiera
        // escrito y recarga para que el gtag ya inicializado deje de
        // seguir enviando eventos con el estado que tenía en memoria.
        deleteGoogleAnalyticsCookies();
        window.location.reload();
      }
      return next;
    });
    setSettingsOpen(false);
  }, []);

  const acceptAll = useCallback(() => apply({ analytics: true }), [apply]);
  const rejectAll = useCallback(() => apply({ analytics: false }), [apply]);
  const savePreferences = useCallback((analytics: boolean) => apply({ analytics }), [apply]);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  const value: CookieConsentContextValue = {
    consent,
    bannerVisible: mounted && consent === null,
    settingsOpen,
    acceptAll,
    rejectAll,
    savePreferences,
    openSettings,
    closeSettings,
  };

  return <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>;
}

export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) throw new Error('useCookieConsent debe usarse dentro de CookieConsentProvider');
  return ctx;
}
