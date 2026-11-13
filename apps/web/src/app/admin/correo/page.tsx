'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient, ApiError } from '@carp-partners/api-client';
import type { AdminMailFolder, AdminMailMessageSummary, AdminMailMessage } from '@carp-partners/api-client';
import { Button, Pagination } from '@carp-partners/ui';
import { useToast } from '@/context/ToastContext';

const PAGE_SIZE = 30;

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// Cuerpo del email en un <iframe sandbox> — no un div con
// dangerouslySetInnerHTML: un email real trae su propio CSS/maquetación
// (a veces tablas enteras con estilos inline agresivos) que si se pintara
// directo en la página podría desbordar o pisar el resto del panel. El
// sandbox sin "allow-scripts" garantiza además que nada de JS del correo
// se ejecute nunca, por mucho que algo se colara en el saneado del backend.
function MailBodyFrame({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(200);

  const handleLoad = () => {
    const doc = ref.current?.contentDocument;
    if (doc?.body) setHeight(Math.min(Math.max(doc.body.scrollHeight + 20, 120), 2000));
  };

  const srcDoc = `<!doctype html><html><head><base target="_blank"><meta name="color-scheme" content="light"><style>
    body { margin: 0; padding: 12px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 14px; color: #1a1a1a; word-wrap: break-word; }
    img { max-width: 100%; }
  </style></head><body>${html}</body></html>`;

  return (
    <iframe
      ref={ref}
      sandbox="allow-same-origin allow-popups"
      srcDoc={srcDoc}
      onLoad={handleLoad}
      className="w-full border border-admin-border-soft rounded-md bg-white"
      style={{ height }}
      title="Cuerpo del mensaje"
    />
  );
}

export default function AdminMailPage() {
  const { toast } = useToast();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [folders, setFolders] = useState<AdminMailFolder[]>([]);
  const [folder, setFolder] = useState('INBOX');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [q, setQ] = useState('');
  const [qInput, setQInput] = useState('');
  const [page, setPage] = useState(0);

  const [messages, setMessages] = useState<AdminMailMessageSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState('');

  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [detail, setDetail] = useState<AdminMailMessage | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    apiClient.getAdminMailStatus()
      .then((r) => setConfigured(r.configured))
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    if (configured) {
      apiClient.getAdminMailFolders().then((r) => setFolders(r.folders)).catch(() => {});
    }
  }, [configured]);

  const loadMessages = useCallback(async () => {
    setLoadingList(true); setListError('');
    try {
      const res = await apiClient.getAdminMailMessages({
        folder, limit: PAGE_SIZE, offset: page * PAGE_SIZE, q: q || undefined, unreadOnly,
      });
      setMessages(res.messages);
      setTotal(res.total);
    } catch (e) {
      setListError(e instanceof ApiError ? e.message : 'No se pudo cargar el correo');
    } finally {
      setLoadingList(false);
    }
  }, [folder, page, q, unreadOnly]);

  useEffect(() => {
    if (configured) loadMessages();
  }, [configured, loadMessages]);

  const openMessage = async (m: AdminMailMessageSummary) => {
    setSelectedUid(m.uid);
    setDetail(null);
    setDetailError('');
    setReplyText('');
    setLoadingDetail(true);
    try {
      const { message } = await apiClient.getAdminMailMessage(m.uid, folder);
      setDetail(message);
      if (!m.seen) {
        apiClient.setAdminMailSeen(m.uid, true, folder).catch(() => {});
        setMessages((prev) => prev.map((x) => (x.uid === m.uid ? { ...x, seen: true } : x)));
      }
    } catch (e) {
      setDetailError(e instanceof ApiError ? e.message : 'No se pudo cargar el mensaje');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleReply = async () => {
    if (!selectedUid || !replyText.trim() || sendingReply) return;
    setSendingReply(true);
    try {
      await apiClient.replyAdminMail(selectedUid, replyText.trim(), folder);
      toast('success', 'Respuesta enviada');
      setReplyText('');
    } catch (e) {
      toast('error', e instanceof ApiError ? e.message : 'No se pudo enviar la respuesta');
    } finally {
      setSendingReply(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    setQ(qInput.trim());
  };

  if (configured === null) {
    return <div className="p-6 text-admin-text-tertiary text-sm">Cargando…</div>;
  }

  if (!configured) {
    return (
      <div className="p-6">
        <h1 className="font-display text-[22px] font-bold text-admin-text mb-2">Correo</h1>
        <div className="bg-[#fdecea] border border-[#f7cfc9] rounded-md px-4 py-3 text-[#c0392b] text-sm max-w-xl">
          El buzón no está configurado todavía — faltan las variables <code>IMAP_HOST</code>/<code>IMAP_USER</code>/<code>IMAP_PASS</code> en el backend.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-4">
        <h1 className="font-display text-[22px] font-bold text-admin-text">Correo</h1>
        <p className="text-admin-text-secondary text-sm mt-0.5">Buzón real, en vivo — sin pasar por un cliente de correo aparte</p>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
        {/* ─── Lista ─── */}
        <div className="flex flex-col rounded-admin-card border border-admin-border bg-admin-surface shadow-admin-card overflow-hidden">
          <div className="p-3 border-b border-admin-border space-y-2.5">
            <select
              value={folder}
              onChange={(e) => { setFolder(e.target.value); setPage(0); setSelectedUid(null); setDetail(null); }}
              className="w-full rounded-md border border-admin-input-border bg-admin-bg text-admin-text text-sm px-2.5 py-1.5"
            >
              <option value="INBOX">Bandeja de entrada</option>
              {folders.filter((f) => f.path !== 'INBOX').map((f) => (
                <option key={f.path} value={f.path}>{f.name}</option>
              ))}
            </select>
            <form onSubmit={handleSearchSubmit} className="flex gap-1.5">
              <input
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="Buscar remitente o asunto…"
                className="flex-1 min-w-0 rounded-md border border-admin-input-border bg-admin-bg text-admin-text text-sm px-2.5 py-1.5"
              />
              <Button theme="light" variant="ghost" size="sm" type="submit">Buscar</Button>
            </form>
            <label className="flex items-center gap-1.5 text-xs text-admin-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => { setUnreadOnly(e.target.checked); setPage(0); }}
                className="accent-brand-bright"
              />
              Solo no leídos
            </label>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-admin-border-soft">
            {listError ? (
              <p className="text-[#c0392b] text-xs p-4">{listError}</p>
            ) : loadingList ? (
              <p className="text-admin-text-tertiary text-xs p-4 text-center">Cargando…</p>
            ) : messages.length === 0 ? (
              <p className="text-admin-text-tertiary text-xs p-4 text-center">Sin mensajes.</p>
            ) : messages.map((m) => (
              <button
                key={m.uid}
                onClick={() => openMessage(m)}
                className={[
                  'w-full text-left px-3.5 py-2.5 transition-colors hover:bg-admin-hover',
                  selectedUid === m.uid ? 'bg-admin-hover' : '',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-[13px] truncate ${m.seen ? 'text-admin-text-secondary' : 'text-admin-text font-semibold'}`}>
                    {m.from ?? m.fromAddress ?? '(desconocido)'}
                  </p>
                  {!m.seen && <span className="w-2 h-2 rounded-full bg-brand-bright shrink-0" />}
                </div>
                <p className={`text-[12.5px] truncate mt-0.5 ${m.seen ? 'text-admin-text-tertiary' : 'text-admin-text'}`}>{m.subject}</p>
                <p className="text-admin-text-muted text-[11px] mt-0.5 tabular-nums">{fmtDate(m.date)}</p>
              </button>
            ))}
          </div>

          <div className="border-t border-admin-border p-2">
            <Pagination theme="light" total={total} page={page} pageSize={PAGE_SIZE} onPageChange={setPage} loading={loadingList} />
          </div>
        </div>

        {/* ─── Detalle ─── */}
        <div className="rounded-admin-card border border-admin-border bg-admin-surface shadow-admin-card overflow-y-auto p-5">
          {!selectedUid ? (
            <p className="text-admin-text-tertiary text-sm text-center py-10">Selecciona un mensaje de la lista.</p>
          ) : loadingDetail ? (
            <p className="text-admin-text-tertiary text-sm text-center py-10">Cargando…</p>
          ) : detailError ? (
            <p className="text-[#c0392b] text-sm">{detailError}</p>
          ) : detail ? (
            <div className="space-y-4">
              <div>
                <p className="text-admin-text font-semibold text-[16px]">{detail.subject}</p>
                <p className="text-admin-text-secondary text-[13px] mt-1">
                  De: {detail.from ?? detail.fromAddress ?? '—'}
                </p>
                {detail.to && <p className="text-admin-text-tertiary text-[12.5px]">Para: {detail.to}</p>}
                <p className="text-admin-text-tertiary text-[12px] mt-0.5 tabular-nums">{fmtDate(detail.date)}</p>
              </div>

              {detail.attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {detail.attachments.map((a, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-[11.5px] px-2 py-1 rounded-md bg-admin-bg border border-admin-border-soft text-admin-text-secondary">
                      <i className="ti ti-paperclip text-[13px]" />
                      {a.filename ?? 'adjunto'}
                    </span>
                  ))}
                </div>
              )}

              {detail.html ? (
                <MailBodyFrame html={detail.html} />
              ) : (
                <p className="text-admin-text text-sm whitespace-pre-wrap leading-relaxed">{detail.text || '(sin contenido)'}</p>
              )}

              <div className="pt-3 border-t border-admin-border-soft">
                <p className="text-xs font-medium text-admin-text-secondary uppercase tracking-wide mb-1.5">Responder</p>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={5}
                  placeholder="Escribe tu respuesta…"
                  className="w-full rounded-md border border-admin-input-border bg-admin-bg text-admin-text text-sm p-3 resize-y focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                />
                <div className="flex justify-end mt-2">
                  <Button
                    theme="light"
                    variant="primary"
                    size="md"
                    loading={sendingReply}
                    disabled={!replyText.trim()}
                    onClick={handleReply}
                  >
                    Enviar respuesta
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
