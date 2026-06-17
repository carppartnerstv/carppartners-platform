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
  onClick?: (video: Video) => void;
}

export function VideoCard({ video, progress, rank, isNew, onClick }: VideoCardProps) {
  return (
    <button
      onClick={() => onClick?.(video)}
      className="group relative flex-shrink-0 w-[300px] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      {/* Thumbnail 16:9 */}
      <div
        className="relative aspect-video rounded-card overflow-hidden bg-surface-raised shadow-card
                   transition-transform duration-[250ms] ease-out
                   group-hover:-translate-y-[5px] group-hover:shadow-[0_14px_36px_rgba(0,0,0,0.6)]"
      >
        {video.thumbnail_url ? (
          <img
            src={video.thumbnail_url}
            alt={video.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="w-full h-full bg-surface-2 flex items-center justify-center">
            <PlayIcon className="w-10 h-10 text-white/20" />
          </div>
        )}

        {/* Gradient scrim — bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        {/* Badge Nuevo */}
        {isNew && (
          <span className="absolute top-2 left-2 bg-gold-fill text-black text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-badge">
            Nuevo
          </span>
        )}

        {/* Duración (top-right) */}
        {video.duration_sec > 0 && (
          <span className="absolute top-2 right-2 bg-black/65 text-white text-[11px] px-1.5 py-0.5 rounded">
            {formatDuration(video.duration_sec)}
          </span>
        )}

        {/* Rank overlay */}
        {rank != null && (
          <span
            className="absolute bottom-0 left-1 font-display font-extrabold leading-none select-none"
            style={{ fontSize: 88, color: 'rgba(255,255,255,0.13)', lineHeight: 1 }}
          >
            {rank}
          </span>
        )}

        {/* Play circle — aparece en hover */}
        <div className="absolute bottom-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <PlayIcon className="w-4 h-4 text-black ml-0.5" />
          </div>
        </div>

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
      <div className="mt-2.5 px-0.5 space-y-0.5">
        <p className="text-white text-[13.5px] font-semibold leading-snug line-clamp-1 group-hover:text-brand-bright transition-colors duration-150">
          {video.title}
        </p>
        {video.episode_num != null && (
          <p className="text-cp-gray text-[11.5px]">Ep. {video.episode_num}</p>
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
