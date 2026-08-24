'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { apiClient, ApiError } from '@carp-partners/api-client';
import type { LaunchMetrics } from '@carp-partners/api-client';

// ─── Utilidades ─────────────────────────────────────────────────────────────

const nf = (n: number) => n.toLocaleString('es-ES');
const pct = (n: number, total: number) => (total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '—');

// ─── Piezas reutilizables de esta página ────────────────────────────────────

function StatTile({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={[
      'rounded-admin-card border p-5 bg-admin-surface shadow-admin-card',
      accent ? 'border-brand/25' : 'border-admin-border',
    ].join(' ')}>
      <p className="text-xs font-semibold text-admin-text-secondary uppercase tracking-wide">{label}</p>
      <p className={[
        'font-display text-[2rem] font-bold leading-none mt-3',
        accent ? 'text-brand-bright' : 'text-admin-text',
      ].join(' ')}>
        {value}
      </p>
      {sub && <p className="text-admin-text-muted text-xs mt-1.5">{sub}</p>}
    </div>
  );
}

// Fila del embudo: barra horizontal de un único tono (magnitud), con la
// etiqueta y el valor SIEMPRE fuera de la barra (nunca dentro) para que no
// haya riesgo de texto recortado en pasos con porcentajes muy bajos.
function FunnelStep({
  label,
  value,
  total,
  note,
}: {
  label: string;
  value: number;
  total: number;
  note?: string;
}) {
  const width = total > 0 ? Math.max((value / total) * 100, value > 0 ? 1.5 : 0) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[13.5px] font-medium text-admin-text">{label}</span>
        <span className="text-[13px] text-admin-text-secondary tabular-nums">
          <span className="font-semibold text-admin-text">{nf(value)}</span> · {pct(value, total)}
          {note && <span className="text-admin-text-tertiary"> · {note}</span>}
        </span>
      </div>
      <div className="h-[10px] rounded-full bg-admin-bg overflow-hidden">
        <div
          className="h-full rounded-full bg-brand-bright transition-[width] duration-500"
          style={{ width: `${width}%` }}
          title={`${nf(value)} de ${nf(total)} (${pct(value, total)})`}
        />
      </div>
    </div>
  );
}

interface RankedItem { id: string; title: string; value: number; caption: string }

// Tabla "top 10" con una barra fina de magnitud junto a cada fila — así se
// lee de un vistazo cuál destaca, sin dejar de tener el número exacto.
function RankedTable({ title, emptyLabel, items }: { title: string; emptyLabel: string; items: RankedItem[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="rounded-admin-card border border-admin-border bg-admin-surface shadow-admin-card p-5">
      <h3 className="font-display text-[15px] font-bold text-admin-text mb-4">{title}</h3>
      {items.length === 0 ? (
        <p className="text-admin-text-tertiary text-sm py-4 text-center">{emptyLabel}</p>
      ) : (
        <ol className="space-y-2.5">
          {items.map((item, i) => (
            <li key={item.id} className="flex items-center gap-3">
              <span className="w-4 shrink-0 text-[12px] font-semibold text-admin-text-tertiary tabular-nums">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-admin-text truncate" title={item.title}>{item.title}</p>
                <div className="h-[5px] rounded-full bg-admin-bg overflow-hidden mt-1">
                  <div
                    className="h-full rounded-full bg-brand-bright"
                    style={{ width: `${Math.max((item.value / max) * 100, 3)}%` }}
                  />
                </div>
              </div>
              <span className="shrink-0 text-[12.5px] text-admin-text-secondary tabular-nums text-right w-[92px]">
                {item.caption}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function SectionSkeleton({ heightClass = 'h-40' }: { heightClass?: string }) {
  return <div className={`rounded-admin-card border border-admin-border bg-admin-surface shadow-admin-card animate-pulse ${heightClass}`} />;
}

// ─── Página ─────────────────────────────────────────────────────────────────

export default function LaunchMetricsPage() {
  const [data, setData] = useState<LaunchMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    apiClient.getAdminLaunchMetrics()
      .then((r) => { setData(r); setUpdatedAt(new Date()); })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error al cargar las métricas'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const f = data?.funnel;
  const s = data?.subscriptions;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[22px] font-bold text-admin-text">Métricas de lanzamiento</h1>
          <p className="text-admin-text-secondary text-sm mt-0.5">
            Embudo de activación de los suscriptores migrados — pensado para consultar a diario durante el lanzamiento.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {updatedAt && !loading && (
            <span className="text-admin-text-tertiary text-xs">
              Actualizado a las {updatedAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="text-[12.5px] font-semibold text-brand-bright border border-brand/25 rounded-md px-3 py-1.5 hover:bg-[#fbebe8] transition-colors disabled:opacity-50"
          >
            {loading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-[#fdecea] border border-[#f7cfc9] rounded-md px-4 py-3 text-[#c0392b] text-sm">
          {error}
        </div>
      )}

      {/* 70/30: izquierda (suscripción + actividad de contenido) / derecha (embudo) */}
      <div className="grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-6 items-start">
        {/* ── Columna izquierda (70%) ── */}
        <div className="space-y-6 min-w-0">
          {/* Desglose por suscripción — a todo el ancho de la columna */}
          {loading && !data ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <SectionSkeleton key={i} heightClass="h-28" />)}
            </div>
          ) : s ? (
            <div>
              <h2 className="font-display text-[15px] font-bold text-admin-text mb-3">Suscripción</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatTile label="Activos" value={nf(s.active)} sub="Con acceso vigente ahora mismo" />
                <StatTile label="Cancelados / sin acceso" value={nf(s.inactive)} sub="Incluye migrados sin pago vigente" />
                <StatTile label="Activos con contraseña" value={nf(s.activeWithPassword)} sub="Ya pueden entrar a la plataforma nueva" />
                <StatTile
                  label="Activos SIN contraseña"
                  value={nf(s.activeWithoutPassword)}
                  sub="Pagan, y aún no hemos activado su acceso"
                  accent
                />
              </div>
            </div>
          ) : null}

          {/* Actividad de contenido */}
          {loading && !data ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SectionSkeleton heightClass="h-72" />
              <SectionSkeleton heightClass="h-72" />
            </div>
          ) : data ? (
            <div>
              <h2 className="font-display text-[15px] font-bold text-admin-text mb-3">Actividad de contenido</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <RankedTable
                  title="Vídeos más vistos"
                  emptyLabel="Todavía no hay reproducciones registradas."
                  items={data.topWatched.map((v) => ({
                    id: v.id,
                    title: v.title,
                    value: v.viewers,
                    caption: `${nf(v.viewers)} espectador${v.viewers === 1 ? '' : 'es'}`,
                  }))}
                />
                <RankedTable
                  title="Vídeos mejor valorados"
                  emptyLabel="Todavía no hay valoraciones registradas."
                  items={data.topRated.map((v) => ({
                    id: v.id,
                    title: v.title,
                    value: v.votes,
                    caption: `${v.avgRating?.toFixed(2) ?? '—'} · ${v.votes} voto${v.votes === 1 ? '' : 's'}`,
                  }))}
                />
              </div>
              <p className="text-admin-text-tertiary text-xs mt-2">
                La media de valoración va de -1 (no es para mí) a 2 (me encanta); 1 es &quot;me gusta&quot;.
              </p>
            </div>
          ) : null}
        </div>

        {/* ── Columna derecha (30%): embudo de activación ── */}
        <div className="min-w-0">
          <h2 className="font-display text-[15px] font-bold text-admin-text mb-3">Embudo de activación</h2>
          {loading && !data ? (
            <SectionSkeleton heightClass="h-[420px]" />
          ) : f ? (
            <div className="rounded-admin-card border border-admin-border bg-admin-surface shadow-admin-card p-5">
              <div className="space-y-4">
                <FunnelStep label="Migrados" value={f.migrated} total={f.migrated} />
                <FunnelStep
                  label="Han creado contraseña"
                  value={f.withPassword}
                  total={f.migrated}
                  note={`${nf(f.withoutPassword)} pendientes`}
                />
                <FunnelStep label="Han entrado a la plataforma" value={f.hasAccessed} total={f.migrated} />
                <FunnelStep label="Han visto algún vídeo" value={f.hasWatched} total={f.migrated} />
                <FunnelStep label="Han valorado algún vídeo" value={f.hasRated} total={f.migrated} />
              </div>
            </div>
          ) : null}
          {!loading && f && (
            <p className="text-admin-text-tertiary text-xs mt-2">
              Porcentaje siempre sobre el total de migrados ({nf(f.migrated)}). No incluye la apertura del email — el SMTP no la registra.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
