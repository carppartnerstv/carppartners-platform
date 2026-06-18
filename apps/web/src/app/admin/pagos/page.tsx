'use client';

import React, { useState, useEffect } from 'react';
import { apiClient, ApiError } from '@carp-partners/api-client';
import type { Payment } from '@carp-partners/api-client';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string | number) {
  const d = typeof iso === 'number' ? new Date(iso * 1000) : new Date(iso);
  return d.toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtAmount(amount: number, currency: string) {
  return (amount / 100).toLocaleString('es-ES', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  });
}

const STATUS_LABELS: Record<string, string> = {
  succeeded:     'Cobrado',
  pending:       'Pendiente',
  failed:        'Fallido',
  requires_action: 'Requiere acción',
};

function PaymentStatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? status;
  const cls = {
    succeeded:       'bg-green-500/15 text-green-400',
    pending:         'bg-amber-500/15 text-amber-400',
    failed:          'bg-red-500/15 text-red-400',
    requires_action: 'bg-orange-500/15 text-orange-400',
  }[status] ?? 'bg-white/8 text-white/40';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AdminPagosPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [stripeError, setStripeError] = useState(false);

  useEffect(() => {
    apiClient.getAdminPayments()
      .then(res => setPayments(res.payments))
      .catch(e => {
        if (e instanceof ApiError && (e.message.toLowerCase().includes('stripe') || e.code === 'STRIPE_ERROR')) {
          setStripeError(true);
        }
        setError(e instanceof ApiError ? e.message : 'Error al cargar los pagos');
      })
      .finally(() => setLoading(false));
  }, []);

  const totalCobrado = payments
    .filter(p => p.status === 'succeeded' && !p.refunded)
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-[22px] font-bold text-white">Pagos</h1>
          <p className="text-white/45 text-sm mt-0.5">Historial de transacciones de Stripe</p>
        </div>
        {!loading && !error && payments.length > 0 && (
          <div className="text-right">
            <p className="text-xs text-white/40">Total cobrado (visible)</p>
            <p className="font-display text-lg font-bold text-white">
              {fmtAmount(totalCobrado, payments[0]?.currency ?? 'eur')}
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-md px-4 py-3 text-red-400 text-sm space-y-1">
          <p className="font-semibold flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            {error}
          </p>
          {stripeError && (
            <p className="text-red-300/70 text-xs pl-6">
              Comprueba que <code className="bg-red-500/10 px-1 rounded">STRIPE_SECRET_KEY</code> está
              configurada en el servidor.
            </p>
          )}
        </div>
      )}

      {/* Tabla */}
      <div className="rounded-card border border-white/8 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/4 border-b border-white/8">
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide">Fecha</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide hidden md:table-cell">Email</th>
              <th className="text-right px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide">Importe</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide">Estado</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide hidden sm:table-cell">Reembolso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/6">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-white/40">Cargando…</td></tr>
            ) : error && payments.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-white/40">
                No se pudieron cargar los pagos.
              </td></tr>
            ) : payments.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-white/40">
                No hay transacciones todavía.
              </td></tr>
            ) : payments.map(p => (
              <tr key={p.id} className="hover:bg-white/3 transition-colors">
                <td className="px-4 py-3">
                  <span className="text-white/70 text-xs tabular-nums">{fmtDate(p.created)}</span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-white/60 text-sm">{p.email ?? '—'}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={[
                    'font-semibold tabular-nums text-sm',
                    p.status === 'succeeded' ? 'text-white' : 'text-white/40',
                  ].join(' ')}>
                    {fmtAmount(p.amount, p.currency)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <PaymentStatusBadge status={p.status} />
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  {p.refunded ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-red-500/10 text-red-400">
                      Reembolsado
                    </span>
                  ) : (
                    <span className="text-white/20 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading && !error && (
        <p className="text-white/25 text-xs">
          Mostrando los últimos pagos. Para el historial completo y herramientas avanzadas, accede al
          dashboard de Stripe directamente.
        </p>
      )}
    </div>
  );
}
