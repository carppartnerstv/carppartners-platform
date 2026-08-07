import React from 'react';
import type { Video } from '@carp-partners/api-client';
import { Button } from './Button';

export interface HeroBannerProps {
  video: Video;
  /** Nombre de la categoría del vídeo (p. ej. "Series") */
  categoryName?: string;
  /** Título de la serie a la que pertenece, si aplica */
  seriesTitle?: string;
  /** Nº total de episodios de la serie, si aplica */
  episodeCount?: number;
  /** Texto del badge superior */
  badgeLabel?: string;
  onPlay?: (video: Video) => void;
  onMoreInfo?: (video: Video) => void;
}

export function HeroBanner({
  video,
  categoryName,
  seriesTitle,
  episodeCount,
  badgeLabel = 'Nueva temporada',
  onPlay,
  onMoreInfo,
}: HeroBannerProps) {
  const year = new Date(video.created_at).getFullYear();
  const metaParts = [
    String(year),
    categoryName,
    seriesTitle,
    episodeCount ? `${episodeCount} episodio${episodeCount === 1 ? '' : 's'}` : undefined,
  ].filter(Boolean) as string[];

  return (
    <div className="relative w-full h-[58vh] min-h-[420px] max-h-[640px] md:h-[84vh] md:min-h-[520px] md:max-h-[860px]">
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
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(6,9,12,0.92) 0%, rgba(6,9,12,0.55) 38%, rgba(6,9,12,0) 70%)',
        }}
      />
      {/* Gradiente abajo — fusión con el fondo de la página */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(0deg, #06090c 2%, rgba(6,9,12,0.2) 30%, rgba(6,9,12,0) 55%)',
        }}
      />

      {/* Contenido */}
      <div className="absolute flex flex-col left-5 right-5 bottom-[6vh] max-w-[520px] md:left-12 md:right-6 md:bottom-[8vh] md:max-w-[560px]">
        {/* Badge temporada */}
        <div
          className="inline-flex items-center gap-[7px] self-start px-[11px] py-[5px] rounded-[6px] mb-[18px]
                     bg-gold-dim border border-gold/35 text-gold text-[11px] font-semibold
                     tracking-[0.08em] uppercase"
        >
          <i className="ti ti-sparkles text-[14px]" />
          {badgeLabel}
        </div>

        {/* Título principal */}
        <h1
          className="font-display font-extrabold text-white leading-[1.02] tracking-[-0.02em] mb-4
                     text-[32px] md:text-[46px] lg:text-[62px]"
          style={{ textShadow: '0 4px 30px rgba(0,0,0,0.5)' }}
        >
          {video.title}
        </h1>

        {/* Línea de metadatos */}
        <div className="flex items-center gap-[10px] flex-wrap mb-4 text-[13px]" style={{ color: '#c4d0cb' }}>
          {metaParts.map((part, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="w-[3px] h-[3px] rounded-full" style={{ background: '#5f6f69' }} />}
              <span className={i === 0 ? 'font-semibold' : undefined}>{part}</span>
            </React.Fragment>
          ))}
          <span className="px-[6px] py-[1px] rounded border border-white/28 text-[11px]">4K UHD</span>
        </div>

        {/* Sinopsis */}
        {video.description && (
          <p className="text-[15.5px] leading-[1.6] mb-[26px] line-clamp-3 max-w-[500px]" style={{ color: '#c4d0cb' }}>
            {video.description}
          </p>
        )}

        {/* CTAs — en móvil, una sola fila horizontal que ocupa el 100% del
            ancho disponible: "Ver ahora" (color corporativo) crece con
            flex-1, "Más info" se reduce a solo el icono. En desktop vuelve
            al tamaño "lg" normal del Button con !important (los px-8/py-3.5
            de sizes.lg no se pueden pisar de forma fiable solo por orden de
            clases; !px-.. sí gana siempre). */}
        <div className="flex items-center gap-[10px] md:gap-[14px]">
          <Button
            variant="primary"
            size="lg"
            onClick={() => onPlay?.(video)}
            className="flex-1 md:flex-none gap-[7px] md:gap-[9px] !px-5 !py-[13px] text-[14.5px] md:!px-8 md:!py-3.5 md:text-base"
          >
            <i className="ti ti-player-play-filled text-[17px] md:text-[19px]" />
            Ver ahora
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => onMoreInfo?.(video)}
            aria-label="Más info"
            className="shrink-0 w-[48px] md:w-auto !px-0 md:!px-8 !py-[13px] md:!py-3.5 gap-0 md:gap-[9px]"
          >
            <i className="ti ti-info-circle text-[19px]" />
            <span className="hidden md:inline">Más info</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
