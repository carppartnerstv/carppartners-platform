'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '@carp-partners/api-client';
import { Pagination } from '@carp-partners/ui';
import type { AdminUser, UserStatusCounts } from '@carp-partners/api-client';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

const STATUS_LABELS: Record<string, string> = {
  active:    'Activo',
  trialing:  'Prueba',
  past_due:  'Vencido',
  cancelled: 'Cancelado',
};

const PLAN_LABELS: Record<string, string> = {
  monthly: 'Mensual',
  annual:  'Anual',
};

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-white/30 text-xs">—</span>;
  const label = STATUS_LABELS[status] ?? status;
  const cls = {
    active:    'bg-green-500/15 text-green-400',
    trialing:  'bg-amber-500/15 text-amber-400',
    past_due:  'bg-orange-500/15 text-orange-400',
    cancelled: 'bg-white/8 text-white/40',
  }[status] ?? 'bg-white/8 text-white/40';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

// ─── Pestañas ─────────────────────────────────────────────────────────────────

// 'with_subscription' = usuarios con cualquier suscripción (default)
// ''                  = todos sin filtro (incluye usuarios sin suscripción)
type TabKey = 'with_subscription' | 'active' | 'trialing' | 'past_due' | 'cancelled' | '';

interface Tab {
  key: TabKey;
  label: string;
  countKey: keyof UserStatusCounts | 'with_subscription';
}

const TABS: Tab[] = [
  { key: 'with_subscription', label: 'Con suscripción', countKey: 'with_subscription' },
  { key: 'active',            label: 'Activos',         countKey: 'active' },
  { key: 'trialing',          label: 'En prueba',       countKey: 'trialing' },
  { key: 'past_due',          label: 'Vencidos',        countKey: 'past_due' },
  { key: 'cancelled',         label: 'Cancelados',      countKey: 'cancelled' },
  { key: '',                  label: 'Todos',           countKey: 'total' },
];

const PAGE_SIZE = 25;

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AdminSuscriptoresPage() {
  const [users, setUsers]     = useState<AdminUser[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // Contadores de pestañas — se cargan una vez y no cambian con la búsqueda
  const [counts, setCounts]         = useState<UserStatusCounts | null>(null);
  const [countsLoading, setCountsLoading] = useState(true);

  // Filtros
  const [tab, setTab] = useState<TabKey>('with_subscription'); // default: solo con suscripción
  const [q, setQ]     = useState('');

  // Carga contadores al montar
  useEffect(() => {
    apiClient.getAdminUserStats()
      .then(res => setCounts(res.counts))
      .catch(() => {/* los contadores son UI extra, no bloquean */})
      .finally(() => setCountsLoading(false));
  }, []);

  const load = useCallback(async (p: number, currentTab: TabKey, currentQ: string) => {
    setLoading(true); setError('');
    try {
      const res = await apiClient.getAdminUsers({
        status:  currentTab || undefined,   // '' → sin parámetro → todos
        q:       currentQ   || undefined,
        limit:   PAGE_SIZE,
        offset:  p * PAGE_SIZE,
      });
      setUsers(res.users);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al cargar suscriptores');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(page, tab, q); }, [load, page, tab, q]);

  const handleTab = (t: TabKey) => { setTab(t); setPage(0); };
  const handleQ   = (v: string)  => { setQ(v);  setPage(0); };


  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="font-display text-[22px] font-bold text-white">Suscriptores</h1>
        <p className="text-white/45 text-sm mt-0.5">Usuarios registrados y estado de su suscripción</p>
      </div>

      {/* Pestañas de estado */}
      <div className="flex gap-1 flex-wrap border-b border-white/8 pb-0">
        {TABS.map(t => {
          const active = tab === t.key;
          const count = counts ? counts[t.countKey as keyof UserStatusCounts] : null;
          return (
            <button
              key={t.key}
              onClick={() => handleTab(t.key)}
              className={[
                'px-3.5 py-2 text-[13px] font-medium rounded-t-md transition-all border-b-2 -mb-px',
                active
                  ? 'text-white border-brand-bright bg-white/4'
                  : 'text-white/50 border-transparent hover:text-white/80 hover:bg-white/3',
              ].join(' ')}
            >
              {t.label}
              {' '}
              <span className={[
                'text-[11px] font-semibold',
                active ? 'text-brand-bright' : 'text-white/30',
              ].join(' ')}>
                {countsLoading ? '…' : count != null ? `(${count.toLocaleString('es-ES')})` : ''}
              </span>
            </button>
          );
        })}
      </div>

      {/* Barra de búsqueda + contador */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text" value={q} onChange={e => handleQ(e.target.value)}
          placeholder="Buscar por email o nombre…"
          className="bg-surface-raised border border-white/12 rounded-md px-3 py-2 text-white text-sm
                     placeholder-white/30 focus:outline-none focus:border-brand-bright w-64 transition-colors"
        />
        </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-md px-4 py-3 text-red-400 text-sm">{error}</div>
      )}

      {/* Tabla */}
      <div className="rounded-card border border-white/8 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/4 border-b border-white/8">
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide">Usuario</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide hidden md:table-cell">Plan</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide">Estado</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide hidden lg:table-cell">Fin de período</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide hidden xl:table-cell">Registrado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/6">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-3"><div className="h-4 w-48 rounded bg-white/8" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><div className="h-3 w-16 rounded bg-white/6" /></td>
                  <td className="px-4 py-3"><div className="h-5 w-14 rounded bg-white/8" /></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><div className="h-3 w-24 rounded bg-white/6" /></td>
                  <td className="px-4 py-3 hidden xl:table-cell"><div className="h-3 w-20 rounded bg-white/6" /></td>
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-white/40">
                {q ? 'Sin resultados para esta búsqueda.' : 'Sin usuarios en esta categoría.'}
              </td></tr>
            ) : users.map(u => (
              <tr key={u.id} className="hover:bg-white/3 transition-colors">
                <td className="px-4 py-3">
                  <div>
                    <p className="text-white font-medium text-sm">{u.email}</p>
                    {u.name && <p className="text-white/40 text-xs mt-0.5">{u.name}</p>}
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-white/60 text-xs">
                    {u.plan ? (PLAN_LABELS[u.plan] ?? u.plan) : '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={u.status} />
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-white/50 text-xs tabular-nums">{fmtDate(u.period_end)}</span>
                </td>
                <td className="px-4 py-3 hidden xl:table-cell">
                  <span className="text-white/40 text-xs tabular-nums">{fmtDate(u.created_at)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        total={total} page={page} pageSize={PAGE_SIZE}
        onPageChange={setPage} loading={loading}
      />
    </div>
  );
}
