'use client';

import React from 'react';
import Link from 'next/link';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';
import { ContactForm } from '@/components/ContactForm';
import { usePublicCarousel } from '@/components/Carousel';
import { Reveal } from '@/components/Reveal';

// Se gestiona desde /admin/carrousels, creando un carrousel con este slug
// exacto y subiendo sus imágenes ahí — nada hardcodeado en el código.
const HERO_SLUG = 'contacto-hero';

// Página de contacto — mismo PublicHeader (con su menú de navegación) que el
// resto de páginas públicas: sin él, en móvil no había forma de seguir
// navegando sin volver primero a la landing. Debajo del hero: en desktop,
// tarjeta central con fondo de rejilla + viñeta, copia + cita del equipo a
// la izquierda y el formulario a la derecha; en móvil, sin esa tarjeta,
// subtítulo + formulario directos sobre el fondo. Cierra con el mismo CTA
// final que "Sobre nosotros"/landing.
export function ContactPageView() {
  const { images: heroImages } = usePublicCarousel(HERO_SLUG);
  const heroImage = heroImages[0];

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden" style={{ background: '#06090c', fontFamily: 'Inter, sans-serif' }}>
      <PublicHeader />

      {/* ═══════════════ HERO — una sola imagen fija, igual que "Sobre nosotros" ═══════════════ */}
      <section className="relative min-h-[64vh] flex items-center justify-center text-center px-6 pt-[110px] pb-[60px] overflow-hidden">
        <div className="absolute inset-0">
          {heroImage ? (
            <img src={heroImage.image_url} alt={heroImage.alt_text ?? ''} aria-hidden className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(120% 90% at 70% 6%, #3a5560 0%, rgba(58,85,96,0) 52%), radial-gradient(120% 100% at 12% 88%, #2a1411 0%, rgba(42,20,17,0) 55%), linear-gradient(165deg, #0a161a 0%, #06090c 60%)',
              }}
            />
          )}
        </div>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(6,9,12,0.55) 0%, rgba(6,9,12,0.35) 40%, #06090c 100%)' }} />
        <h1
          className="relative font-display font-extrabold text-white max-w-[880px]"
          style={{ fontSize: 'clamp(28px, 5.5vw, 56px)', lineHeight: 1.15, letterSpacing: '-0.025em', textShadow: '0 6px 40px rgba(0,0,0,0.6)' }}
        >
          ¿Tienes alguna duda?<br />Escríbenos.
        </h1>
      </section>

      {/* ═══════════════ FORMULARIO — centrado, sin la cita del equipo ═══════════════ */}
      <Reveal className="md:hidden px-5 pt-8 pb-12">
        <h2 className="font-display font-bold text-white mb-2.5" style={{ fontSize: 22, letterSpacing: '-0.01em' }}>
          Contacta con Carp Partners
        </h2>
        <p className="mb-6" style={{ fontSize: 13.5, lineHeight: 1.6, color: '#9aa9a3' }}>
          Nuestro equipo te responderá en menos de 24h.
        </p>
        <ContactForm />
      </Reveal>

      <Reveal className="hidden md:flex flex-1 flex-col items-center justify-center px-6 pt-10 pb-[60px] text-center">
        <h2 className="font-display font-bold text-white mb-3" style={{ fontSize: 'clamp(24px,3vw,30px)', letterSpacing: '-0.01em' }}>
          Contacta con Carp Partners
        </h2>
        <p className="mb-10 mx-auto max-w-[420px]" style={{ fontSize: 14.5, lineHeight: 1.65, color: '#9aa9a3' }}>
          Nuestro equipo te responderá en menos de 24h, ya sea sobre tu suscripción, sobre el contenido o sobre cualquier propuesta de colaboración.
        </p>
        <div className="w-full max-w-[640px] text-left">
          <ContactForm />
        </div>
      </Reveal>

      {/* ═══════════════ CTA FINAL — mismo estilo que "Sobre nosotros"/landing ═══════════════ */}
      <section className="px-6 md:px-14 py-[90px]">
        <Reveal from="left" className="relative max-w-[1100px] mx-auto rounded-[24px] overflow-hidden px-10 py-16 text-center">
          <div className="absolute inset-0" style={{ background: 'radial-gradient(100% 120% at 50% 0%, #3a1a14 0%, #160a08 60%, #0a0606 100%)' }} />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(70% 80% at 80% 100%, rgba(104,20,11,0.35) 0%, rgba(104,20,11,0) 60%)' }} />
          <div className="relative">
            <h2 className="font-display font-extrabold text-white mb-8" style={{ fontSize: 'clamp(28px,4vw,46px)', letterSpacing: '-0.025em' }}>
              Pesca desde dentro. <br></br>Míralo desde el corazón.
            </h2>
            <Link
              href="/login?mode=register"
              className="inline-flex items-center gap-[9px] px-9 py-4 rounded-[11px] font-bold text-[16px] transition-transform hover:scale-[1.03]"
              style={{ background: '#fff', color: '#68140b', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}
            >
              Empezar ahora <i className="ti ti-arrow-right text-[19px]" />
            </Link>
          </div>
        </Reveal>
      </section>

      <PublicFooter />
    </div>
  );
}
