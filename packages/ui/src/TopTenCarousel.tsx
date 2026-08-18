'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Series, Category } from '@carp-partners/api-client';

export interface TopTenCarouselProps {
  title: string;
  items: Series[];
  categories: Category[];
  onItemClick?: (series: Series) => void;
}

const AUTOPLAY_MS = 6000;
const DRAG_THRESHOLD_PX = 60;
const CARD_GAP = 14;
const DESCRIPTION_MAX_CHARS = 150;
// Deben coincidir con las clases w-[...]/h-[...] de más abajo: la
// protagonista es 16:9 (mismo formato que el resto de filas); las demás son
// verticales 2:3, tipo póster, para dar a esta fila un formato distinto.
const BIG_WIDTH = { base: 260, sm: 380, md: 500, lg: 620 };
const CONTAINER_HEIGHT = { base: 152, sm: 220, md: 288, lg: 356 };
const POSTER_WIDTH = { base: 101, sm: 147, md: 192, lg: 237 }; // = CONTAINER_HEIGHT * 2/3

function bpFromWidth(w: number): keyof typeof BIG_WIDTH {
  if (w >= 1024) return 'lg';
  if (w >= 768) return 'md';
  if (w >= 640) return 'sm';
  return 'base';
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

interface Slot { offset: number; x: number; }

// Carrusel con la card protagonista SIEMPRE anclada a la izquierda (no al
// centro) y la información (título, insignia, metadatos, breve descripción)
// dentro de la propia card. Una única fuente de verdad (activeIndex) decide
// qué card es la protagonista; el desplazamiento entre cards es solo
// transform (translateX + scale, nunca anchura real), así que no depende de
// medir el DOM a media transición.
//
// El número de cards que asoman a la derecha NO es un máximo fijo: se
// calcula cada vez a partir del ancho real del contenedor (ResizeObserver),
// generando tantas como quepan (más una que queda parcialmente cortada por
// el overflow-hidden, para el efecto de "asoma") — así aprovecha toda la
// pantalla en vez de dejar hueco vacío en monitores anchos.
export function TopTenCarousel({ title, items, categories, onItemClick }: TopTenCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [tick, setTick] = useState(0);
  const [dragPx, setDragPx] = useState(0);
  const [vw, setVw] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const dragState = useRef<{ startX: number; dragging: boolean } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const n = items.length;
  const safeFocus = n > 0 ? ((activeIndex % n) + n) % n : 0;

  useEffect(() => {
    const update = () => setVw(window.innerWidth);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setContainerWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (paused || n <= 1) return;
    const id = setInterval(() => setActiveIndex((i) => i + 1), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [paused, n, tick]);

  if (!n) return null;

  const goNext = () => { setActiveIndex((i) => i + 1); setTick((t) => t + 1); };
  const goPrev = () => { setActiveIndex((i) => i - 1); setTick((t) => t + 1); };
  const goTo = (offset: number) => { setActiveIndex((i) => i + offset); setTick((t) => t + 1); };

  const handlePointerDown = (e: React.PointerEvent) => {
    dragState.current = { startX: e.clientX, dragging: true };
    setPaused(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState.current?.dragging) return;
    setDragPx(e.clientX - dragState.current.startX);
  };
  const endDrag = () => {
    if (!dragState.current?.dragging) return;
    if (dragPx > DRAG_THRESHOLD_PX) goPrev();
    else if (dragPx < -DRAG_THRESHOLD_PX) goNext();
    dragState.current = null;
    setDragPx(0);
    setPaused(false);
  };

  const bp = bpFromWidth(vw);
  const bigWidth = BIG_WIDTH[bp];
  const posterWidth = POSTER_WIDTH[bp];

  // Tabla hacia la derecha: se generan cards hasta cubrir el ancho real del
  // contenedor (+ una de propina que el overflow-hidden corta a medias).
  const rightSlots: Slot[] = [];
  {
    let x = bigWidth;
    const limit = Math.max(0, containerWidth || bigWidth * 3);
    for (let dist = 1; dist <= n - 1 && dist <= 16; dist++) {
      x += CARD_GAP;
      rightSlots.push({ offset: dist, x });
      x += posterWidth;
      if (x > limit + posterWidth) break;
    }
  }

  // Tabla hacia la izquierda: solo un par, exclusivamente para que la
  // animación de retroceso tenga de dónde entrar — en reposo quedan fuera
  // de pantalla (x negativa).
  const leftSlots: Slot[] = [];
  {
    let x = 0;
    const maxLeft = Math.min(2, Math.max(0, n - 1 - rightSlots.length));
    for (let dist = 1; dist <= maxLeft; dist++) {
      x -= CARD_GAP + posterWidth;
      leftSlots.push({ offset: -dist, x });
    }
  }

  const slots: Slot[] = [...leftSlots, { offset: 0, x: 0 }, ...rightSlots];
  const dragging = !!dragState.current?.dragging;

  return (
    <section className="mb-9">
      <div className="flex items-center justify-between mb-3 px-0">
        <h2 className="font-display text-[19px] sm:text-[22px] font-bold text-white tracking-[-0.01em]">
          {title}
        </h2>
      </div>

      <div
        className="relative group/carousel select-none"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => { setPaused(false); endDrag(); }}
      >
        <div
          ref={wrapRef}
          className="relative overflow-hidden h-[152px] sm:h-[220px] md:h-[288px] lg:h-[356px] touch-pan-y"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {slots.map(({ offset, x }) => {
            const idx = (((safeFocus + offset) % n) + n) % n;
            const s = items[idx];
            const featured = offset === 0;
            const category = categories.find((c) => c.id === s.category_id);
            const metaline = s.season_count > 0
              ? `${s.season_count} temporada${s.season_count === 1 ? '' : 's'}`
              : `${s.episode_count} episodio${s.episode_count === 1 ? '' : 's'}`;
            const description = s.description
              ? truncate(stripHtml(s.description), DESCRIPTION_MAX_CHARS)
              : null;

            return (
              <CarouselCard
                // La clave incluye el "rol" (protagonista 16:9 vs póster 2:3):
                // cuando una card cambia de rol, React la desmonta y monta una
                // nueva en vez de mutar el tamaño/aspecto del mismo nodo a
                // media animación de posición (eso era lo que se veía raro:
                // una card "volando" mientras cambiaba de forma de golpe). Las
                // que mantienen su rol conservan la key y siguen deslizándose
                // con normalidad. CarouselCard además entra con un fundido:
                // así, si una card recién aparecida coincide un instante en
                // el mismo sitio del que sale deslizándose otra (pasa al
                // retroceder), no se tapan de golpe — la nueva se ve llegar
                // suavemente mientras la otra ya se está apartando.
                key={`${s.id}:${featured ? 'big' : 'poster'}`}
                onClick={() => (featured ? onItemClick?.(s) : goTo(offset))}
                featured={featured}
                x={x + dragPx}
                dragging={dragging}
              >
                {s.cover_url ? (
                  <img src={s.cover_url} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                ) : (
                  <div className="absolute inset-0 bg-surface-raised" />
                )}

                {/* En las no protagonistas, degradado y título solo aparecen
                    al pasar el ratón por encima — por defecto se ve solo la
                    portada, limpia */}
                <div
                  className={`absolute inset-0 transition-opacity duration-200 ${
                    featured ? '' : 'opacity-0 group-hover/card:opacity-100'
                  }`}
                  style={{ background: 'linear-gradient(0deg, rgba(4,8,10,0.94) 0%, rgba(4,8,10,0.3) 55%, rgba(4,8,10,0) 100%)' }}
                />

                <div
                  className={`absolute left-3 right-3 bottom-2.5 sm:left-5 sm:right-5 sm:bottom-[14px] transition-opacity duration-200 ${
                    featured ? '' : 'opacity-0 group-hover/card:opacity-100'
                  }`}
                >
                  <div
                    className={`font-display font-bold text-white mb-1 sm:mb-1.5 line-clamp-2 ${
                      featured ? 'text-[15px] sm:text-[20px] lg:text-[26px]' : 'text-[10.5px] sm:text-[13px] md:text-[14.5px] lg:text-[16px]'
                    }`}
                  >
                    {s.title}
                  </div>
                  {featured && (
                    <>
                      <div className="hidden sm:flex items-center gap-2 flex-wrap text-[12px] mb-1.5" style={{ color: '#c4d0cb' }}>
                        <span
                          className="px-2 py-[3px] rounded-[5px] font-semibold text-[11px]"
                          style={{ background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.25)', color: '#eef3f0' }}
                        >
                          TOP 10
                        </span>
                        <span>{metaline}</span>
                        {category && <span className="w-[3px] h-[3px] rounded-full" style={{ background: '#5f6f69' }} />}
                        {category && <span>{category.name}</span>}
                      </div>
                      {description && (
                        <div className="hidden md:block text-[12.5px] leading-[1.5]" style={{ color: '#b7c2bd' }}>
                          {description}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CarouselCard>
            );
          })}
        </div>

        <ChevronButton dir="left" onClick={goPrev} />
        <ChevronButton dir="right" onClick={goNext} />
      </div>
    </section>
  );
}

interface CarouselCardProps {
  featured: boolean;
  x: number;
  dragging: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

// Componente aparte (no inline en el .map) para que cada card tenga su
// propio estado de "montado": las que son elementos nuevos (cambio de rol)
// arrancan invisibles y se funden a la vista en el siguiente frame; las que
// simplemente se desplazan (mismo key, no se desmontan) conservan
// mounted=true de antes y no vuelven a fundirse en cada re-render.
function CarouselCard({ featured, x, dragging, onClick, children }: CarouselCardProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <button
      onClick={onClick}
      className={`group/card absolute top-1/2 left-0 rounded-[12px] overflow-hidden text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
        featured
          ? 'w-[260px] sm:w-[380px] md:w-[500px] lg:w-[620px] aspect-video'
          : 'w-[101px] sm:w-[147px] md:w-[192px] lg:w-[237px] aspect-[2/3]'
      }`}
      style={{
        // Los pósters ya no se solapan entre sí en reposo (van en fila, cada
        // uno con su hueco), así que no hace falta que el z-index dependa de
        // la distancia al centro.
        zIndex: featured ? 10 : 5,
        opacity: mounted ? 1 : 0,
        transform: `translateY(-50%) translateX(${x}px)`,
        transition: dragging ? 'none' : 'transform 500ms ease, opacity 300ms ease',
        border: featured ? '2px solid rgba(255,255,255,0.55)' : '1px solid rgba(255,255,255,0.08)',
        boxShadow: featured ? '0 16px 40px rgba(0,0,0,0.55)' : '0 8px 22px rgba(0,0,0,0.4)',
        background: '#0e151a',
      }}
    >
      {children}
    </button>
  );
}

function ChevronButton({ dir, onClick }: { dir: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={dir === 'left' ? 'Anterior' : 'Siguiente'}
      className={[
        'absolute top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full',
        dir === 'left' ? 'left-1 sm:left-4' : 'right-1 sm:right-4',
        'hidden md:flex items-center justify-center',
        'bg-white/10 border border-white/20 backdrop-blur-sm',
        'opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-200',
      ].join(' ')}
    >
      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {dir === 'left' ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        )}
      </svg>
    </button>
  );
}
