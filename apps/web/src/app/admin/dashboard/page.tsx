'use client';

import React, { useEffect, useState } from 'react';
import { apiClient, ApiError } from '@carp-partners/api-client';
import type { DashboardStats } from '@carp-partners/api-client';

// ─── Tarjeta de métrica ───────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className={[
      'rounded-card border p-5 flex flex-col gap-3',
      accent
        ? 'bg-brand/8 border-brand/25'
        : 'bg-surface-raised border-white/8',
    ].join(' ')}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold text-white/50 uppercase tracking-wide">{label}</p>
        <span className={['p-2 rounded-lg', accent ? 'bg-brand/20 text-brand-bright' : 'bg-white/8 text-white/50'].join(' ')}>
          {icon}
        </span>
      </div>
      <div>
        <p className="font-display text-[2rem] font-bold text-white leading-none">{value}</p>
        {sub && <p className="text-white/40 text-xs mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Skeleton de carga ────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-card border border-white/8 bg-surface-raised p-5 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="h-3 w-24 rounded bg-white/10" />
        <div className="w-8 h-8 rounded-lg bg-white/10" />
      </div>
      <div className="h-8 w-20 rounded bg-white/10" />
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [stats, setStats]   = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    apiClient.getAdminDashboard()
      .then(setStats)
      .catch(e => setError(e instanceof ApiError ? e.message : 'Error al cargar métricas'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-[22px] font-bold text-white">Dashboard</h1>
        <p className="text-white/45 text-sm mt-0.5">Resumen del estado de la plataforma</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-md px-4 py-3 text-red-400 text-sm flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Grid de métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : stats ? (
          <>
            <MetricCard
              label="Suscriptores activos"
              value={stats.activeSubscribers.toLocaleString('es-ES')}
              sub="Cuentas activas o en prueba"
              accent
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            />
            <MetricCard
              label="Vídeos publicados"
              value={stats.publishedVideos.toLocaleString('es-ES')}
              sub="Visibles para suscriptores"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
              }
            />
            <MetricCard
              label="Reproducciones hoy"
              value={stats.playsToday.toLocaleString('es-ES')}
              sub={`Desde las 00:00 de hoy`}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <MetricCard
              label="MRR"
              value={stats.mrr.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
              sub="Ingresos recurrentes mensuales (aprox.)"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          </>
        ) : null}
      </div>

      {/* Nota pie */}
      {!loading && !error && (
        <p className="text-white/25 text-xs">
          El MRR es una estimación basada en 9,99 €/mes y 7,50 €/mes equivalente para suscripciones anuales.
          Para datos precisos, consulta el dashboard de Stripe.
        </p>
      )}
    </div>
  );
}
