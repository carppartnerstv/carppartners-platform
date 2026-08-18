'use client';

import React, { useRef } from 'react';
import type { Video } from '@carp-partners/api-client';
import { VideoCard } from './VideoCard';

// 45 días en vez de los 7 "de manual" — el catálogo se sube por lotes con
// semanas de diferencia, así que una ventana de 7 días dejaba el badge
// "Nuevo" prácticamente siempre vacío salvo el mismo día de la subida.
const NEW_BADGE_MAX_AGE_MS = 45 * 24 * 60 * 60 * 1000;

export interface VideoRowProps {
  title: string;
  videos: Video[];
  progressMap?: Record<string, number>;
  onVideoClick?: (video: Video) => void;
  showSeeAll?: boolean;
  onSeeAll?: () => void;
  /** Marca con el badge "Nuevo" los vídeos publicados en los últimos 45 días — pensado para "Añadido recientemente" en Home. */
  showNewBadge?: boolean;
  /** Numera las tarjetas 1, 2, 3… (prop `rank` ya soportada por VideoCard) — pensado para "Tendencias en Carp Partners". Usa más separación entre tarjetas para que el numeral grande tenga sitio. */
  showRank?: boolean;
  /** Círculo de reproducción centrado en cada card — solo "Continuar viendo" lo usa. */
  showPlayButton?: boolean;
}

export function VideoRow({ title, videos, progressMap, onVideoClick, showSeeAll, onSeeAll, showNewBadge, showRank, showPlayButton }: VideoRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'right' ? 640 : -640, behavior: 'smooth' });
  };

  if (!videos.length) return null;

  return (
    <section className="mb-9">
      {/* Row header */}
      <div className="flex items-center justify-between mb-3 px-0">
        <h2 className="font-display text-[19px] font-semibold text-white tracking-[-0.01em]">
          {title}
        </h2>
        {(showSeeAll || onSeeAll) && (
          <button
            onClick={onSeeAll}
            className="text-brand-bright text-sm font-medium hover:text-white transition-colors flex items-center gap-1"
          >
            Ver todos
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>

      {/* Scroll rail */}
      <div className="relative group/row">
        {/* Fade izquierda */}
        <ChevronButton dir="left" onClick={() => scroll('left')} />

        <div
          ref={scrollRef}
          className={`flex overflow-x-auto scrollbar-hide scroll-smooth pb-0 sm:pb-1 ${showRank ? 'gap-6 sm:gap-8 pt-3' : 'gap-3 sm:gap-4'}`}
        >
          {videos.map((v, i) => (
            // Ancho en móvil pensado para que se vean 3 tarjetas enteras y
            // un trozo de la 4ª (pista de que es deslizable) — de sm en
            // adelante, anchos fijos como antes.
            <div key={v.id} className="flex-shrink-0 w-[23vw] sm:w-[190px] md:w-[230px] lg:w-[300px]">
              <VideoCard
                video={v}
                progress={progressMap?.[v.id]}
                onClick={onVideoClick}
                isNew={showNewBadge && Date.now() - new Date(v.created_at).getTime() <= NEW_BADGE_MAX_AGE_MS}
                rank={showRank ? i + 1 : undefined}
                showPlayButton={showPlayButton}
              />
            </div>
          ))}
          <div className="flex-shrink-0 w-2" />
        </div>

        {/* Fade derecha */}
        <ChevronButton dir="right" onClick={() => scroll('right')} />
      </div>
    </section>
  );
}

function ChevronButton({ dir, onClick }: { dir: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={dir === 'left' ? 'Anterior' : 'Siguiente'}
      className={[
        'absolute top-0 bottom-6 z-10 w-14',
        dir === 'left' ? 'left-0 bg-gradient-to-r' : 'right-0 bg-gradient-to-l',
        'from-surface to-transparent',
        'hidden md:flex items-center justify-center',
        'opacity-0 group-hover/row:opacity-100 transition-opacity duration-200',
      ].join(' ')}
    >
      <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center backdrop-blur-sm">
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {dir === 'left' ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          )}
        </svg>
      </div>
    </button>
  );
}
