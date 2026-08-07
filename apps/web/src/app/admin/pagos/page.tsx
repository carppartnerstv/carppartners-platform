'use client';

import React, { useState, useEffect } from 'react';
import { apiClient, ApiError } from '@carp-partners/api-client';
import type { Payment } from '@carp-partners/api-client';
import { Pagination } from '@carp-partners/ui';

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
    succeeded:       'bg-[#e7f6ed] text-[#1a8a4a]',
    pending:         'bg-[#fef3e2] text-[#b45309]',
    failed:          'bg-[#fdecea] text-[#c0392b]',
    requires_action: 'bg-[#fdeee0] text-[#c2650a]',
  }[status] ?? 'bg-admin-border-soft text-admin-text-muted';
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
          <h1 className="font-display text-[22px] font-bold text-admin-text">Pagos</h1>
          <p className="text-admin-text-secondary text-sm mt-0.5">Historial de transacciones de Stripe</p>
        </div>
        {!loading && !error && payments.length > 0 && (
          <div className="text-right">
            <p className="text-xs text-admin-text-muted">Total cobrado (visible)</p>
            <p className="font-display text-lg font-bold text-admin-text">
              {fmtAmount(totalCobrado, payments[0]?.currency ?? 'eur')}
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-[#fdecea] border border-[#f7cfc9] rounded-md px-4 py-3 text-[#c0392b] text-sm space-y-1">
          <p className="font-semibold flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            {error}
          </p>
          {stripeError && (
            <p className="text-[#c0392b]/70 text-xs pl-6">
              Comprueba que <code className="bg-[#fbe2df] px-1 rounded">STRIPE_SECRET_KEY</code> está
              configurada en el servidor.
            </p>
          )}
        </div>
      )}

      {/* Tabla */}
      <div className="rounded-admin-card border border-admin-border overflow-hidden bg-admin-surface shadow-admin-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-admin-thead border-b border-admin-border">
              <th className="text-left px-4 py-3 text-admin-text-muted font-medium text-xs uppercase tracking-wide">Fecha</th>
              <th className="text-left px-4 py-3 text-admin-text-muted font-medium text-xs uppercase tracking-wide hidden md:table-cell">Email</th>
              <th className="text-right px-4 py-3 text-admin-text-muted font-medium text-xs uppercase tracking-wide">Importe</th>
              <th className="text-left px-4 py-3 text-admin-text-muted font-medium text-xs uppercase tracking-wide">Estado</th>
              <th className="text-left px-4 py-3 text-admin-text-muted font-medium text-xs uppercase tracking-wide hidden sm:table-cell">Reembolso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-border-soft">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-admin-text-tertiary">Cargando…</td></tr>
            ) : error && payments.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-admin-text-tertiary">
                No se pudieron cargar los pagos.
              </td></tr>
            ) : payments.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-admin-text-tertiary">
                No hay transacciones todavía.
              </td></tr>
            ) : payments.map(p => (
              <tr key={p.id} className="hover:bg-admin-hover transition-colors">
                <td className="px-4 py-3">
                  <span className="text-admin-text-secondary text-xs tabular-nums">{fmtDate(p.created)}</span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-admin-text-secondary text-sm">{p.email ?? '—'}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={[
                    'font-semibold tabular-nums text-sm',
                    p.status === 'succeeded' ? 'text-admin-text' : 'text-admin-text-muted',
                  ].join(' ')}>
                    {fmtAmount(p.amount, p.currency)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <PaymentStatusBadge status={p.status} />
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  {p.refunded ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#fdecea] text-[#c0392b]">
                      Reembolsado
                    </span>
                  ) : (
                    <span className="text-admin-text-tertiary text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        theme="light"
        total={payments.length}
        page={0}
        pageSize={Math.max(payments.length, 1)}
        onPageChange={() => {}}
        loading={loading}
      />
      {!loading && !error && (
        <p className="text-admin-text-tertiary text-xs">
          Mostrando los últimos pagos. Para el historial completo, accede al dashboard de Stripe.
        </p>
      )}
    </div>
  );
}
