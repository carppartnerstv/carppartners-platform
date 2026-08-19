'use client';

import React from 'react';
import Link from 'next/link';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';
import { usePublicCarousel } from '@/components/Carousel';
import { CarouselStrip } from '@/components/CarouselStrip';

// Ambos se gestionan desde /admin/carrousels, creando un carrousel con este
// slug exacto y subiendo sus imágenes ahí — nada hardcodeado en el código.
const HERO_SLUG = 'sobre-hero';
const GALLERY_SLUG = 'sobre-galeria';

// Página "Sobre nosotros" con diseño propio (no el genérico de
// StaticPageLayout/editor de texto enriquecido del panel admin — solo el
// título SEO/meta se sigue editando desde /admin/paginas, el contenido
// visual vive aquí en código).
export function AboutView() {
  const { images: heroImages } = usePublicCarousel(HERO_SLUG);
  const heroImage = heroImages[0];

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: '#06090c', fontFamily: 'Inter, sans-serif', color: '#e9efeb' }}>
      <PublicHeader />

      {/* ═══════════════ HERO — una sola imagen fija, sin carrousel/crossfade ═══════════════ */}
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
          Pasión por el carpfishing y la pesca deportiva
        </h1>
      </section>

      {/* ═══════════════ HISTORIA ═══════════════ */}
      <section className="px-6 md:px-14 py-[70px]">
        <div className="max-w-[1100px] mx-auto">
          <h2
            className="font-display font-bold text-white mb-10 text-center"
            style={{ fontSize: 'clamp(26px,4vw,40px)', letterSpacing: '-0.02em' }}
          >
            De la tradición familiar a la comunidad de carpfishing
          </h2>
          <div className="columns-1 md:columns-2 gap-10" style={{ fontSize: 15, lineHeight: 1.8, color: '#c4d0cb' }}>
            <p className="mb-5 break-inside-avoid-column">
              En CarpPartners nacimos con una idea muy clara: vivir el carpfishing desde dentro y contarlo con
              verdad. No como una moda, no como un escaparate, sino como lo que es para nosotros: una forma de
              entender el tiempo, la naturaleza y a las personas.
            </p>
            <p className="mb-5 break-inside-avoid-column">
              Detrás del proyecto está Oriol Vilamú, creador de contenido y documentalista, fundador de
              CarpPartners, la primera plataforma de vídeos de carpfishing en España. Criado en una tradición
              familiar ligada a la pesca, Oriol ha recorrido embalses, lagos y países documentando sesiones en
              solitario y creando formatos propios como Solo Carp o La Picada, siempre con una narrativa cuidada y
              cercana, pensada para conectar con quienes sienten la pesca como algo más que un hobby.
            </p>
            <p className="break-inside-avoid-column">
              A su lado está Carles Sallent, productor audiovisual y músico, fundador de Loop Estudio y responsable
              de toda la parte sonora de La Picada. Su trabajo en la creación musical, el diseño de ambientes, la
              corrección de voces y la edición ha sido clave para elevar la calidad de cada producción. Hoy,
              además, Carles es cámara, editor y mano derecha de Oriol en el día a día de CarpPartners, formando un
              equipo compacto y totalmente implicado en el proyecto.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════ GALERÍA — a sangre completa, fotos verticales 2:3 ═══════════════ */}
      <CarouselStrip slug={GALLERY_SLUG} />

      {/* ═══════════════ CTA FINAL — mismo estilo que la landing ═══════════════ */}
      <section className="px-6 md:px-14 py-[90px]">
        <div className="relative max-w-[1100px] mx-auto rounded-[24px] overflow-hidden px-10 py-16 text-center">
          <div className="absolute inset-0" style={{ background: 'radial-gradient(100% 120% at 50% 0%, #3a1a14 0%, #160a08 60%, #0a0606 100%)' }} />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(70% 80% at 80% 100%, rgba(104,20,11,0.35) 0%, rgba(104,20,11,0) 60%)' }} />
          <div className="relative">
            <h2 className="font-display font-extrabold text-white mb-8" style={{ fontSize: 'clamp(28px,4vw,46px)', letterSpacing: '-0.025em' }}>
              Pesca desde dentro. Míralo desde el corazón.
            </h2>
            <Link
              href="/login?mode=register"
              className="inline-flex items-center gap-[9px] px-9 py-4 rounded-[11px] font-bold text-[16px] transition-transform hover:scale-[1.03]"
              style={{ background: '#fff', color: '#68140b', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}
            >
              Empezar ahora <i className="ti ti-arrow-right text-[19px]" />
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
