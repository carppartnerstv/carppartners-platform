import React from 'react';
import type { Video } from '@carp-partners/api-client';
import { Button } from './Button';

export interface HeroBannerProps {
  video: Video;
  onPlay?: (video: Video) => void;
  onAddToList?: (video: Video) => void;
}

export function HeroBanner({ video, onPlay, onAddToList }: HeroBannerProps) {
  return (
    <div className="relative w-full" style={{ height: '84vh', minHeight: 520, maxHeight: 860 }}>
      {/* Imagen de fondo */}
      {video.thumbnail_url ? (
        <img
          src={video.thumbnail_url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          aria-hidden
        />
      ) : (
        <div className="absolute inset-0 bg-surface-raised" />
      )}

      {/* Gradiente izquierda — mantiene legibilidad del texto */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />
      {/* Gradiente abajo — fusión con el home */}
      <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-transparent" />

      {/* Contenido */}
      <div className="absolute inset-0 flex flex-col justify-end pb-16 px-6 md:px-12 max-w-[560px]">
        {/* Badge temporada/nuevo */}
        {video.episode_num === 1 && (
          <div className="flex items-center gap-1.5 mb-4">
            <span className="text-[11px] font-semibold tracking-[0.08em] uppercase"
                  style={{ color: '#e3bd72' }}>
              ✦ Nueva temporada
            </span>
          </div>
        )}

        {/* Kicker de serie */}
        {video.episode_num != null && (
          <span className="text-brand-bright text-[12.5px] font-semibold uppercase tracking-[0.1em] mb-2">
            Episodio {video.episode_num}
          </span>
        )}

        {/* Título principal */}
        <h1 className="font-display font-extrabold text-white leading-[1.02] tracking-[-0.02em] mb-4
                       text-[36px] md:text-[52px] lg:text-[62px]
                       drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]">
          {video.title}
        </h1>

        {/* Sinopsis */}
        {video.description && (
          <p className="text-white/75 text-[15px] leading-[1.65] mb-7 line-clamp-3 max-w-[480px]">
            {video.description}
          </p>
        )}

        {/* CTAs */}
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="lg"
            onClick={() => onPlay?.(video)}
            className="gap-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Ver ahora
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => onAddToList?.(video)}
            className="gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Más info
          </Button>
        </div>
      </div>
    </div>
  );
}
