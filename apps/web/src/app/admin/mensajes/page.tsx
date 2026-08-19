'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '@carp-partners/api-client';
import type { ContactMessage } from '@carp-partners/api-client';
import { Button, Pagination } from '@carp-partners/ui';
import { AdminModal } from '@/components/admin/AdminModal';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { useToast } from '@/context/ToastContext';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const PAGE_SIZE = 25;

export default function AdminContactMessagesPage() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [total, setTotal]       = useState(0);
  const [unread, setUnread]     = useState(0);
  const [page, setPage]         = useState(0);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const [viewing, setViewing]   = useState<ContactMessage | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ContactMessage | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (p: number, unreadOnly: boolean) => {
    setLoading(true); setError('');
    try {
      const res = await apiClient.getAdminContactMessages({
        read: unreadOnly ? false : undefined,
        limit: PAGE_SIZE,
        offset: p * PAGE_SIZE,
      });
      setMessages(res.messages);
      setTotal(res.total);
      setUnread(res.unread);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al cargar los mensajes');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(page, onlyUnread); }, [load, page, onlyUnread]);

  const openMessage = async (m: ContactMessage) => {
    setViewing(m);
    if (!m.read_at) {
      try {
        await apiClient.markContactMessageRead(m.id, true);
        setMessages(prev => prev.map(x => x.id === m.id ? { ...x, read_at: new Date().toISOString() } : x));
        setUnread(u => Math.max(0, u - 1));
      } catch {
        /* no crítico: se puede reintentar marcando manualmente */
      }
    }
  };

  const toggleRead = async (m: ContactMessage) => {
    const nextRead = !m.read_at;
    try {
      const { message } = await apiClient.markContactMessageRead(m.id, nextRead);
      setMessages(prev => prev.map(x => x.id === m.id ? message : x));
      setUnread(u => nextRead ? Math.max(0, u - 1) : u + 1);
      setViewing(message);
    } catch (e) {
      toast('error', e instanceof ApiError ? e.message : 'No se pudo actualizar');
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await apiClient.deleteAdminContactMessage(pendingDelete.id);
      toast('success', 'Mensaje eliminado');
      setPendingDelete(null);
      setViewing(null);
      await load(page, onlyUnread);
    } catch (e) {
      toast('error', e instanceof ApiError ? e.message : 'No se pudo eliminar');
    } finally { setDeleting(false); }
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="font-display text-[22px] font-bold text-admin-text">Mensajes de contacto</h1>
        <p className="text-admin-text-secondary text-sm mt-0.5">Consultas recibidas desde el formulario público de /contacto</p>
      </div>

      <div className="flex gap-1 border-b border-admin-border pb-0">
        {[{ key: false, label: 'Todos' }, { key: true, label: `No leídos${unread ? ` (${unread})` : ''}` }].map(t => (
          <button
            key={String(t.key)}
            onClick={() => { setOnlyUnread(t.key); setPage(0); }}
            className={[
              'px-3.5 py-2 text-[13px] font-medium rounded-t-md transition-all border-b-2 -mb-px',
              onlyUnread === t.key
                ? 'text-admin-text border-brand-bright bg-admin-thead'
                : 'text-admin-text-secondary border-transparent hover:text-admin-text hover:bg-admin-hover',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-[#fdecea] border border-[#f7cfc9] rounded-md px-4 py-3 text-[#c0392b] text-sm">{error}</div>
      )}

      <div className="rounded-admin-card border border-admin-border overflow-hidden bg-admin-surface shadow-admin-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-admin-thead border-b border-admin-border">
              <th className="w-8 px-4 py-3" />
              <th className="text-left px-4 py-3 text-admin-text-muted font-medium text-xs uppercase tracking-wide">Remitente</th>
              <th className="text-left px-4 py-3 text-admin-text-muted font-medium text-xs uppercase tracking-wide">Asunto</th>
              <th className="text-left px-4 py-3 text-admin-text-muted font-medium text-xs uppercase tracking-wide hidden md:table-cell">Fecha</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-border-soft">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-admin-text-tertiary">Cargando…</td></tr>
            ) : messages.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-admin-text-tertiary">
                {onlyUnread ? 'No hay mensajes sin leer.' : 'Todavía no hay mensajes de contacto.'}
              </td></tr>
            ) : messages.map(m => (
              <tr
                key={m.id}
                onClick={() => openMessage(m)}
                className="hover:bg-admin-hover transition-colors cursor-pointer"
              >
                <td className="px-4 py-3">
                  {!m.read_at && <span className="block w-2 h-2 rounded-full bg-brand-bright" />}
                </td>
                <td className="px-4 py-3">
                  <p className={`text-sm ${m.read_at ? 'text-admin-text-secondary' : 'text-admin-text font-semibold'}`}>{m.name}</p>
                  <p className="text-admin-text-tertiary text-xs">{m.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={m.read_at ? 'text-admin-text-secondary' : 'text-admin-text'}>{m.subject || '—'}</span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-admin-text-muted text-xs tabular-nums">{fmtDate(m.created_at)}</span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); setPendingDelete(m); }}
                    className="p-1.5 rounded text-admin-text-secondary hover:text-[#c0392b] hover:bg-[#fdecea] transition-colors"
                    title="Eliminar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        theme="light"
        total={total} page={page} pageSize={PAGE_SIZE}
        onPageChange={setPage} loading={loading}
      />

      {/* Detalle del mensaje */}
      <AdminModal theme="light" title="Mensaje de contacto" open={!!viewing} onClose={() => setViewing(null)}>
        {viewing && (
          <div className="space-y-5">
            <div>
              <p className="text-admin-text font-semibold text-[15px]">{viewing.name}</p>
              <p className="text-admin-text-secondary text-sm">{viewing.email}</p>
              <p className="text-admin-text-tertiary text-xs mt-1">{fmtDate(viewing.created_at)}</p>
            </div>
            {viewing.subject && (
              <div>
                <p className="text-xs font-medium text-admin-text-secondary uppercase tracking-wide mb-1">Asunto</p>
                <p className="text-admin-text text-sm">{viewing.subject}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-admin-text-secondary uppercase tracking-wide mb-1">Mensaje</p>
              <p className="text-admin-text text-sm whitespace-pre-wrap leading-relaxed">{viewing.message}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-admin-text-secondary uppercase tracking-wide mb-1">Comunicaciones</p>
              <p className="text-admin-text text-sm">
                {viewing.marketing_opt_in ? 'Acepta recibir información de actividades, servicios y productos' : 'No ha aceptado recibir comunicaciones'}
              </p>
            </div>
            <div className="flex gap-3 pt-3 border-t border-admin-border-soft">
              <Button theme="light" variant="ghost" size="md" onClick={() => toggleRead(viewing)}>
                Marcar como {viewing.read_at ? 'no leído' : 'leído'}
              </Button>
              <Button theme="light" variant="ghost" size="md" onClick={() => setPendingDelete(viewing)}>
                Eliminar
              </Button>
              <a href={`mailto:${viewing.email}`} className="ml-auto">
                <Button theme="light" variant="primary" size="md">Responder por email</Button>
              </a>
            </div>
          </div>
        )}
      </AdminModal>

      <ConfirmDialog
        open={!!pendingDelete}
        title="¿Eliminar mensaje?"
        message={`El mensaje de "${pendingDelete?.name}" se eliminará permanentemente.`}
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
        loading={deleting}
      />
    </div>
  );
}
