import React from 'react';
import type { Video } from '@carp-partners/api-client';

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export interface VideoCardProps {
  video: Video;
  /** Progreso 0–100 para mostrar la barra de progreso */
  progress?: number;
  /** Número de ranking (Top 10) */
  rank?: number;
  /** Muestra badge "Nuevo" dorado */
  isNew?: boolean;
  /** Círculo de reproducción centrado — solo pensado para "Continuar viendo" */
  showPlayButton?: boolean;
  onClick?: (video: Video) => void;
}

export function VideoCard({ video, progress, rank, isNew, showPlayButton, onClick }: VideoCardProps) {
  return (
    <button
      onClick={() => onClick?.(video)}
      className="group relative w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      style={{ transition: 'transform .25s ease' }}
    >
      {/* Portada: vertical 2:3 en móvil (estilo Netflix), 16:9 desde sm */}
      <div
        className="relative aspect-[2/3] sm:aspect-video rounded-card overflow-hidden bg-surface-raised border border-cp-border shadow-card
                   transition-transform duration-[250ms] ease-out
                   group-hover:-translate-y-[5px]"
      >
        {video.thumbnail_url || video.cover_vertical_url ? (
          <picture>
            {/* Por debajo de 640px, si hay portada vertical subida, se usa
                esa — si no, el navegador cae solo a la horizontal de abajo. */}
            {video.cover_vertical_url && (
              <source media="(max-width: 639px)" srcSet={video.cover_vertical_url} />
            )}
            <img
              src={video.thumbnail_url ?? video.cover_vertical_url ?? ''}
              alt={video.title}
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
        {/* Filo superior sutil */}
        <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]" />

        {/* Badge Nuevo */}
        {isNew && (
          <span
            className="absolute top-[10px] left-[10px] flex items-center gap-[5px] px-2 py-1 rounded-badge
                       bg-gold-fill text-[10px] font-bold uppercase tracking-[0.06em]"
            style={{ color: '#1a1206' }}
          >
            Nuevo
          </span>
        )}

        {/* Rank overlay */}
        {rank != null && (
          <span
            className="absolute left-2 -bottom-3 font-display font-extrabold leading-none select-none"
            style={{
              fontSize: 96,
              lineHeight: 1,
              color: 'transparent',
              WebkitTextStroke: '2px rgba(255,255,255,0.5)',
              textShadow: '0 2px 12px rgba(0,0,0,0.4)',
            }}
          >
            {rank}
          </span>
        )}

        {/* Duración (top-right) — en móvil, solo en "Continuar viendo" (showPlayButton) */}
        {video.duration_sec > 0 && (
          <span
            className={`absolute top-[10px] right-[10px] px-[7px] py-[3px] rounded-[5px] text-[11px] ${showPlayButton ? '' : 'hidden sm:block'}`}
            style={{ background: 'rgba(4,8,10,0.72)', color: '#dfe7e3', backdropFilter: 'blur(4px)' }}
          >
            {formatDuration(video.duration_sec)}
          </span>
        )}

        {/* Círculo de reproducción — centrado, solo en "Continuar viendo" */}
        {showPlayButton && (
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.32)', backdropFilter: 'blur(6px)' }}
          >
            <PlayIcon className="w-5 h-5 text-white ml-0.5" />
          </div>
        )}

        {/* Barra de progreso */}
        {progress !== undefined && progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div
              className="h-full bg-brand-bright"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Info debajo de la card */}
      <div className="pt-2.5 px-0.5">
        {/* Fuente más pequeña en móvil: con la tarjeta tan estrecha (23vw,
            para caber ~3,5 por fila), a 13.5px una sola línea dejaba
            títulos largos reducidos a un par de caracteres. Sigue en 1
            línea (line-clamp-1), pero a 11px entran bastantes más
            caracteres antes del recorte. Desde sm, como antes (13.5px). */}
        <p className="text-[11px] sm:text-[13.5px] font-semibold leading-snug line-clamp-1" style={{ color: '#e9efeb' }}>
          {video.title}
        </p>
        {video.episode_num != null && (
          <p className="text-cp-gray text-[11.5px] mt-[3px] truncate">
            {/* series_title solo viene informado en /videos (no en los
                vídeos "sintéticos" de historial/watchlist) — con él se
                muestra temporada + episodio + serie, si no, el episodio
                suelto como antes. */}
            {video.series_title
              ? `${video.season_num != null ? `T${video.season_num} · ` : ''}E${video.episode_num} · ${video.series_title}`
              : `Ep. ${video.episode_num}`}
          </p>
        )}
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
