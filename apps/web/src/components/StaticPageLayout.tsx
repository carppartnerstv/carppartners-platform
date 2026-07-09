import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

// Cabecera + contenedor de lectura compartidos por las páginas fijas
// públicas (Sobre nosotros, legales, Contacto...). Coherente con la estética
// oscura de la landing: mismo fondo, logo y tipografía.
export function StaticPageLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: '#06090c' }}>
      <header className="px-6 md:px-14 py-6 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <Link href="/">
          <Image src="/carp-partners-logo blanc.png" alt="Carp Partners TV" width={110} height={19} className="h-6 w-auto" />
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-[7px] text-[13px] transition-colors hover:text-white"
          style={{ color: '#9aa9a3' }}
        >
          <i className="ti ti-arrow-left text-[17px]" />
          Volver al inicio
        </Link>
      </header>

      <main className="max-w-[760px] mx-auto px-6 md:px-0 py-[56px]">
        <h1
          className="font-display font-bold text-white mb-8"
          style={{ fontSize: 36, letterSpacing: '-0.02em' }}
        >
          {title}
        </h1>
        {children}
      </main>
    </div>
  );
}

// Renderiza el HTML enriquecido (sanitizado en el backend al guardar) con el
// mismo wrapper .rich-editor/.ProseMirror que ya se usa en la bio de la crew
// y en la descripción de series/películas.
export function StaticPageContent({ html }: { html: string | null }) {
  if (!html) return null;
  return (
    <div className="rich-editor">
      <div
        className="ProseMirror"
        style={{ fontSize: 16, lineHeight: 1.8, color: '#c4d0cb' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
