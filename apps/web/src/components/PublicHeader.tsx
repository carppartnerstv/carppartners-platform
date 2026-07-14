'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const NAV_ITEMS = [
  { key: 'catalogo', label: 'Catálogo', hash: '#catalogo' },
  { key: 'planes', label: 'Planes', hash: '#planes' },
  { key: 'preguntas', label: 'Preguntas', hash: '#preguntas' },
] as const;

type NavKey = (typeof NAV_ITEMS)[number]['key'];

export interface PublicHeaderProps {
  /** True solo en la landing: empieza transparente sobre el hero y se solidifica al hacer scroll. En el resto de páginas siempre sólido (por defecto). */
  transparentOnTop?: boolean;
  /** Handlers de scroll suave a las secciones de la propia landing. Si se omiten (resto de páginas), los enlaces navegan a /#sección. */
  onNavClick?: Partial<Record<NavKey, () => void>>;
}

// Cabecera pública compartida por la landing y las páginas fijas (Sobre
// nosotros, legales, Contacto...) — mismo logo, navegación y botones de
// acceso en toda la web no autenticada.
export function PublicHeader({ transparentOnTop = false, onNavClick }: PublicHeaderProps) {
  const [scrolled, setScrolled] = useState(!transparentOnTop);

  useEffect(() => {
    if (!transparentOnTop) return;
    const onScroll = () => setScrolled(window.scrollY > 30);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [transparentOnTop]);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center px-6 md:px-14 py-[18px] transition-all duration-300"
      style={{
        background: scrolled ? 'rgba(6,9,12,0.92)' : 'rgba(6,9,12,0)',
        backdropFilter: scrolled ? 'blur(10px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.07)' : '1px solid transparent',
      }}
    >
      <Link href="/">
        <Image
          src="/carp-partners-logo blanc.png"
          alt="Carp Partners TV"
          width={140} height={24}
          className="h-[26px] w-auto"
        />
      </Link>
      <div className="flex-1" />
      <nav className="hidden md:flex items-center gap-8 mr-8">
        {NAV_ITEMS.map(item => {
          const handler = onNavClick?.[item.key];
          return handler ? (
            <button
              key={item.key} onClick={handler}
              className="text-[13.5px] font-medium text-white/60 hover:text-white transition-colors cursor-pointer"
            >
              {item.label}
            </button>
          ) : (
            <Link
              key={item.key} href={`/${item.hash}`}
              className="text-[13.5px] font-medium text-white/60 hover:text-white transition-colors"
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <Link href="/login" className="mr-2.5 px-[18px] py-[9px] rounded-lg border border-white/20 text-white text-[13.5px] font-semibold hover:bg-white/8 transition-colors">
        Iniciar sesión
      </Link>
      <Link href="/login?mode=register" className="px-5 py-[9px] rounded-lg text-white text-[13.5px] font-bold transition-transform hover:scale-[1.04]" style={{ background: '#68140b', boxShadow: '0 4px 16px rgba(104,20,11,0.45)' }}>
        Suscríbete
      </Link>
    </header>
  );
}
