'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@carp-partners/api-client';
import type { Video, Category, SeriesDetail as SeriesDetailType, WatchHistoryItem } from '@carp-partners/api-client';

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
}

export default function SerieDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [detail, setDetail] = useState<SeriesDetailType | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [continueItems, setContinueItems] = useState<WatchHistoryItem[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<string | null>(null);
  const [seasonMenuOpen, setSeasonMenuOpen] = useState(false);
  const [episodes, setEpisodes] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(true);
  const [error, setError] = useState('');

  // Carga la serie/película + su lista de temporadas
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError('');

    async function load() {
      try {
        const [d, { categories }, { items }] = await Promise.all([
          apiClient.getSeriesDetail(id),
          apiClient.getCategories(),
          apiClient.getContinueWatching(),
        ]);
        if (cancelled) return;
        setDetail(d);
        setCategories(categories);
        setContinueItems(items);
        setSelectedSeason(d.seasons.length > 0 ? d.seasons[0].id : null);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError) {
          if (err.code === 'SUBSCRIPTION_REQUIRED') { router.replace('/planes'); return; }
          setError(err.message);
        } else {
          setError('No se pudo cargar la serie.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id, router]);

  // Carga los episodios de la temporada seleccionada (o de la serie entera si es "plana")
  useEffect(() => {
    if (!detail) return;
    const targetSeriesId = detail.seasons.length > 0 ? selectedSeason : detail.series.id;
    if (!targetSeriesId) return;

    let cancelled = false;
    setEpisodesLoading(true);
    apiClient
      .getVideos({ series: targetSeriesId, limit: 100 })
      .then(({ videos }) => { if (!cancelled) setEpisodes(videos); })
      .catch(() => { if (!cancelled) setEpisodes([]); })
      .finally(() => { if (!cancelled) setEpisodesLoading(false); });

    return () => { cancelled = true; };
  }, [detail, selectedSeason]);

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

  if (loading || !detail) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <svg className="animate-spin w-10 h-10 text-brand" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const { series, seasons } = detail;
  const hasSeasons = seasons.length > 0;
  const category = categories.find((c) => c.id === series.category_id);
  const activeSeasonNum = hasSeasons ? seasons.find((s) => s.id === selectedSeason)?.season_num ?? 1 : null;
  const metaline = hasSeasons
    ? `${seasons.length} temporada${seasons.length === 1 ? '' : 's'}`
    : `${episodes.length} episodio${episodes.length === 1 ? '' : 's'}`;

  const progressMap: Record<string, { pct: number; completed: boolean }> = {};
  for (const item of continueItems) {
    if (item.duration_sec > 0) {
      progressMap[item.id] = { pct: Math.round((item.progress_sec / item.duration_sec) * 100), completed: false };
    }
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* ── Cabecera ── */}
      <section className="relative w-full" style={{ height: '52vh', minHeight: 380 }}>
        {series.cover_url ? (
          <img src={series.cover_url} alt="" className="absolute inset-0 w-full h-full object-cover" aria-hidden />
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
          {category && (
            <div className="text-[12.5px] font-semibold uppercase tracking-[0.1em] mb-3 text-brand-bright">
              {category.name}
            </div>
          )}
          <h1 className="font-display font-extrabold text-white text-[32px] md:text-[50px] leading-[1.05] tracking-[-0.02em] mb-4">
            {series.title}
          </h1>
          <div className="flex items-center gap-[10px] flex-wrap text-[13px]" style={{ color: '#c4d0cb' }}>
            <span>{metaline}</span>
          </div>
        </div>
      </section>

      {/* ── Sinopsis (HTML enriquecido, sanitizado en el backend al guardar) ── */}
      {series.description && (
        <div className="px-6 md:px-12 pt-8 pb-2 max-w-[820px]">
          <div className="rich-editor">
            <div
              className="ProseMirror"
              style={{ fontSize: 16, lineHeight: 1.7, color: '#cdd6d2' }}
              dangerouslySetInnerHTML={{ __html: series.description }}
            />
          </div>
        </div>
      )}

      {/* ── Episodios ── */}
      <div className="px-6 md:px-12 pt-6 pb-16 max-w-[1180px]">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3.5">
          <h2 className="font-display text-[19px] font-semibold text-white m-0">Episodios</h2>

          {hasSeasons && (
            <div className="relative">
              <button
                onClick={() => setSeasonMenuOpen((v) => !v)}
                className="inline-flex items-center gap-2.5 px-4 py-[10px] rounded-[9px] text-[13.5px] font-semibold"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: '#e9efeb' }}
              >
                Temporada {activeSeasonNum}
                <i className="ti ti-chevron-down text-[16px]" style={{ color: '#9aa9a3' }} />
              </button>

              {seasonMenuOpen && (
                <>
                  <div onClick={() => setSeasonMenuOpen(false)} className="fixed inset-0 z-[15]" />
                  <div
                    className="absolute z-20 overflow-hidden"
                    style={{
                      top: 'calc(100% + 6px)', right: 0, minWidth: 170,
                      background: '#0e151a', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 11, boxShadow: '0 18px 44px rgba(0,0,0,0.55)',
                    }}
                  >
                    {seasons.map((s) => {
                      const active = s.id === selectedSeason;
                      return (
                        <div
                          key={s.id}
                          onClick={() => { setSelectedSeason(s.id); setSeasonMenuOpen(false); }}
                          className="px-4 py-[11px] text-[13.5px] cursor-pointer"
                          style={{
                            fontWeight: active ? 700 : 500,
                            color: active ? '#fff' : '#c4d0cb',
                            background: active ? 'rgba(104,20,11,0.14)' : 'transparent',
                          }}
                        >
                          Temporada {s.season_num}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {episodesLoading ? (
          <p className="text-white/40 text-center py-14">Cargando episodios…</p>
        ) : episodes.length === 0 ? (
          <p className="text-white/40 text-center py-14">No hay episodios disponibles.</p>
        ) : (
          <div className="flex flex-col">
            {episodes.map((ep, i) => (
              <EpisodeRow key={ep.id} episode={ep} num={ep.episode_num ?? i + 1} progress={progressMap[ep.id]} onClick={() => router.push(`/watch/${ep.id}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EpisodeRow({ episode, num, progress, onClick }: {
  episode: Video; num: number; progress?: { pct: number; completed: boolean }; onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-5 px-3.5 py-[18px] rounded-xl cursor-pointer transition-colors hover:bg-white/[0.04]"
    >
      <div className="w-[26px] shrink-0 text-center font-display text-[19px] font-bold" style={{ color: '#7d8d86' }}>
        {num}
      </div>
      <div className="relative shrink-0 rounded-[9px] overflow-hidden bg-surface-raised" style={{ width: 168, height: 94 }}>
        {episode.thumbnail_url ? (
          <img src={episode.thumbnail_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-surface-2" />
        )}
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.18)' }}>
          <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.16)' }}>
            <i className="ti ti-player-play-filled text-[16px] text-white" />
          </div>
        </div>
        {progress && progress.pct > 0 && (
          <div className="absolute left-0 right-0 bottom-0 h-[3px]" style={{ background: 'rgba(255,255,255,0.25)' }}>
            <div className="h-full bg-brand-bright" style={{ width: `${Math.min(progress.pct, 100)}%` }} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14.5px] font-semibold mb-[5px]" style={{ color: '#e9efeb' }}>{episode.title}</div>
        {episode.description && (
          <div className="text-[13px] leading-[1.55] line-clamp-2" style={{ color: '#85958e' }}>{episode.description}</div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[12.5px] tabular-nums" style={{ color: '#7d8d86' }}>{formatDuration(episode.duration_sec)}</div>
      </div>
    </div>
  );
}
