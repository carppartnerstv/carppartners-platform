'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, ApiError } from '@carp-partners/api-client';
import type { Category, Series, CrewMember } from '@carp-partners/api-client';
import { SeriesCard, CrewCard } from '@carp-partners/ui';

type Tab = 'all' | 'crew' | string; // string = id de categoría real

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export default function ExplorarPage() {
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const isCrewTab = tab === 'crew';

  // Series/películas (tarjetas) del catálogo — nunca vídeos sueltos
  const [seriesResults, setSeriesResults] = useState<Series[]>([]);
  const [seriesLoading, setSeriesLoading] = useState(true);

  // Crew — se carga una vez y se filtra en cliente por nombre
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [crewLoading, setCrewLoading] = useState(true);

  // Categorías + crew, una sola vez al montar
  useEffect(() => {
    apiClient.getCategories()
      .then(({ categories }) => setCategories(categories))
      .catch(() => null)
      .finally(() => setLoadingCategories(false));

    apiClient.getCrew()
      .then(({ crew }) => setCrew(crew))
      .catch(() => null)
      .finally(() => setCrewLoading(false));
  }, []);

  // Debounce de la búsqueda: espera 300ms tras dejar de teclear
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Series/películas de la categoría activa (siempre a nivel de serie, nunca de vídeo)
  useEffect(() => {
    if (isCrewTab) return;
    let cancelled = false;
    setSeriesLoading(true);
    const categoryFilter = tab === 'all' ? undefined : tab;

    apiClient.getSeries(categoryFilter ? { category: categoryFilter } : undefined)
      .then(({ series }) => { if (!cancelled) setSeriesResults(series); })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === 'SUBSCRIPTION_REQUIRED') router.replace('/planes');
      })
      .finally(() => { if (!cancelled) setSeriesLoading(false); });

    return () => { cancelled = true; };
  }, [tab, isCrewTab, router]);

  // Filtrado por texto en cliente: series por título, crew por nombre
  const q = normalize(debouncedQuery);
  const filteredSeries = q ? seriesResults.filter((s) => normalize(s.title).includes(q)) : seriesResults;
  const filteredCrew = q ? crew.filter((m) => normalize(m.name).includes(q)) : crew;

  const loading = isCrewTab ? crewLoading : seriesLoading;
  const resultCount = isCrewTab
    ? `${filteredCrew.length} ${filteredCrew.length === 1 ? 'miembro' : 'miembros'}`
    : `${filteredSeries.length} ${filteredSeries.length === 1 ? 'resultado' : 'resultados'}`;
  const showEmpty = !loading && (isCrewTab ? filteredCrew.length === 0 : filteredSeries.length === 0);

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
          placeholder={isCrewTab ? 'Buscar miembro de la crew…' : 'Buscar series, películas…'}
          className="flex-1 bg-transparent border-none outline-none text-[15px]"
          style={{ color: '#eef3f0' }}
        />
      </div>

      {/* Pestañas: categorías reales + Crew */}
      {!loadingCategories && (
        <div className="flex gap-[10px] flex-wrap mb-[30px]">
          <FilterChip label="Todo" active={tab === 'all'} onClick={() => setTab('all')} />
          {categories.map((c) => (
            <FilterChip key={c.id} label={c.name} active={tab === c.id} onClick={() => setTab(c.id)} />
          ))}
          <FilterChip label="Crew" active={isCrewTab} onClick={() => setTab('crew')} />
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
            {isCrewTab
              ? 'No encontramos a nadie con ese nombre.'
              : 'No encontramos nada para tu búsqueda. Prueba con otra palabra o cambia los filtros.'}
          </p>
        </div>
      ) : (
        <div
          className="grid gap-[24px_18px]"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(252px, 1fr))' }}
        >
          {isCrewTab
            ? filteredCrew.map((m) => (
                <CrewCard key={m.id} member={m} onClick={(m) => router.push(`/crew/${m.slug}`)} />
              ))
            : filteredSeries.map((s) => (
                <SeriesCard key={s.id} series={s} onClick={(s) => router.push(`/serie/${s.id}`)} />
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
