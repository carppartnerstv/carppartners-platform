import React from 'react';
import { PublicHeader } from './PublicHeader';
import { PublicFooter } from './PublicFooter';

// Cabecera + pie compartidos con la landing (mismo PublicHeader/PublicFooter)
// y contenedor de lectura para las páginas fijas públicas (Sobre nosotros,
// legales, Contacto...). Coherente con la estética oscura de la web pública.
export function StaticPageLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#06090c' }}>
      <PublicHeader />

      {/* pt-[110px] deja hueco al header, que va fixed */}
      <main className="flex-1 max-w-[760px] mx-auto w-full px-6 md:px-0 pt-[110px] pb-[56px]">
        <h1
          className="font-display font-bold text-white mb-8"
          style={{ fontSize: 36, letterSpacing: '-0.02em' }}
        >
          {title}
        </h1>
        {children}
      </main>

      <PublicFooter />
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
