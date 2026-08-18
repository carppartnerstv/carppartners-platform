'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCookieConsent } from '@/context/CookieConsentContext';

// Banner de consentimiento (RGPD/ePrivacy) + panel de configuración por
// categorías. Aceptar/Rechazar tienen el mismo peso visual a propósito — la
// AEPD y otras autoridades consideran "dark pattern" destacar Aceptar sobre
// Rechazar. Nada de esto carga Google Analytics por sí mismo: solo escribe
// la decisión en el contexto (CookieConsentContext), que es quien decide si
// se monta <GoogleAnalytics />.
export function CookieConsentBanner() {
  const {
    consent, bannerVisible, settingsOpen,
    acceptAll, rejectAll, savePreferences, openSettings, closeSettings,
  } = useCookieConsent();

  const [analyticsChoice, setAnalyticsChoice] = useState(false);

  const showFloatingButton = !bannerVisible && !settingsOpen;

  // Al abrir el panel, parte siempre de la preferencia ya guardada (o
  // desactivada por defecto si el usuario aún no ha decidido nada).
  useEffect(() => {
    if (settingsOpen) setAnalyticsChoice(consent?.analytics ?? false);
  }, [settingsOpen, consent]);

  return (
    <>
      {bannerVisible && !settingsOpen && (
        <div
          role="dialog"
          aria-label="Consentimiento de cookies"
          className="fixed bottom-0 left-0 right-0 z-[100] px-4 py-4 sm:px-6"
          style={{ background: '#0a0d10', borderTop: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 -8px 30px rgba(0,0,0,0.4)' }}
        >
          <div className="max-w-[1100px] mx-auto flex flex-col md:flex-row md:items-center gap-4">
            <p className="text-[13.5px] leading-relaxed flex-1" style={{ color: '#c4d0cb' }}>
              Usamos cookies técnicas necesarias para el funcionamiento del sitio y, si nos das tu
              consentimiento, cookies analíticas (Google Analytics) para entender cómo se usa la
              plataforma y mejorarla. Puedes aceptarlas, rechazarlas o configurar tu elección. Más
              información en nuestra{' '}
              <Link href="/politica-de-cookies" className="underline hover:text-white transition-colors">
                Política de Cookies
              </Link>.
            </p>
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <button
                onClick={openSettings}
                className="px-4 py-2.5 rounded-lg text-[13px] font-semibold text-white/75 hover:text-white transition-colors"
              >
                Configurar
              </button>
              <button
                onClick={rejectAll}
                className="px-4 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-colors"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)' }}
              >
                Rechazar
              </button>
              <button
                onClick={acceptAll}
                className="px-5 py-2.5 rounded-lg text-[13px] font-bold text-white transition-transform hover:scale-[1.03]"
                style={{ background: '#68140b', boxShadow: '0 4px 16px rgba(104,20,11,0.45)' }}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Configuración de cookies"
        >
          <div className="absolute inset-0 bg-black/70" onClick={closeSettings} />
          <div
            className="relative w-full sm:max-w-[560px] max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-6 sm:p-7"
            style={{ background: '#0e151a', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-display font-bold text-white text-[19px]">Configuración de cookies</h2>
              <button onClick={closeSettings} aria-label="Cerrar" className="text-white/50 hover:text-white transition-colors p-1">
                <i className="ti ti-x text-[20px]" />
              </button>
            </div>
            <p className="text-[13px] mb-5" style={{ color: '#9aa9a3' }}>
              Elige qué cookies no esenciales quieres permitir. Puedes cambiar esta elección cuando
              quieras desde &quot;Configuración de cookies&quot; en el pie de página. Más información
              en la{' '}
              <Link href="/politica-de-cookies" className="underline hover:text-white transition-colors" onClick={closeSettings}>
                Política de Cookies
              </Link>.
            </p>

            <div className="space-y-3 mb-6">
              <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center justify-between gap-4 mb-1.5">
                  <span className="text-[14px] font-semibold text-white">Técnicas y de seguridad</span>
                  <span
                    className="text-[10.5px] font-bold uppercase tracking-wide px-2 py-1 rounded-md shrink-0"
                    style={{ background: 'rgba(255,255,255,0.1)', color: '#c4d0cb' }}
                  >
                    Siempre activas
                  </span>
                </div>
                <p className="text-[12.5px] leading-relaxed" style={{ color: '#8a9891' }}>
                  Imprescindibles para que la plataforma funcione: mantener tu sesión iniciada y
                  protegerte frente a accesos no autorizados. No se pueden desactivar.
                </p>
              </div>

              <div className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center justify-between gap-4 mb-1.5">
                  <span className="text-[14px] font-semibold text-white">Analíticas (Google Analytics)</span>
                  <ToggleSwitch checked={analyticsChoice} onChange={setAnalyticsChoice} label="Cookies analíticas" />
                </div>
                <p className="text-[12.5px] leading-relaxed" style={{ color: '#8a9891' }}>
                  Nos ayudan a entender cómo se usa la plataforma (páginas visitadas, tiempo de
                  navegación) para mejorarla. No se activan hasta que las aceptes aquí.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={rejectAll}
                className="flex-1 px-4 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-colors"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)' }}
              >
                Rechazar todas
              </button>
              <button
                onClick={() => savePreferences(analyticsChoice)}
                className="flex-1 px-4 py-2.5 rounded-lg text-[13px] font-bold text-white transition-transform hover:scale-[1.02]"
                style={{ background: '#68140b', boxShadow: '0 4px 16px rgba(104,20,11,0.45)' }}
              >
                Guardar selección
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Botón flotante persistente: siempre hay una forma de reabrir el
          configurador, hayas decidido ya o no y aunque la página actual no
          tenga pie de página (p.ej. /contacto) — antes, si cancelabas el
          panel sin decidir en una página así, no había manera de volver a
          abrirlo. */}
      {showFloatingButton && (
        <button
          onClick={openSettings}
          aria-label="Configuración de cookies"
          title="Configuración de cookies"
          className="fixed bottom-4 left-4 z-[90] w-11 h-11 rounded-full flex items-center justify-center transition-transform hover:scale-[1.06]"
          style={{ background: '#0e151a', border: '1px solid rgba(255,255,255,0.16)', boxShadow: '0 6px 20px rgba(0,0,0,0.45)', color: '#c4d0cb' }}
        >
          <i className="ti ti-cookie text-[20px]" />
        </button>
      )}
    </>
  );
}

function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative w-11 h-6 rounded-full shrink-0 overflow-hidden p-0 border-0 transition-colors"
      style={{ background: checked ? '#68140b' : 'rgba(255,255,255,0.18)' }}
    >
      {/* left-0 explícito: sin él, el botón hereda el padding por defecto
          del navegador y el círculo partía de una posición "auto" distinta
          según el navegador, saliéndose del óvalo al activarlo. */}
      <span
        className="absolute left-0 top-[3px] w-[18px] h-[18px] rounded-full bg-white transition-transform"
        style={{ transform: checked ? 'translateX(23px)' : 'translateX(3px)' }}
      />
    </button>
  );
}
