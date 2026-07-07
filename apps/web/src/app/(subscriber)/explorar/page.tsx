'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@carp-partners/api-client';
import type { Category, Video } from '@carp-partners/api-client';
import { VideoCard } from '@carp-partners/ui';

export default function ExplorarPage() {
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | 'all'>('all');

  const [results, setResults] = useState<Video[]>([]);
  const [resultsLoading, setResultsLoading] = useState(true);

  // Categorías reales para las chips de filtro (una vez al montar)
  useEffect(() => {
    apiClient
      .getCategories()
      .then(({ categories }) => setCategories(categories))
      .catch(() => null)
      .finally(() => setLoadingCategories(false));
  }, []);

  // Debounce de la búsqueda: espera 300ms tras dejar de teclear
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Busca en el catálogo real cada vez que cambia el término o la categoría
  useEffect(() => {
    let cancelled = false;
    setResultsLoading(true);

    apiClient
      .getVideos({
        q: debouncedQuery || undefined,
        category: activeCategory === 'all' ? undefined : activeCategory,
        limit: 100,
      })
      .then(({ videos }) => { if (!cancelled) setResults(videos); })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === 'SUBSCRIPTION_REQUIRED') {
          router.replace('/planes');
        }
      })
      .finally(() => { if (!cancelled) setResultsLoading(false); });

    return () => { cancelled = true; };
  }, [debouncedQuery, activeCategory, router]);

  const resultCount = `${results.length} ${results.length === 1 ? 'resultado' : 'resultados'}`;
  const showEmpty = !resultsLoading && results.length === 0;

  return (
    <div className="min-h-screen bg-surface px-6 md:px-12 py-10">
      <h1 className="font-display font-bold text-white text-[34px] tracking-[-0.02em] mb-[22px]">
        Explorar
      </h1>

      {/* Búsqueda */}
      <div
        className="flex items-center gap-3 max-w-[560px] px-[18px] py-[14px] rounded-xl mb-6"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <i className="ti ti-search text-[21px]" style={{ color: '#85958e' }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar vídeos, series, técnicas…"
          className="flex-1 bg-transparent border-none outline-none text-[15px]"
          style={{ color: '#eef3f0' }}
        />
      </div>

      {/* Chips de categoría */}
      {!loadingCategories && (
        <div className="flex gap-[10px] flex-wrap mb-[30px]">
          <FilterChip
            label="Todo"
            active={activeCategory === 'all'}
            onClick={() => setActiveCategory('all')}
          />
          {categories.map((c) => (
            <FilterChip
              key={c.id}
              label={c.name}
              active={activeCategory === c.id}
              onClick={() => setActiveCategory(c.id)}
            />
          ))}
        </div>
      )}

      <p className="text-[13px] mb-[18px]" style={{ color: '#7d8d86' }}>{resultCount}</p>

      {showEmpty ? (
        <div className="flex flex-col items-center justify-center text-center py-[70px] px-5">
          <div
            className="w-[76px] h-[76px] rounded-full flex items-center justify-center mb-5"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <i className="ti ti-mood-empty text-[36px]" style={{ color: '#5f6f69' }} />
          </div>
          <div className="font-display font-semibold text-[19px] mb-2" style={{ color: '#cdd6d2' }}>
            Sin resultados
          </div>
          <p className="text-[14px] max-w-[340px]" style={{ color: '#7d8d86' }}>
            No encontramos nada para tu búsqueda. Prueba con otra palabra o cambia los filtros.
          </p>
        </div>
      ) : (
        <div
          className="grid gap-[24px_18px]"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(252px, 1fr))' }}
        >
          {results.map((v) => (
            <VideoCard key={v.id} video={v} onClick={(v) => router.push(`/watch/${v.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-lg text-[13px] font-semibold transition-all"
      style={{
        background: active ? '#68140b' : 'rgba(255,255,255,0.05)',
        color: active ? '#fff' : '#c4d0cb',
        border: `1px solid ${active ? '#68140b' : 'rgba(255,255,255,0.1)'}`,
      }}
    >
      {label}
    </button>
  );
}
