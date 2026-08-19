import React from 'react';
import type { Series } from '@carp-partners/api-client';

export interface SeriesCardProps {
  series: Series;
  onClick?: (series: Series) => void;
}

export function SeriesCard({ series, onClick }: SeriesCardProps) {
  const metaline = series.season_count > 0
    ? `${series.season_count} temporada${series.season_count === 1 ? '' : 's'}`
    : `${series.episode_count} episodio${series.episode_count === 1 ? '' : 's'}`;

  return (
    <button
      onClick={() => onClick?.(series)}
      className="group relative w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      style={{ transition: 'transform .25s ease' }}
    >
      {/* Portada: vertical 2:3 en móvil (estilo Netflix), 16:9 desde sm */}
      <div
        className="relative aspect-[2/3] sm:aspect-video rounded-card overflow-hidden bg-surface-raised border border-cp-border shadow-card
                   transition-transform duration-[250ms] ease-out
                   group-hover:-translate-y-[5px]"
      >
        {series.cover_url || series.cover_vertical_url ? (
          <picture>
            {series.cover_vertical_url && (
              <source media="(max-width: 639px)" srcSet={series.cover_vertical_url} />
            )}
            <img
              src={series.cover_url ?? series.cover_vertical_url ?? ''}
              alt={series.title}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </picture>
        ) : (
          <div className="w-full h-full bg-surface-2 flex items-center justify-center">
            <PlayIcon className="w-10 h-10 text-white/20" />
          </div>
        )}

        {/* Gradient scrim — bottom */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 38%, rgba(4,8,10,0.82) 100%)' }}
        />
        <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]" />
      </div>

      {/* Info debajo de la portada */}
      <div className="pt-2.5 px-0.5">
        {/* Fuente más pequeña en móvil (tarjeta muy estrecha, 23vw): sigue
            en 1 línea, pero a 11px entran más caracteres antes del recorte. */}
        <p className="text-[11px] sm:text-[13.5px] font-semibold leading-snug line-clamp-1" style={{ color: '#e9efeb' }}>
          {series.title}
        </p>
        <p className="text-cp-gray text-[11.5px] mt-[3px]">{metaline}</p>
      </div>
    </button>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
