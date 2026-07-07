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
          router.replace('/planes');
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

  const countLabel = items.length === 0
    ? 'Aún no has guardado nada'
    : `${items.length} ${items.length === 1 ? 'vídeo guardado' : 'vídeos guardados'}`;

  return (
    <div className="min-h-screen bg-surface px-6 md:px-12 py-10">
      <h1 className="font-display font-bold text-white text-[34px] tracking-[-0.02em] mb-2">
        Mi Lista
      </h1>
      {!loading && (
        <p className="text-[14px] mb-[30px]" style={{ color: '#7d8d86' }}>{countLabel}</p>
      )}

      {loading ? (
        <p className="text-white/40">Cargando…</p>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-[70px] px-5">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-[22px]"
            style={{ background: 'rgba(104,20,11,0.14)', border: '1px solid rgba(104,20,11,0.3)' }}
          >
            <i className="ti ti-bookmark text-[38px] text-brand-bright" />
          </div>
          <div className="font-display font-semibold text-[20px] mb-2" style={{ color: '#cdd6d2' }}>
            Tu lista está vacía
          </div>
          <p className="text-[14px] max-w-[360px] mb-[22px]" style={{ color: '#7d8d86' }}>
            Guarda vídeos para verlos más tarde. Pulsa «Mi Lista» en cualquier vídeo.
          </p>
          <button
            onClick={() => router.push('/explorar')}
            className="inline-flex items-center gap-[9px] px-6 py-3 rounded-[9px] bg-brand text-white font-bold text-[14.5px]"
          >
            <i className="ti ti-compass text-[18px]" />
            Explorar catálogo
          </button>
        </div>
      ) : (
        <div
          className="grid gap-[24px_18px]"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(252px, 1fr))' }}
        >
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
