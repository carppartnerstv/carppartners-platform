'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { CookieConsentProvider, useCookieConsent } from '@/context/CookieConsentContext';
import { CookieConsentBanner } from './CookieConsentBanner';
import { GoogleAnalytics } from './GoogleAnalytics';

// Rutas de la banda de suscriptores (grupo de ruta `(subscriber)`, que no
// añade prefijo a la URL) — ahí NO debe aparecer ni el banner ni cargarse
// GA. Todo lo demás (landing, login, planes, páginas fijas, contacto...) se
// considera público.
const SUBSCRIBER_PREFIXES = ['/home', '/explorar', '/serie', '/watch', '/crew', '/mi-lista', '/perfil'];

function isPublicPath(pathname: string) {
  if (pathname.startsWith('/admin')) return false;
  return !SUBSCRIBER_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Envuelve TODA la app (montado una vez en el layout raíz) para que el
// contexto de consentimiento no se destruya/recree al navegar entre zona
// pública y de suscriptor — solo la UI visible (banner/panel) y la carga de
// GA se activan o no según la ruta actual.
export function CookieConsentGate({ children }: { children: React.ReactNode }) {
  return (
    <CookieConsentProvider>
      {children}
      <CookieConsentPublicUI />
    </CookieConsentProvider>
  );
}

function CookieConsentPublicUI() {
  const pathname = usePathname();
  const { consent } = useCookieConsent();
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  if (!isPublicPath(pathname ?? '')) return null;

  return (
    <>
      {gaId && consent?.analytics && <GoogleAnalytics measurementId={gaId} />}
      <CookieConsentBanner />
    </>
  );
}
