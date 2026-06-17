'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@carp-partners/api-client';
import type { WatchlistItem } from '@carp-partners/api-client';
import { VideoCard } from '@carp-partners/ui';
import type { Video } from '@carp-partners/api-client';

export default function MiListaPage() {
  const router = useRouter();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getWatchlist()
      .then(({ items }) => setItems(items))
      .catch((err) => {
        if (err instanceof ApiError && err.code === 'SUBSCRIPTION_REQUIRED') {
          router.replace('/?planes=1');
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  const asVideo = (item: WatchlistItem): Video => ({
    id: item.id,
    title: item.title,
    slug: item.slug,
    thumbnail_url: item.thumbnail_url,
    duration_sec: item.duration_sec,
    description: null,
    category_id: null,
    series_id: null,
    episode_num: null,
    created_at: item.added_at,
  });

  return (
    <div className="min-h-screen bg-surface px-6 md:px-12 py-10">
      <h1 className="text-white text-3xl font-bold mb-8">Mi lista</h1>
      {loading ? (
        <p className="text-white/40">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-white/40">Todavía no has añadido ningún vídeo a tu lista.</p>
      ) : (
        <div className="flex flex-wrap gap-4">
          {items.map((item) => (
            <VideoCard
              key={item.id}
              video={asVideo(item)}
              onClick={(v) => router.push(`/watch/${v.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
