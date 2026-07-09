'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@carp-partners/api-client';
import type { Video, Category, Series, WatchHistoryItem } from '@carp-partners/api-client';
import { HeroBanner, VideoRow } from '@carp-partners/ui';

interface CategoryRow {
  category: Category;
  videos: Video[];
}

export default function HomePage() {
  const router = useRouter();

  const [continueItems, setContinueItems] = useState<WatchHistoryItem[]>([]);
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [hero, setHero] = useState<Video | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);

  // Clic en una tarjeta → pantalla de detalle. "Ver ahora" del hero → reproducción directa.
  const goToDetail = useCallback(
    (video: Video) => router.push(`/watch/${video.id}`),
    [router],
  );
  const goToPlay = useCallback(
    (video: Video) => router.push(`/watch/${video.id}/play`),
    [router],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Cargamos categorías, series, "Continuar viendo" y el destacado de portada en paralelo
        const [{ categories }, { series: allSeries }, { items: continueWatching }, { video: featured }] =
          await Promise.all([
            apiClient.getCategories(),
            apiClient.getSeries(),
            apiClient.getContinueWatching(),
            apiClient.getFeaturedVideo(),
          ]);

        if (cancelled) return;
        setCategories(categories);
        setSeries(allSeries);
        setContinueItems(continueWatching);
        setHero(featured);

        // Cargamos vídeos de cada categoría en paralelo
        const rowsData = await Promise.all(
          categories.map(async (cat) => {
            const { videos } = await apiClient.getVideos({ category: cat.id, limit: 20 });
            return { category: cat, videos };
          }),
        );

        if (cancelled) return;

        const validRows = rowsData.filter((r) => r.videos.length > 0);
        setRows(validRows);
      } catch (err) {
        if (err instanceof ApiError && err.code === 'SUBSCRIPTION_REQUIRED') {
          router.replace('/planes');
        }
        // Otros errores los mostramos con la UI vacía
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [router]);

  // Mapa de progreso para "Continuar viendo"
  const progressMap: Record<string, number> = {};
  for (const item of continueItems) {
    if (item.duration_sec > 0) {
      progressMap[item.id] = Math.round((item.progress_sec / item.duration_sec) * 100);
    }
  }

  // Convertimos WatchHistoryItem → Video (misma forma)
  const continueVideos: Video[] = continueItems.map((item) => ({
    id: item.id,
    title: item.title,
    slug: item.slug,
    thumbnail_url: item.thumbnail_url,
    duration_sec: item.duration_sec,
    description: null,
    category_id: null,
    series_id: null,
    episode_num: null,
    created_at: item.last_watched_at,
  }));

  // Metadatos de categoría/serie para el hero
  const heroCategory = hero ? categories.find((c) => c.id === hero.category_id) : undefined;
  const heroSeries = hero ? series.find((s) => s.id === hero.series_id) : undefined;

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <svg className="animate-spin w-10 h-10 text-brand" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="bg-surface min-h-screen">
      {/* Hero banner */}
      {hero && (
        <HeroBanner
          video={hero}
          categoryName={heroCategory?.name}
          seriesTitle={heroSeries?.title}
          episodeCount={heroSeries?.episode_count}
          onPlay={goToPlay}
          onMoreInfo={goToDetail}
        />
      )}

      {/* Filas de vídeo */}
      <div className="px-6 md:px-12 pt-6 pb-16">
        {/* Continuar viendo — clic reanuda directamente, no pasa por el detalle */}
        {continueVideos.length > 0 && (
          <VideoRow
            title="Continuar viendo"
            videos={continueVideos}
            progressMap={progressMap}
            onVideoClick={goToPlay}
          />
        )}

        {/* Filas por categoría */}
        {rows.map(({ category, videos }) => (
          <VideoRow
            key={category.id}
            title={category.name}
            videos={videos}
            onVideoClick={goToDetail}
          />
        ))}

        {rows.length === 0 && !loading && (
          <p className="text-white/40 text-center py-20">
            No hay vídeos disponibles todavía.
          </p>
        )}
      </div>
    </div>
  );
}
