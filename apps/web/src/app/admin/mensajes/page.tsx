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
        <h1 className="font-display text-[22px] font-bold text-white">Mensajes de contacto</h1>
        <p className="text-white/45 text-sm mt-0.5">Consultas recibidas desde el formulario público de /contacto</p>
      </div>

      <div className="flex gap-1 border-b border-white/8 pb-0">
        {[{ key: false, label: 'Todos' }, { key: true, label: `No leídos${unread ? ` (${unread})` : ''}` }].map(t => (
          <button
            key={String(t.key)}
            onClick={() => { setOnlyUnread(t.key); setPage(0); }}
            className={[
              'px-3.5 py-2 text-[13px] font-medium rounded-t-md transition-all border-b-2 -mb-px',
              onlyUnread === t.key
                ? 'text-white border-brand-bright bg-white/4'
                : 'text-white/50 border-transparent hover:text-white/80 hover:bg-white/3',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-md px-4 py-3 text-red-400 text-sm">{error}</div>
      )}

      <div className="rounded-card border border-white/8 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/4 border-b border-white/8">
              <th className="w-8 px-4 py-3" />
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide">Remitente</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide">Asunto</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide hidden md:table-cell">Fecha</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/6">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-white/40">Cargando…</td></tr>
            ) : messages.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-white/40">
                {onlyUnread ? 'No hay mensajes sin leer.' : 'Todavía no hay mensajes de contacto.'}
              </td></tr>
            ) : messages.map(m => (
              <tr
                key={m.id}
                onClick={() => openMessage(m)}
                className="hover:bg-white/3 transition-colors cursor-pointer"
              >
                <td className="px-4 py-3">
                  {!m.read_at && <span className="block w-2 h-2 rounded-full bg-brand-bright" />}
                </td>
                <td className="px-4 py-3">
                  <p className={`text-sm ${m.read_at ? 'text-white/70' : 'text-white font-semibold'}`}>{m.name}</p>
                  <p className="text-white/35 text-xs">{m.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={m.read_at ? 'text-white/50' : 'text-white/85'}>{m.subject || '—'}</span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-white/40 text-xs tabular-nums">{fmtDate(m.created_at)}</span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); setPendingDelete(m); }}
                    className="p-1.5 rounded text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
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
        total={total} page={page} pageSize={PAGE_SIZE}
        onPageChange={setPage} loading={loading}
      />

      {/* Detalle del mensaje */}
      <AdminModal title="Mensaje de contacto" open={!!viewing} onClose={() => setViewing(null)}>
        {viewing && (
          <div className="space-y-5">
            <div>
              <p className="text-white font-semibold text-[15px]">{viewing.name}</p>
              <p className="text-white/50 text-sm">{viewing.email}</p>
              <p className="text-white/35 text-xs mt-1">{fmtDate(viewing.created_at)}</p>
            </div>
            {viewing.subject && (
              <div>
                <p className="text-xs font-medium text-white/50 uppercase tracking-wide mb-1">Asunto</p>
                <p className="text-white/85 text-sm">{viewing.subject}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-white/50 uppercase tracking-wide mb-1">Mensaje</p>
              <p className="text-white/80 text-sm whitespace-pre-wrap leading-relaxed">{viewing.message}</p>
            </div>
            <div className="flex gap-3 pt-3 border-t border-white/8">
              <Button variant="ghost" size="md" onClick={() => toggleRead(viewing)}>
                Marcar como {viewing.read_at ? 'no leído' : 'leído'}
              </Button>
              <Button variant="ghost" size="md" onClick={() => setPendingDelete(viewing)}>
                Eliminar
              </Button>
              <a href={`mailto:${viewing.email}`} className="ml-auto">
                <Button variant="primary" size="md">Responder por email</Button>
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
