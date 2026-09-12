'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient, ApiError } from '@carp-partners/api-client';
import type { DashboardStats, RecentMembers, RecentPayments, PlaysToday, LoginHistoryResponse } from '@carp-partners/api-client';

// ─── Tarjeta de métrica ───────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  sub,
  icon,
  accent = false,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent?: boolean;
  /** Si se pasa, la tarjeta entera es un enlace (p. ej. al listado ya filtrado). */
  href?: string;
}) {
  const content = (
    <div className={[
      'rounded-admin-card border p-5 flex flex-col gap-3 bg-admin-surface shadow-admin-card',
      accent ? 'border-brand/25' : 'border-admin-border',
      href ? 'transition-shadow hover:shadow-md hover:border-brand/40 cursor-pointer' : '',
    ].join(' ')}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold text-admin-text-secondary uppercase tracking-wide">{label}</p>
        <span className={['p-2 rounded-lg', accent ? 'bg-[#fbebe8] text-brand-bright' : 'bg-admin-bg text-admin-text-secondary'].join(' ')}>
          {icon}
        </span>
      </div>
      <div>
        <p className="font-display text-[2rem] font-bold text-admin-text leading-none">{value}</p>
        {sub && <p className="text-admin-text-muted text-xs mt-1">{sub}</p>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

// ─── Skeleton de carga ────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-admin-card border border-admin-border bg-admin-surface shadow-admin-card p-5 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="h-3 w-24 rounded bg-admin-border-soft" />
        <div className="w-8 h-8 rounded-lg bg-admin-border-soft" />
      </div>
      <div className="h-8 w-20 rounded bg-admin-border-soft" />
    </div>
  );
}

// ─── Widgets "recientes" (equivalente a los del panel de ARMember) ───────────

const PLAN_LABELS: Record<string, string> = { monthly: 'Mensual', annual: 'Anual', courtesy: 'Cortesía' };

function fmtShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

function fmtAmount(amount: number, currency: string) {
  return (amount / 100).toLocaleString('es-ES', { style: 'currency', currency: currency.toUpperCase() });
}

// Redondea el máximo del eje Y a un número "bonito" (1/2/5 × potencia de
// 10) para que las líneas de rejilla caigan en valores enteros legibles,
// en vez de escalar exactamente al máximo real de los datos.
function niceMax(raw: number, ticks = 4) {
  if (raw <= 0) return ticks;
  const rawStep = raw / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const norm = rawStep / magnitude;
  const niceStep = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * magnitude;
  return Math.ceil(raw / niceStep) * niceStep;
}

// Caja de tooltip dibujada dentro del propio SVG (evita tener que
// sincronizar coordenadas SVG con un div HTML flotante). Anclada arriba del
// gráfico y desplazándose en X con el cursor, con clamp para no salirse del
// viewBox por los bordes.
function ChartTooltip({
  x, chartWidth, label, lines,
}: {
  x: number;
  chartWidth: number;
  label: string;
  lines: { label: string; color: string; value: number }[];
}) {
  const boxW = 128;
  const boxH = 20 + lines.length * 14;
  const boxX = Math.min(Math.max(x - boxW / 2, 4), chartWidth - boxW - 4);
  const boxY = 4;
  return (
    <g pointerEvents="none">
      <rect x={boxX} y={boxY} width={boxW} height={boxH} rx={5} fill="#1c2024" opacity={0.94} />
      <text x={boxX + 9} y={boxY + 14} fontSize={9.5} fill="#fff" fontWeight={700}>
        {label}
      </text>
      {lines.map((l, i) => (
        <g key={l.label}>
          <circle cx={boxX + 11} cy={boxY + 24 + i * 14} r={2.5} fill={l.color} />
          <text x={boxX + 18} y={boxY + 27.5 + i * 14} fontSize={9} fill="#fff">
            {l.label}: {l.value}
          </text>
        </g>
      ))}
    </g>
  );
}

// Gráfico de líneas con los dos ejes (como el panel de ARMember), hecho a
// mano en SVG — para dos gráficos tan simples no compensa añadir una
// librería nueva. Admite una o varias series (para el desglose por plan) y
// es interactivo: al pasar el cursor por un vértice muestra la fecha y el
// valor de cada serie en ese punto.
function AxisLineChart({
  dates, series, height = 130,
}: {
  dates: string[];
  series: { label: string; color: string; values: number[] }[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 640, h = height;
  const padLeft = 26, padRight = 8, padTop = 8, padBottom = 30;
  const plotW = w - padLeft - padRight;
  const plotH = h - padTop - padBottom;

  const rawMax = Math.max(1, ...series.flatMap((s) => s.values));
  const yMax = niceMax(rawMax);
  const yTicks = [0, 1, 2, 3, 4].map((i) => Math.round((yMax / 4) * i));

  const n = dates.length;
  const stepX = n > 1 ? plotW / (n - 1) : 0;
  const xFor = (i: number) => padLeft + i * stepX;
  const yFor = (v: number) => padTop + plotH - (v / yMax) * plotH;
  // No amontonar las fechas del eje X: una etiqueta cada ~3 puntos (1 mes ≈ 10 etiquetas).
  const xTickEvery = Math.max(1, Math.round(n / 10));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} onMouseLeave={() => setHover(null)}>
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={padLeft} x2={w - padRight} y1={yFor(v)} y2={yFor(v)} stroke="#eef0f2" strokeWidth={1} />
          <text x={padLeft - 5} y={yFor(v)} textAnchor="end" dominantBaseline="middle" fontSize={9} fill="#9aa0a6">
            {v}
          </text>
        </g>
      ))}
      <line x1={padLeft} x2={padLeft} y1={padTop} y2={h - padBottom} stroke="#e7e9ec" strokeWidth={1} />
      <line x1={padLeft} x2={w - padRight} y1={h - padBottom} y2={h - padBottom} stroke="#e7e9ec" strokeWidth={1} />
      {dates.map((d, i) => i % xTickEvery === 0 && (
        <text
          key={d}
          x={xFor(i)}
          y={h - padBottom + 12}
          textAnchor="end"
          fontSize={8.5}
          fill="#9aa0a6"
          transform={`rotate(-40 ${xFor(i)} ${h - padBottom + 12})`}
        >
          {fmtShortDate(d)}
        </text>
      ))}
      {series.map((s) => (
        <polyline
          key={s.label}
          points={s.values.map((v, i) => `${xFor(i)},${yFor(v)}`).join(' ')}
          fill="none"
          stroke={s.color}
          strokeWidth={2.25}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}

      {/* Franjas invisibles, una por punto, para detectar sobre qué vértice está el cursor. */}
      {dates.map((_, i) => (
        <rect
          key={`hit-${dates[i]}`}
          x={xFor(i) - (stepX || plotW) / 2}
          y={padTop}
          width={stepX || plotW}
          height={plotH}
          fill="transparent"
          onMouseEnter={() => setHover(i)}
        />
      ))}

      {hover !== null && (
        <g pointerEvents="none">
          <line x1={xFor(hover)} x2={xFor(hover)} y1={padTop} y2={h - padBottom} stroke="#c7ccd1" strokeWidth={1} strokeDasharray="3 3" />
          {series.map((s) => (
            <circle key={s.label} cx={xFor(hover)} cy={yFor(s.values[hover])} r={3.5} fill={s.color} stroke="#fff" strokeWidth={1.5} />
          ))}
          <ChartTooltip
            x={xFor(hover)}
            chartWidth={w}
            label={fmtShortDate(dates[hover])}
            lines={series.map((s) => ({ label: s.label, color: s.color, value: s.values[hover] }))}
          />
        </g>
      )}
    </svg>
  );
}

function ChartLegend({ series }: { series: { label: string; color: string }[] }) {
  return (
    <div className="flex items-center gap-4 mb-1">
      {series.map((s) => (
        <span key={s.label} className="flex items-center gap-1.5 text-[11px] text-admin-text-secondary">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

// h-full + flex-col para que las tres tarjetas de una misma fila (Miembros
// / Pagos / Historial de accesos) queden siempre a la misma altura — la
// marca la más alta de las tres (normalmente la que tiene gráfico), y las
// demás estiran su lista interna (flex-1) para rellenar en vez de dejar
// hueco en blanco al final.
function WidgetCard({ title, sub, href, children }: { title: string; sub: string; href?: string; children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col rounded-admin-card border border-admin-border bg-admin-surface shadow-admin-card p-5">
      <div className="flex items-start justify-between mb-4 shrink-0">
        <div>
          <p className="font-display text-sm font-bold text-admin-text">{title}</p>
          <p className="text-admin-text-tertiary text-xs mt-0.5">{sub}</p>
        </div>
        {href && (
          <Link href={href} className="text-brand-bright text-xs font-semibold hover:underline shrink-0">
            Ver todos
          </Link>
        )}
      </div>
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </div>
  );
}

function RecentMembersWidget() {
  const [data, setData] = useState<RecentMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.getAdminRecentMembers()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error al cargar'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <WidgetCard title="Miembros recientes" sub="Personas nuevas en el último mes (no cuenta renovaciones)" href="/admin/suscriptores">
      {loading ? (
        <div className="h-32 animate-pulse bg-admin-border-soft rounded" />
      ) : error || !data ? (
        <p className="text-admin-text-tertiary text-sm py-6 text-center">{error || 'Sin datos'}</p>
      ) : (
        <>
          <AxisLineChart
            dates={data.series.map((d) => d.date)}
            series={[{ label: 'Miembros', color: '#cf4a35', values: data.series.map((d) => d.count) }]}
          />
          <ul className="mt-4 space-y-2.5 flex-1 min-h-0 overflow-y-auto">
            {data.recent.length === 0 && (
              <li className="text-admin-text-tertiary text-sm text-center py-4">Todavía no hay suscripciones.</li>
            )}
            {data.recent.map((m, i) => (
              <li key={`${m.email}-${i}`} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="text-admin-text font-medium truncate">{m.name || m.email}</p>
                  <p className="text-admin-text-tertiary text-xs truncate">{m.email}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-admin-text-secondary text-xs">{PLAN_LABELS[m.plan ?? ''] ?? m.plan ?? '—'}</p>
                  <p className="text-admin-text-tertiary text-[11px]">{fmtShortDate(m.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </WidgetCard>
  );
}

function RecentPaymentsWidget() {
  const [data, setData] = useState<RecentPayments | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.getAdminRecentPayments()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error al cargar'))
      .finally(() => setLoading(false));
  }, []);

  const legendSeries = [
    { label: 'Mensual', color: '#cf4a35' },
    { label: 'Anual', color: '#2f6f76' },
  ];

  return (
    <WidgetCard title="Pagos recientes" sub="Personas nuevas acumuladas por plan (1 mes) y últimos cobros de Stripe" href="/admin/pagos">
      {loading ? (
        <div className="h-32 animate-pulse bg-admin-border-soft rounded" />
      ) : error || !data ? (
        <p className="text-admin-text-tertiary text-sm py-6 text-center">{error || 'Sin datos'}</p>
      ) : (
        <>
          <ChartLegend series={legendSeries} />
          <AxisLineChart
            dates={data.series.map((d) => d.date)}
            series={[
              { label: 'Mensual', color: '#cf4a35', values: data.series.map((d) => d.monthly) },
              { label: 'Anual', color: '#2f6f76', values: data.series.map((d) => d.annual) },
            ]}
          />
          <ul className="mt-4 space-y-2.5 flex-1 min-h-0 overflow-y-auto">
            {data.recent.length === 0 && (
              <li className="text-admin-text-tertiary text-sm text-center py-4">Todavía no hay cobros.</li>
            )}
            {data.recent.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="text-admin-text-secondary truncate">{p.email}</p>
                  <p className="text-admin-text-tertiary text-[11px]">{fmtShortDate(p.created)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={['font-semibold tabular-nums', p.status === 'succeeded' ? 'text-admin-text' : 'text-admin-text-muted'].join(' ')}>
                    {fmtAmount(p.amount, p.currency)}
                  </p>
                  {p.status !== 'succeeded' && (
                    <p className="text-[11px] text-[#c0392b]">{p.status === 'failed' ? 'Fallido' : p.status}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </WidgetCard>
  );
}

// Últimos 100 inicios de sesión reales (login_history) — a diferencia de la
// "Actividad reciente" de /admin/metricas-lanzamiento (ventana de tiempo
// sobre users.last_login_at, solo el último por persona), esto es un log
// completo: la misma persona puede aparecer varias veces.
function LoginHistoryWidget() {
  const [data, setData] = useState<LoginHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.getAdminLoginHistory()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error al cargar'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <WidgetCard title="Historial de accesos" sub="Últimos 100 inicios de sesión">
      {loading ? (
        <div className="h-52 animate-pulse bg-admin-border-soft rounded" />
      ) : error || !data ? (
        <p className="text-admin-text-tertiary text-sm py-6 text-center">{error || 'Sin datos'}</p>
      ) : data.logins.length === 0 ? (
        <p className="text-admin-text-tertiary text-sm text-center py-6">Todavía no hay inicios de sesión registrados.</p>
      ) : (
        <ul className="divide-y divide-admin-border-soft flex-1 min-h-0 overflow-y-auto">
          {data.logins.map((l, i) => (
            <li key={i} className="flex items-center justify-between gap-3 text-sm py-2">
              <div className="min-w-0">
                <p className="text-admin-text truncate">{l.name || l.email}</p>
                <p className="text-admin-text-tertiary text-xs truncate">{l.email}</p>
              </div>
              <span className="shrink-0 text-admin-text-secondary text-xs tabular-nums">
                {new Date(l.loggedInAt).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}

// ─── Reproducciones hoy: barras por hora + listado de detalle ────────────────

function fmtHourTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
}

// Gráfico de barras por hora (0-23h, hora de Madrid) — mismo estilo y misma
// lógica de tooltip que AxisLineChart, adaptada a barras.
function HourlyBarChart({ hourly }: { hourly: PlaysToday['hourly'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 640, h = 140;
  const padLeft = 26, padRight = 8, padTop = 8, padBottom = 22;
  const plotW = w - padLeft - padRight;
  const plotH = h - padTop - padBottom;

  const yMax = niceMax(Math.max(1, ...hourly.map((d) => d.count)));
  const yTicks = [0, 1, 2, 3, 4].map((i) => Math.round((yMax / 4) * i));

  const slotW = plotW / 24;
  const barW = Math.max(1, slotW - 2);
  const xFor = (i: number) => padLeft + i * slotW;
  const yFor = (v: number) => padTop + plotH - (v / yMax) * plotH;
  const baseY = padTop + plotH;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }} onMouseLeave={() => setHover(null)}>
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={padLeft} x2={w - padRight} y1={yFor(v)} y2={yFor(v)} stroke="#eef0f2" strokeWidth={1} />
          <text x={padLeft - 5} y={yFor(v)} textAnchor="end" dominantBaseline="middle" fontSize={9} fill="#9aa0a6">
            {v}
          </text>
        </g>
      ))}
      <line x1={padLeft} x2={w - padRight} y1={baseY} y2={baseY} stroke="#e7e9ec" strokeWidth={1} />
      {hourly.map((d, i) => i % 3 === 0 && (
        <text key={d.hour} x={xFor(i) + barW / 2} y={h - padBottom + 12} textAnchor="middle" fontSize={8.5} fill="#9aa0a6">
          {d.hour}h
        </text>
      ))}
      {hourly.map((d, i) => (
        <rect
          key={d.hour}
          x={xFor(i)}
          y={yFor(d.count)}
          width={barW}
          height={Math.max(0, baseY - yFor(d.count))}
          rx={1.5}
          fill={hover === i ? '#68140b' : '#cf4a35'}
          onMouseEnter={() => setHover(i)}
        />
      ))}
      {hover !== null && (
        <ChartTooltip
          x={xFor(hover) + barW / 2}
          chartWidth={w}
          label={`${String(hourly[hover].hour).padStart(2, '0')}:00 - ${String(hourly[hover].hour).padStart(2, '0')}:59`}
          lines={[{ label: 'Reproducciones', color: '#cf4a35', value: hourly[hover].count }]}
        />
      )}
    </svg>
  );
}

function PlaysTodayWidget() {
  const [data, setData] = useState<PlaysToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiClient.getAdminPlaysToday()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error al cargar'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="rounded-admin-card border border-admin-border bg-admin-surface shadow-admin-card p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="font-display text-sm font-bold text-admin-text">Reproducciones hoy</p>
          <p className="text-admin-text-tertiary text-xs mt-0.5">
            Por hora (Madrid) — vídeos con progreso registrado, no cada pulsación de play
          </p>
        </div>
        {data && (
          <p className="font-display text-[1.75rem] font-bold text-admin-text leading-none shrink-0">
            {data.total.toLocaleString('es-ES')}
          </p>
        )}
      </div>

      {loading ? (
        <div className="h-36 animate-pulse bg-admin-border-soft rounded" />
      ) : error || !data ? (
        <p className="text-admin-text-tertiary text-sm py-6 text-center">{error || 'Sin datos'}</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5">
          <HourlyBarChart hourly={data.hourly} />
          <div>
            <p className="text-[11px] font-semibold text-admin-text-muted uppercase tracking-wide mb-2">Detalle de hoy</p>
            {data.recent.length === 0 ? (
              <p className="text-admin-text-tertiary text-sm text-center py-8">Todavía no hay reproducciones hoy.</p>
            ) : (
              <ul className="divide-y divide-admin-border-soft max-h-[200px] overflow-y-auto">
                {data.recent.map((r, i) => (
                  <li key={i} className="py-1.5 flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="text-admin-text truncate">{r.title}</p>
                      <p className="text-admin-text-tertiary text-xs truncate">{r.name || r.email}</p>
                    </div>
                    <span className="shrink-0 text-admin-text-secondary text-xs tabular-nums">{fmtHourTime(r.watchedAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
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
        <h1 className="font-display text-[22px] font-bold text-admin-text">Dashboard</h1>
        <p className="text-admin-text-secondary text-sm mt-0.5">Resumen del estado de la plataforma</p>
      </div>

      {error && (
        <div className="bg-[#fdecea] border border-[#f7cfc9] rounded-md px-4 py-3 text-[#c0392b] text-sm flex items-center gap-2">
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
              sub="Igual que la pestaña «Activos» de Suscriptores"
              accent
              href="/admin/suscriptores?tab=active"
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
              href="/admin/videos?published=publicado"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
              }
            />
            <MetricCard
              label="Vídeos programados"
              value={stats.scheduledVideos.toLocaleString('es-ES')}
              sub="Publicación programada a futuro"
              href="/admin/videos?published=programado"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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

      {/* Reproducciones de hoy */}
      <PlaysTodayWidget />

      {/* Miembros, pagos e inicios de sesión recientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        <RecentMembersWidget />
        <RecentPaymentsWidget />
        <LoginHistoryWidget />
      </div>

      {/* Nota pie */}
      {!loading && !error && (
        <p className="text-admin-text-tertiary text-xs">
          El MRR es una estimación basada en 9,99 €/mes y 7,50 €/mes equivalente para suscripciones anuales.
          Para datos precisos, consulta el dashboard de Stripe.
        </p>
      )}
    </div>
  );
}
