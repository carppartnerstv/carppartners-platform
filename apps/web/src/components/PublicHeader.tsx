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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!transparentOnTop) return;
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [transparentOnTop]);

  // El menú móvil se cierra solo al navegar (los <Link> desmontan la página);
  // para los enlaces de scroll-en-la-misma-página (solo landing) hay que
  // cerrarlo explícitamente después de invocar el handler.
  const closeAnd = (fn?: () => void) => () => { fn?.(); setMenuOpen(false); };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled || menuOpen ? 'rgba(6,9,12,0.82)' : 'rgba(6,9,12,0)',
        backdropFilter: scrolled || menuOpen ? 'blur(10px)' : 'none',
        borderBottom: scrolled || menuOpen ? '1px solid rgba(255,255,255,0.07)' : '1px solid transparent',
      }}
    >
      <div className="flex items-center px-4 sm:px-6 md:px-14 py-[16px] md:py-[18px]">
        <Link href="/" onClick={() => setMenuOpen(false)}>
          <Image
            src="/carp-partners-logo blanc.png"
            alt="Carp Partners TV"
            width={140} height={24}
            className="h-[22px] md:h-[26px] w-auto"
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
          <Link
            href="/contacto"
            className="text-[13.5px] font-medium text-white/60 hover:text-white transition-colors"
          >
            Contacto
          </Link>
        </nav>
        {/* En móvil solo el botón de iniciar sesión — "Suscríbete" solo aparece
            desde md (en el diseño móvil de referencia el CTA visible del
            header es distinto y el resto de accesos viven en el menú). */}
        {/* En móvil es el único botón visible, así que lleva el color
            corporativo para destacar como el CTA principal; desde md vuelve
            al estilo con borde (ahí ya va acompañado de "Suscríbete"). */}
        <Link
          href="/login"
          className="mr-1.5 sm:mr-2.5 px-2.5 sm:px-[18px] py-[9px] rounded-lg text-white text-[12.5px] sm:text-[13.5px] font-semibold transition-colors whitespace-nowrap bg-[#68140b] hover:brightness-110 md:bg-transparent md:border md:border-white/20 md:hover:bg-white/8 md:hover:brightness-100"
        >
          Iniciar sesión
        </Link>
        <Link href="/login?mode=register" className="hidden md:inline-flex px-3 sm:px-5 py-[9px] rounded-lg text-white text-[12.5px] sm:text-[13.5px] font-bold transition-transform hover:scale-[1.04] whitespace-nowrap" style={{ background: '#68140b', boxShadow: '0 4px 16px rgba(104,20,11,0.45)' }}>
          Suscríbete
        </Link>
        <button
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuOpen}
          className="md:hidden ml-2 sm:ml-3 w-9 h-9 flex items-center justify-center shrink-0 text-white"
        >
          <i className={`ti ${menuOpen ? 'ti-x' : 'ti-menu-2'} text-[22px]`} />
        </button>
      </div>

      {/* Menú móvil: enlaces de sección, ocultos del todo en desktop (ya están en el <nav> de arriba) */}
      {menuOpen && (
        <nav
          className="md:hidden flex flex-col px-4 sm:px-6 pb-4 pt-1"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
        >
          {NAV_ITEMS.map(item => {
            const handler = onNavClick?.[item.key];
            return handler ? (
              <button
                key={item.key} onClick={closeAnd(handler)}
                className="text-left py-3 text-[15px] font-medium text-white/75 hover:text-white transition-colors"
              >
                {item.label}
              </button>
            ) : (
              <Link
                key={item.key} href={`/${item.hash}`} onClick={() => setMenuOpen(false)}
                className="py-3 text-[15px] font-medium text-white/75 hover:text-white transition-colors"
              >
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/contacto" onClick={() => setMenuOpen(false)}
            className="py-3 text-[15px] font-medium text-white/75 hover:text-white transition-colors"
          >
            Contacto
          </Link>
        </nav>
      )}
    </header>
  );
}
