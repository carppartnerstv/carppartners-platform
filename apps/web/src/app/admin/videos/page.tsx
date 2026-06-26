'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '@carp-partners/api-client';
import type { AdminVideo, AdminVideoInput, Category, Series, CrewMember } from '@carp-partners/api-client';
import { Button, Pagination } from '@carp-partners/ui';
import { AdminModal } from '@/components/admin/AdminModal';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { useToast } from '@/context/ToastContext';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toSlug(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function fmtDuration(s: number) {
  if (!s) return '—';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  return `${m}:${String(sec).padStart(2,'0')}`;
}

// ─── Form vacío ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

const EMPTY: AdminVideoInput = {
  title: '', slug: '', vimeoId: '', description: '',
  durationSec: 0, thumbnailUrl: '', categoryId: '', seriesId: '',
  episodeNum: undefined, published: false, publishedAt: '', crewMemberIds: [],
};

// ─── Helpers de fecha ─────────────────────────────────────────────────────────

// Convierte un timestamp ISO a "YYYY-MM-DDTHH:mm" para datetime-local
function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  // Ajustar a hora local
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

// Formatea una fecha ISO para mostrar en la tabla
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Componentes de la tabla ─────────────────────────────────────────────────

function StatusBadge({ video }: { video: AdminVideo }) {
  const s = video.status;
  if (s === 'publicado') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-green-500/15 text-green-400">
        Publicado
      </span>
    );
  }
  if (s === 'programado') {
    return (
      <span className="inline-flex flex-col items-start gap-0.5">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-400">
          Programado
        </span>
        <span className="text-[10px] text-white/35 px-1">{fmtDate(video.published_at)}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-white/8 text-white/40">
      Borrador
    </span>
  );
}

// ─── Campo de formulario ─────────────────────────────────────────────────────

function Field({ label, error, hint, children }: {
  label: string; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-white/60 uppercase tracking-wide">{label}</label>
      {children}
      {error && <p className="text-red-400 text-xs">{error}</p>}
      {hint && !error && <p className="text-white/35 text-xs">{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text', required }: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      className="w-full bg-surface border border-white/12 rounded-md px-3 py-2 text-white text-sm
                 placeholder-white/25 focus:outline-none focus:border-brand-bright transition-colors"
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full bg-surface border border-white/12 rounded-md px-3 py-2 text-white text-sm
                 placeholder-white/25 focus:outline-none focus:border-brand-bright transition-colors resize-none"
    />
  );
}

function Select({ value, onChange, children, disabled }: { value: string; onChange: (v: string) => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="w-full bg-surface border border-white/12 rounded-md px-3 py-2 text-white text-sm
                 focus:outline-none focus:border-brand-bright transition-colors disabled:opacity-40
                 [&>option]:bg-surface-raised"
    >
      {children}
    </select>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────

export default function AdminVideosPage() {
  const { toast } = useToast();
  const [videos, setVideos]         = useState<AdminVideo[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [crewList, setCrewList]     = useState<CrewMember[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(0);

  // Filtros
  const [q, setQ]                   = useState('');
  const [filterPub, setFilterPub]   = useState<'' | 'true' | 'false'>('');

  // Modal formulario
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState<AdminVideo | null>(null);
  const [form, setForm]             = useState<AdminVideoInput>(EMPTY);
  const [formError, setFormError]   = useState('');
  const [saving, setSaving]         = useState(false);

  // Diálogo de confirmación
  const [pendingDelete, setPendingDelete] = useState<AdminVideo | null>(null);
  const [deleting, setDeleting]           = useState(false);
  const [fetchingVimeo, setFetchingVimeo] = useState(false);

  // Carga los desplegables del formulario una sola vez
  useEffect(() => {
    Promise.all([
      apiClient.getCategories(),
      apiClient.getSeries(),
      apiClient.getAdminCrew(),
    ]).then(([cRes, sRes, crewRes]) => {
      setCategories(cRes.categories);
      setSeriesList(sRes.series);
      setCrewList(crewRes.crew);
    }).catch(() => {/* no bloquea la tabla */});
  }, []);

  // Carga la página de vídeos (re-ejecuta cuando cambian filtros o página)
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const vRes = await apiClient.getAdminVideos({
        q: q || undefined,
        published: filterPub ? filterPub === 'true' : undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setVideos(vRes.videos);
      setTotal(vRes.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al cargar vídeos');
    } finally {
      setLoading(false);
    }
  }, [q, filterPub, page]);

  useEffect(() => { load(); }, [load]);

  // ── Abrir formulario ────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (v: AdminVideo) => {
    setEditing(v);
    setForm({
      title: v.title, slug: v.slug, vimeoId: v.vimeo_id,
      description: v.description ?? '', durationSec: v.duration_sec,
      thumbnailUrl: v.thumbnail_url ?? '', categoryId: v.category_id ?? '',
      seriesId: v.series_id ?? '', episodeNum: v.episode_num ?? undefined,
      published: v.published,
      publishedAt: toDatetimeLocal(v.published_at),
      crewMemberIds: (v.crew ?? []).map(c => c.id),
    });
    setFormError('');
    setShowForm(true);
  };

  // ── Guardar (crear o editar) ────────────────────────────────────────────────

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError('');
    const payload: AdminVideoInput = {
      ...form,
      description: form.description || undefined,
      thumbnailUrl: form.thumbnailUrl || undefined,
      categoryId: form.categoryId || undefined,
      seriesId: form.seriesId || undefined,
      episodeNum: form.episodeNum || undefined,
      // Envía la fecha como ISO si está rellena, o null explícito para borrarla
      publishedAt: form.publishedAt
        ? new Date(form.publishedAt).toISOString()
        : (editing ? null : undefined),
    };
    try {
      if (editing) {
        await apiClient.updateAdminVideo(editing.id, payload);
        toast('success', 'Vídeo actualizado');
      } else {
        await apiClient.createAdminVideo(payload);
        toast('success', 'Vídeo creado');
      }
      setShowForm(false);
      await load();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Error al guardar';
      setFormError(msg);
      toast('error', msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Autorelleno desde Vimeo ────────────────────────────────────────────────

  const fetchVimeoMetadata = async () => {
    const id = form.vimeoId.trim();
    if (!id) return;
    setFetchingVimeo(true); setFormError('');
    try {
      const meta = await apiClient.getVimeoMetadata(id);
      setForm(f => ({
        ...f,
        ...((!f.title || !editing) && meta.title ? { title: meta.title, slug: editing ? f.slug : toSlug(meta.title) } : {}),
        ...(meta.durationSec ? { durationSec: meta.durationSec } : {}),
        ...(meta.thumbnailUrl ? { thumbnailUrl: meta.thumbnailUrl } : {}),
      }));
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'No se pudo conectar con Vimeo');
    } finally {
      setFetchingVimeo(false);
    }
  };

  // ── Toggle publicado ────────────────────────────────────────────────────────

  const togglePublished = async (v: AdminVideo) => {
    try {
      await apiClient.updateAdminVideo(v.id, { published: !v.published });
      await load();
      toast('success', v.published ? 'Vídeo despublicado' : 'Vídeo publicado');
    } catch (e) {
      await load();
      toast('error', e instanceof ApiError ? e.message : 'No se pudo cambiar el estado');
    }
  };

  // ── Eliminar ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await apiClient.deleteAdminVideo(pendingDelete.id);
      toast('success', `"${pendingDelete.title}" eliminado`);
      setPendingDelete(null);
      await load();
    } catch (e) {
      toast('error', e instanceof ApiError ? e.message : 'No se pudo eliminar');
    } finally { setDeleting(false); }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[22px] font-bold text-white">Vídeos</h1>
          <p className="text-white/45 text-sm mt-0.5">Catálogo completo — publicados y borradores</p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreate}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo vídeo
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text" value={q}
          onChange={e => { setQ(e.target.value); setPage(0); }}
          placeholder="Buscar por título…"
          className="bg-surface-raised border border-white/12 rounded-md px-3 py-2 text-white text-sm
                     placeholder-white/30 focus:outline-none focus:border-brand-bright w-64 transition-colors"
        />
        <select
          value={filterPub}
          onChange={e => { setFilterPub(e.target.value as '' | 'true' | 'false'); setPage(0); }}
          className="bg-surface-raised border border-white/12 rounded-md px-3 py-2 text-white text-sm
                     focus:outline-none focus:border-brand-bright [&>option]:bg-surface-raised"
        >
          <option value="">Todos</option>
          <option value="true">Publicados</option>
          <option value="false">Borradores</option>
        </select>
      </div>

      {/* Error global */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-md px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Tabla */}
      <div className="rounded-card border border-white/8 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/4 border-b border-white/8">
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide">Vídeo</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide hidden md:table-cell">Categoría</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide hidden lg:table-cell">Duración</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide hidden xl:table-cell">Crew</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide">Estado</th>
              <th className="px-4 py-3 w-28" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/6">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-white/40">Cargando…</td></tr>
            ) : videos.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-white/40">No hay vídeos</td></tr>
            ) : videos.map(v => (
              <tr key={v.id} className="hover:bg-white/3 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {v.thumbnail_url ? (
                      <img src={v.thumbnail_url} alt="" className="w-14 aspect-video rounded object-cover bg-surface-raised shrink-0" />
                    ) : (
                      <div className="w-14 aspect-video rounded bg-surface-raised shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate max-w-[220px]">{v.title}</p>
                      <p className="text-white/40 text-xs mt-0.5 font-mono truncate max-w-[220px]">{v.vimeo_id}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-white/60 text-xs">{v.category_name ?? '—'}</span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-white/60 text-xs tabular-nums">{fmtDuration(v.duration_sec)}</span>
                </td>
                <td className="px-4 py-3 hidden xl:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {(v.crew ?? []).slice(0, 3).map(c => (
                      <span key={c.id} className="text-[10px] bg-white/8 text-white/50 px-1.5 py-0.5 rounded">
                        {c.name.split(' ')[0]}
                      </span>
                    ))}
                    {(v.crew ?? []).length > 3 && (
                      <span className="text-[10px] text-white/30">+{v.crew.length - 3}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => togglePublished(v)} className="cursor-pointer text-left">
                    <StatusBadge video={v} />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => openEdit(v)}
                      className="p-1.5 rounded text-white/50 hover:text-white hover:bg-white/8 transition-colors"
                      title="Editar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setPendingDelete(v)}
                      className="p-1.5 rounded text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Eliminar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
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

      {/* ── Modal formulario ── */}
      <AdminModal
        title={editing ? 'Editar vídeo' : 'Nuevo vídeo'}
        open={showForm}
        onClose={() => setShowForm(false)}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Título *">
            <Input
              value={form.title}
              onChange={v => setForm(f => ({ ...f, title: v, slug: editing ? f.slug : toSlug(v) }))}
              placeholder="El título del vídeo"
              required
            />
          </Field>
          <Field label="Slug *" hint="Solo a-z, 0-9, guiones. Se genera solo.">
            <Input
              value={form.slug}
              onChange={v => setForm(f => ({ ...f, slug: v }))}
              placeholder="el-titulo-del-video"
              required
            />
          </Field>
          <Field label="Vimeo ID *" hint="El ID numérico del vídeo ya subido a Vimeo.">
            <div className="flex gap-2">
              <input
                type="text"
                value={form.vimeoId}
                onChange={e => setForm(f => ({ ...f, vimeoId: e.target.value }))}
                placeholder="123456789"
                required
                className="flex-1 bg-surface border border-white/12 rounded-md px-3 py-2 text-white text-sm
                           placeholder-white/25 focus:outline-none focus:border-brand-bright transition-colors"
              />
              <button
                type="button"
                onClick={fetchVimeoMetadata}
                disabled={!form.vimeoId.trim() || fetchingVimeo}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold
                           bg-white/8 border border-white/12 text-white/70 hover:text-white hover:bg-white/14
                           disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Traer título, miniatura y duración desde Vimeo"
              >
                {fetchingVimeo ? (
                  <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
                {fetchingVimeo ? 'Cargando…' : 'Traer datos'}
              </button>
            </div>
          </Field>
          <Field label="Descripción">
            <Textarea
              value={form.description ?? ''}
              onChange={v => setForm(f => ({ ...f, description: v }))}
              placeholder="Descripción opcional…"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Duración (seg)">
              <Input
                type="number"
                value={form.durationSec ?? 0}
                onChange={v => setForm(f => ({ ...f, durationSec: parseInt(v) || 0 }))}
                placeholder="0"
              />
            </Field>
            <Field label="Nº Episodio">
              <Input
                type="number"
                value={form.episodeNum ?? ''}
                onChange={v => setForm(f => ({ ...f, episodeNum: v ? parseInt(v) : undefined }))}
                placeholder="—"
              />
            </Field>
          </div>
          <Field label="Miniatura URL">
            <Input
              value={form.thumbnailUrl ?? ''}
              onChange={v => setForm(f => ({ ...f, thumbnailUrl: v }))}
              placeholder="https://…"
            />
          </Field>
          <Field label="Categoría">
            <Select
              value={form.categoryId ?? ''}
              onChange={v => setForm(f => ({ ...f, categoryId: v }))}
            >
              <option value="">— Sin categoría —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Serie">
            <Select
              value={form.seriesId ?? ''}
              onChange={v => setForm(f => ({ ...f, seriesId: v }))}
            >
              <option value="">— Sin serie —</option>
              {seriesList.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </Select>
          </Field>
          <Field label="Crew" hint="Personas que aparecen en este vídeo. Ctrl/Cmd + clic para selección múltiple.">
            <select
              multiple
              size={Math.min(crewList.length || 4, 6)}
              value={form.crewMemberIds ?? []}
              onChange={e => {
                const selected = Array.from(e.target.selectedOptions).map(o => o.value);
                setForm(f => ({ ...f, crewMemberIds: selected }));
              }}
              className="w-full bg-surface border border-white/12 rounded-md px-2 py-1 text-white text-sm
                         focus:outline-none focus:border-brand-bright [&>option]:px-2 [&>option]:py-1
                         [&>option]:bg-surface [&>option:checked]:bg-brand/40 [&>option:checked]:text-white"
            >
              {crewList.map(m => (
                <option key={m.id} value={m.id}>
                  {m.role === 'socio' ? '★ ' : ''}{m.name}
                </option>
              ))}
            </select>
            {(form.crewMemberIds ?? []).length > 0 && (
              <p className="text-white/40 text-xs mt-1">
                {(form.crewMemberIds ?? []).length} seleccionado(s) ·{' '}
                <button type="button" onClick={() => setForm(f => ({ ...f, crewMemberIds: [] }))}
                  className="text-brand-bright hover:underline">Limpiar</button>
              </p>
            )}
          </Field>
          <Field
            label="Fecha de publicación"
            hint={
              form.published && !form.publishedAt
                ? 'Vacío + Publicado = visible inmediatamente.'
                : form.publishedAt && new Date(form.publishedAt) > new Date()
                ? 'Programado: el vídeo se publicará en la fecha indicada.'
                : 'Deja vacío para publicar de inmediato al marcar "Publicado".'
            }
          >
            <input
              type="datetime-local"
              value={form.publishedAt ?? ''}
              onChange={e => setForm(f => ({ ...f, publishedAt: e.target.value }))}
              className="w-full bg-surface border border-white/12 rounded-md px-3 py-2 text-white text-sm
                         focus:outline-none focus:border-brand-bright transition-colors
                         [color-scheme:dark]"
            />
          </Field>
          <div className="flex items-center gap-3 pt-1">
            <input
              id="pub" type="checkbox" checked={form.published ?? false}
              onChange={e => setForm(f => ({ ...f, published: e.target.checked }))}
              className="w-4 h-4 accent-brand-bright cursor-pointer"
            />
            <label htmlFor="pub" className="text-sm text-white/80 cursor-pointer select-none">
              Publicado
            </label>
          </div>
          {formError && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
              {formError}
            </p>
          )}
          <div className="flex gap-3 pt-2 border-t border-white/8">
            <Button type="submit" variant="primary" size="md" loading={saving} className="flex-1 justify-center">
              {editing ? 'Guardar cambios' : 'Crear vídeo'}
            </Button>
            <Button type="button" variant="ghost" size="md" onClick={() => setShowForm(false)} disabled={saving}>
              Cancelar
            </Button>
          </div>
        </form>
      </AdminModal>

      {/* ── Confirmación borrado ── */}
      <ConfirmDialog
        open={!!pendingDelete}
        title="¿Despublicar vídeo?"
        message={`"${pendingDelete?.title}" se pondrá en borrador y dejará de ser visible para los suscriptores.`}
        confirmLabel="Despublicar"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
        loading={deleting}
      />
    </div>
  );
}
