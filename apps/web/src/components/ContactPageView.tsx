'use client';

import React from 'react';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';
import { ContactForm } from '@/components/ContactForm';

// Página de contacto — mismo PublicHeader (con su menú de navegación) que el
// resto de páginas públicas: sin él, en móvil no había forma de seguir
// navegando sin volver primero a la landing. Debajo: en desktop, tarjeta
// central con fondo de rejilla + viñeta, copia + cita del equipo a la
// izquierda y el formulario a la derecha; en móvil, sin esa tarjeta, título +
// subtítulo + formulario directos sobre el fondo.
export function ContactPageView() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#06090c', fontFamily: 'Inter, sans-serif' }}>
      <PublicHeader />

      {/* pt-[110px] deja hueco al header, que va fixed — mismo valor que StaticPageLayout */}
      <div className="md:hidden px-5 pt-[110px] pb-12">
        <h1 className="font-display font-extrabold text-white mb-2.5" style={{ fontSize: 26, lineHeight: 1.15, letterSpacing: '-0.02em' }}>
          ¿Tienes alguna duda?<br />Escríbenos.
        </h1>
        <p className="mb-6" style={{ fontSize: 13.5, lineHeight: 1.6, color: '#9aa9a3' }}>
          Nuestro equipo te responderá en menos de 24h.
        </p>
        <ContactForm />
      </div>

      <div className="hidden md:flex flex-1 items-center justify-center px-6 pt-[110px] pb-[60px]">
        <div
          className="relative w-full max-w-[1100px] rounded-[24px] overflow-hidden"
          style={{ background: '#0a0d10', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {/* Fondo: rejilla + viñeta de color */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.045) 1px,transparent 1px)',
              backgroundSize: '64px 64px',
              maskImage: 'radial-gradient(70% 70% at 50% 40%,#000 0%,transparent 100%)',
              WebkitMaskImage: 'radial-gradient(70% 70% at 50% 40%,#000 0%,transparent 100%)',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(60% 50% at 15% 10%,rgba(104,20,11,0.35) 0%,rgba(104,20,11,0) 60%),radial-gradient(50% 50% at 100% 100%,rgba(207,74,53,0.18) 0%,rgba(207,74,53,0) 60%)',
            }}
          />

          <div className="relative grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-0 p-8 md:p-14">
            {/* ── Columna izquierda: copia + cita ── */}
            <div className="flex flex-col justify-center md:pr-10">
              <h1
                className="font-display font-extrabold text-white mb-4"
                style={{ fontSize: 'clamp(30px, 4vw, 40px)', lineHeight: 1.12, letterSpacing: '-0.02em' }}
              >
                ¿Tienes alguna duda?<br />Escríbenos.
              </h1>
              <p className="mb-10 max-w-[380px]" style={{ fontSize: 14.5, lineHeight: 1.65, color: '#9aa9a3' }}>
                Nuestro equipo te responderá en menos de 24h, ya sea sobre tu suscripción, sobre el contenido o sobre cualquier propuesta de colaboración.
              </p>

              <div className="mt-auto">
                <div className="text-[13px] font-semibold mb-3.5" style={{ color: '#cdd6d2' }}>Un mensaje del equipo</div>
                <p className="italic mb-5" style={{ fontSize: 14.5, lineHeight: 1.65, color: '#b3c0ba' }}>
                  &quot;Nuestra misión es acercar el carpfishing de más nivel a cualquier pescador, sin importar dónde esté. Si tienes dudas, propuestas o simplemente quieres saludar, aquí estamos.&quot;
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-display font-semibold text-[14px] text-white"
                    style={{ background: 'linear-gradient(135deg,#68140b,#2a1411)', border: '1px solid rgba(255,255,255,0.12)' }}
                  >
                    OV
                  </div>
                  <div>
                    <div className="text-[13.5px] font-semibold" style={{ color: '#eef3f0' }}>Oriol Vilamú</div>
                    <div className="text-[12px]" style={{ color: '#85958e' }}>Fundador, Carp Partners TV</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Columna derecha: formulario ── */}
            <ContactForm />
          </div>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}
