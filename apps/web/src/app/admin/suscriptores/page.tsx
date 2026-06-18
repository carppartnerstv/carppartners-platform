'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '@carp-partners/api-client';
import type { AdminUser } from '@carp-partners/api-client';

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

const PAGE_SIZE = 25;

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AdminSuscriptoresPage() {
  const [users, setUsers]     = useState<AdminUser[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [q, setQ]             = useState('');
  const [status, setStatus]   = useState('');

  const load = useCallback(async (p: number, currentQ: string, currentStatus: string) => {
    setLoading(true); setError('');
    try {
      const res = await apiClient.getAdminUsers({
        q: currentQ || undefined,
        status: currentStatus || undefined,
        limit: PAGE_SIZE,
        offset: p * PAGE_SIZE,
      });
      setUsers(res.users);
      // El endpoint devuelve limit y offset pero no total; estimamos si hay más
      setTotal(p * PAGE_SIZE + res.users.length + (res.users.length === PAGE_SIZE ? 1 : 0));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al cargar suscriptores');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(page, q, status); }, [load, page, q, status]);

  // Resetea a página 0 cuando cambian los filtros
  const handleQ = (v: string)      => { setQ(v);      setPage(0); };
  const handleStatus = (v: string) => { setStatus(v); setPage(0); };

  const hasPrev = page > 0;
  const hasNext = users.length === PAGE_SIZE;

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="font-display text-[22px] font-bold text-white">Suscriptores</h1>
        <p className="text-white/45 text-sm mt-0.5">Usuarios registrados y estado de su suscripción</p>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text" value={q} onChange={e => handleQ(e.target.value)}
          placeholder="Buscar por email o nombre…"
          className="bg-surface-raised border border-white/12 rounded-md px-3 py-2 text-white text-sm
                     placeholder-white/30 focus:outline-none focus:border-brand-bright w-64 transition-colors"
        />
        <select
          value={status} onChange={e => handleStatus(e.target.value)}
          className="bg-surface-raised border border-white/12 rounded-md px-3 py-2 text-white text-sm
                     focus:outline-none focus:border-brand-bright [&>option]:bg-surface-raised"
        >
          <option value="">Todos los estados</option>
          <option value="active">Activo</option>
          <option value="trialing">Prueba</option>
          <option value="past_due">Vencido</option>
          <option value="cancelled">Cancelado</option>
        </select>
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
              <tr><td colSpan={5} className="px-4 py-10 text-center text-white/40">Cargando…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-white/40">
                {q || status ? 'Sin resultados para estos filtros.' : 'No hay usuarios todavía.'}
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

      {/* Paginación */}
      {!loading && (hasPrev || hasNext) && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPage(p => p - 1)}
            disabled={!hasPrev}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold
                       bg-white/8 border border-white/12 text-white/70 hover:text-white hover:bg-white/14
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Anterior
          </button>
          <span className="text-white/40 text-xs">Página {page + 1}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={!hasNext}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold
                       bg-white/8 border border-white/12 text-white/70 hover:text-white hover:bg-white/14
                       disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Siguiente
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
