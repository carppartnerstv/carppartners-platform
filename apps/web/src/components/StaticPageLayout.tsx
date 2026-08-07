import React from 'react';
import { PublicHeader } from './PublicHeader';
import { PublicFooter } from './PublicFooter';
import { Carousel } from './Carousel';

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

// Shortcode [carrousel:slug] — se escribe como texto plano dentro del editor
// enriquecido (Tiptap no lo interpreta, es solo texto) y aquí se sustituye
// por el carrousel real gestionado desde /admin/carrousels.
const CAROUSEL_SHORTCODE_RE = /\[carrousel:([a-z0-9-]+)\]/g;

const PROSE_STYLE: React.CSSProperties = { fontSize: 16, lineHeight: 1.8, color: '#c4d0cb' };

// Renderiza el HTML enriquecido (sanitizado en el backend al guardar) con el
// mismo wrapper .rich-editor/.ProseMirror que ya se usa en la bio de la crew
// y en la descripción de series/películas, sustituyendo cualquier shortcode
// [carrousel:slug] por el componente real.
export function StaticPageContent({ html }: { html: string | null }) {
  if (!html) return null;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  CAROUSEL_SHORTCODE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CAROUSEL_SHORTCODE_RE.exec(html))) {
    if (match.index > lastIndex) {
      parts.push(
        <div key={`h-${key++}`} className="ProseMirror" style={PROSE_STYLE}
          dangerouslySetInnerHTML={{ __html: html.slice(lastIndex, match.index) }} />,
      );
    }
    parts.push(<Carousel key={`c-${key++}`} slug={match[1]} />);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < html.length) {
    parts.push(
      <div key={`h-${key++}`} className="ProseMirror" style={PROSE_STYLE}
        dangerouslySetInnerHTML={{ __html: html.slice(lastIndex) }} />,
    );
  }

  return <div className="rich-editor">{parts}</div>;
}
