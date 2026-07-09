'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@carp-partners/api-client';
import type { Video, RelatedVideo, Category, Series } from '@carp-partners/api-client';
import { VideoCard, RatingDialog, RATING_META, RATING_LABELS, CastRow } from '@carp-partners/ui';
import type { RatingValue } from '@carp-partners/ui';
import { ToastProvider, useToast } from '@/context/ToastContext';

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
}

const RATING_TO_VALUE: Record<number, RatingValue> = { [-1]: 'down', 1: 'like', 2: 'love' };
const VALUE_TO_RATING: Record<RatingValue, -1 | 1 | 2> = { down: -1, like: 1, love: 2 };

export default function DetailPage() {
  return (
    <ToastProvider>
      <DetailContent />
    </ToastProvider>
  );
}

function DetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [video, setVideo] = useState<Video | null>(null);
  const [related, setRelated] = useState<RelatedVideo[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [inList, setInList] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [rating, setRating] = useState<RatingValue | null>(null);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingSaving, setRatingSaving] = useState(false);
  const [resumeProgress, setResumeProgress] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError('');

    async function load() {
      try {
        const [
          { video, related }, { categories }, { series: allSeries },
          { items: watchlist }, { rating: myRating }, { items: continueItems },
        ] = await Promise.all([
            apiClient.getVideo(id),
            apiClient.getCategories(),
            apiClient.getSeries(),
            apiClient.getWatchlist(),
            apiClient.getVideoRating(id),
            apiClient.getContinueWatching(),
          ]);

        if (cancelled) return;
        setVideo(video);
        setRelated(related);
        setCategories(categories);
        setSeries(allSeries);
        setInList(watchlist.some((i) => i.id === id));
        setRating(myRating != null ? RATING_TO_VALUE[myRating] : null);
        setResumeProgress(continueItems.find((i) => i.id === id)?.progress_sec ?? null);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          if (err.code === 'SUBSCRIPTION_REQUIRED') { router.replace('/planes'); return; }
          setError(err.message);
        } else {
          setError('No se pudo cargar el vídeo.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id, router]);

  const toggleList = async () => {
    if (!video || listLoading) return;
    setListLoading(true);
    try {
      if (inList) {
        await apiClient.removeFromWatchlist(video.id);
        setInList(false);
      } else {
        await apiClient.addToWatchlist(video.id);
        setInList(true);
      }
    } catch {
      toast('error', 'No se pudo actualizar tu lista. Inténtalo de nuevo.');
    } finally {
      setListLoading(false);
    }
  };

  const handleRatingChange = async (value: RatingValue | null) => {
    if (!video || ratingSaving) return;
    const previous = rating;
    setRatingSaving(true);
    setRating(value); // optimista — se revierte si falla la llamada
    try {
      if (value === null) {
        await apiClient.deleteVideoRating(video.id);
        toast('success', 'Valoración eliminada.');
      } else {
        await apiClient.rateVideo(video.id, VALUE_TO_RATING[value]);
        toast('success', 'Gracias por tu valoración.');
      }
    } catch {
      setRating(previous);
      toast('error', 'No se pudo guardar tu valoración. Inténtalo de nuevo.');
    } finally {
      setRatingSaving(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: video?.title, url });
      } catch {
        /* el usuario canceló el diálogo de compartir */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast('success', 'Enlace copiado al portapapeles.');
    } catch {
      toast('error', 'No se pudo copiar el enlace.');
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-red-400 text-lg">{error}</p>
        <button onClick={() => router.back()} className="text-white/60 hover:text-white text-sm underline">
          ← Volver
        </button>
      </div>
    );
  }

  if (loading || !video) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <svg className="animate-spin w-10 h-10 text-brand" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const videoCategory = categories.find((c) => c.id === video.category_id);
  const videoSeries = series.find((s) => s.id === video.series_id);
  const year = new Date(video.created_at).getFullYear();
  const kicker = videoSeries
    ? `${videoSeries.title}${video.episode_num != null ? ` · Ep ${video.episode_num}` : ''}`
    : videoCategory?.name ?? '';
  const chips = [videoCategory?.name, videoSeries?.title].filter(Boolean) as string[];

  // Progreso de visionado del usuario para pintar la línea de tiempo en "Más como esto"
  const relatedProgress: Record<string, number> = {};
  for (const r of related) {
    if (r.completed) relatedProgress[r.id] = 100;
    else if (r.progress_sec && r.duration_sec > 0) {
      relatedProgress[r.id] = Math.round((r.progress_sec / r.duration_sec) * 100);
    }
  }
  const toVideo = (r: RelatedVideo): Video => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    thumbnail_url: r.thumbnail_url,
    duration_sec: r.duration_sec,
    episode_num: r.episode_num,
    description: null,
    category_id: null,
    series_id: null,
    created_at: video.created_at,
  });

  return (
    <div className="min-h-screen bg-surface">
      {/* ── Cabecera ── */}
      <section className="relative w-full" style={{ height: '66vh', minHeight: 460 }}>
        {video.thumbnail_url ? (
          <img src={video.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover" aria-hidden />
        ) : (
          <div className="absolute inset-0 bg-surface-raised" />
        )}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(90deg, rgba(6,9,12,0.9) 0%, rgba(6,9,12,0.4) 45%, rgba(6,9,12,0) 75%)' }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(0deg, #06090c 1%, rgba(6,9,12,0.1) 40%, rgba(6,9,12,0) 60%)' }}
        />

        <button
          onClick={() => router.back()}
          className="absolute top-6 left-6 md:left-12 inline-flex items-center gap-2 px-4 py-[9px] rounded-[9px] text-[13.5px] font-medium z-10"
          style={{ background: 'rgba(6,9,12,0.55)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(6px)', color: '#e9efeb' }}
        >
          <i className="ti ti-arrow-left text-[18px]" />
          Volver
        </button>

        <div className="absolute left-6 md:left-12 z-10" style={{ bottom: '7vh', maxWidth: 620 }}>
          {kicker && (
            <div className="text-[12.5px] font-semibold uppercase tracking-[0.1em] mb-3 text-brand-bright">
              {kicker}
            </div>
          )}
          <h1 className="font-display font-extrabold text-white text-[32px] md:text-[50px] leading-[1.05] tracking-[-0.02em] mb-4">
            {video.title}
          </h1>
          <div className="flex items-center gap-[10px] flex-wrap text-[13px]" style={{ color: '#c4d0cb' }}>
            <span>{year}</span>
            {videoCategory && (
              <>
                <Dot />
                <span>{videoCategory.name}</span>
              </>
            )}
            <Dot />
            <span>{formatDuration(video.duration_sec)}</span>
            <span className="px-[6px] py-[1px] rounded border border-white/28 text-[11px]">4K UHD</span>
          </div>
        </div>
      </section>

      {/* ── Contenido ── */}
      <div className="px-6 md:px-12 pt-2 pb-14 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 lg:gap-12 max-w-[1180px]">
        <div>
          <div className="flex items-center gap-3.5 flex-wrap mb-7">
            <button
              onClick={() => router.replace(`/watch/${video.id}/play`)}
              className="inline-flex items-center gap-[9px] px-[30px] py-[13px] rounded-[9px] bg-brand text-white font-bold text-[15px] transition-transform hover:scale-[1.03]"
              style={{ boxShadow: '0 6px 22px rgba(104,20,11,0.55)' }}
            >
              <i className="ti ti-player-play-filled text-[19px]" />
              {resumeProgress ? 'Reanudar' : 'Reproducir'}
            </button>
            <button
              onClick={toggleList}
              disabled={listLoading}
              className="inline-flex items-center gap-[9px] px-[22px] py-[13px] rounded-[9px] font-semibold text-[14.5px] transition-colors disabled:opacity-60"
              style={{ border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.07)', color: '#fff' }}
            >
              <i className={`ti ti-${inList ? 'check' : 'plus'} text-[19px]`} style={{ color: inList ? '#cf4a35' : '#fff' }} />
              {inList ? 'En tu lista' : 'Mi Lista'}
            </button>
            <button
              onClick={() => setRatingOpen(true)}
              aria-label={rating ? `Tu valoración: ${RATING_LABELS[rating]}. Pulsa para cambiarla.` : 'Valorar'}
              className="w-[46px] h-[46px] rounded-full flex items-center justify-center relative transition-colors hover:bg-white/8"
              style={{
                border: `1px solid ${rating ? RATING_META[rating].color : 'rgba(255,255,255,0.2)'}`,
                background: rating ? RATING_META[rating].bgColor : 'transparent',
                color: rating ? RATING_META[rating].color : '#cdd6d2',
              }}
            >
              {rating && RATING_META[rating].double ? (
                <>
                  <i
                    className={`ti ti-${RATING_META[rating].icon}-filled text-[14px]`}
                    style={{ position: 'absolute', left: 13, top: 15, transform: 'rotate(-8deg)' }}
                  />
                  <i
                    className={`ti ti-${RATING_META[rating].icon}-filled text-[14px]`}
                    style={{ position: 'absolute', right: 13, top: 15, transform: 'rotate(8deg)' }}
                  />
                </>
              ) : (
                <i className={`ti ti-${rating ? RATING_META[rating].icon : 'thumb-up'}${rating ? '-filled' : ''} text-[20px]`} />
              )}
            </button>
            <IconButton icon="share-2" ariaLabel="Compartir" onClick={handleShare} />
          </div>

          {video.description && (
            <p className="text-[16px] leading-[1.7] mb-6" style={{ color: '#cdd6d2' }}>{video.description}</p>
          )}

          {chips.length > 0 && (
            <div className="flex gap-2.5 flex-wrap mb-8">
              {chips.map((c) => (
                <span
                  key={c}
                  className="px-3 py-[6px] rounded-[7px] text-[12.5px]"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#a9b8b1' }}
                >
                  {c}
                </span>
              ))}
            </div>
          )}

          {/* Reparto — solo aparece si el vídeo tiene personas asignadas */}
          <CastRow crew={video.crew ?? []} onSelect={(m) => router.push(`/crew/${m.slug}`)} />
        </div>

        <div className="text-[13px] leading-[1.9]" style={{ color: '#85958e' }}>
          <MetaRow label="Serie" value={videoSeries?.title ?? '—'} />
          <MetaRow label="Categoría" value={videoCategory?.name ?? '—'} />
          <MetaRow label="Duración" value={formatDuration(video.duration_sec)} last />
        </div>
      </div>

      {/* ── Más como esto ── */}
      {related.length > 0 && (
        <div className="px-6 md:px-12 pb-16">
          <h2 className="font-display text-[19px] font-semibold text-white mb-4">Más como esto</h2>
          <div className="grid gap-[22px_18px]" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(252px, 1fr))' }}>
            {related.map((v) => (
              <VideoCard
                key={v.id}
                video={toVideo(v)}
                progress={relatedProgress[v.id]}
                onClick={(v) => router.push(`/watch/${v.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {ratingOpen && (
        <RatingDialog
          videoTitle={video.title}
          value={rating}
          onChange={handleRatingChange}
          onClose={() => setRatingOpen(false)}
        />
      )}
    </div>
  );
}

function Dot() {
  return <span className="w-[3px] h-[3px] rounded-full" style={{ background: '#5f6f69' }} />;
}

function MetaRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{ marginBottom: last ? 0 : 14 }}>
      <span style={{ color: '#5f6f69' }}>{label}: </span>
      <span style={{ color: '#cdd6d2' }}>{value}</span>
    </div>
  );
}

function IconButton({ icon, ariaLabel, onClick }: { icon: string; ariaLabel: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="w-[46px] h-[46px] rounded-full flex items-center justify-center transition-colors hover:bg-white/8"
      style={{ border: '1px solid rgba(255,255,255,0.2)', color: '#cdd6d2' }}
    >
      <i className={`ti ti-${icon} text-[20px]`} />
    </button>
  );
}
