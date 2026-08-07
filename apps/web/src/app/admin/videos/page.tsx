'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient, ApiError } from '@carp-partners/api-client';
import type { AdminVideo, AdminVideoInput, AdminSeries, CrewMember } from '@carp-partners/api-client';
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
  durationSec: 0, thumbnailUrl: '', seriesId: '',
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

function RatingsCell({ ratings }: { ratings: AdminVideo['ratings'] }) {
  if (!ratings || ratings.total === 0) {
    return <span className="text-admin-text-tertiary text-xs">Sin votos</span>;
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#e7f6ed] text-[#1a8a4a]" title="Me encanta">
        {ratings.love}
      </span>
      <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#fbebe8] text-brand-bright" title="Me gusta">
        {ratings.like}
      </span>
      <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#fdecea] text-[#c0392b]" title="No es para mí">
        {ratings.down}
      </span>
      <span className="text-admin-text-tertiary text-[11px]">({ratings.total})</span>
    </div>
  );
}

function StatusBadge({ video }: { video: AdminVideo }) {
  const s = video.status;
  if (s === 'publicado') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#e7f6ed] text-[#1a8a4a]">
        Publicado
      </span>
    );
  }
  if (s === 'programado') {
    return (
      <span className="inline-flex flex-col items-start gap-0.5">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#fef3e2] text-[#b45309]">
          Programado
        </span>
        <span className="text-[10px] text-admin-text-tertiary px-1">{fmtDate(video.published_at)}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-admin-border-soft text-admin-text-muted">
      Borrador
    </span>
  );
}

// Nº de episodio editable directamente en la columna "Serie" — guarda al
// perder el foco (o Enter), sin abrir el modal. Vacío = borra el episode_num
// (null explícito, distinto de "no tocar").
function EpisodeNumInput({
  video, onSave,
}: {
  video: AdminVideo;
  onSave: (id: string, episodeNum: number | null) => Promise<void>;
}) {
  const [value, setValue] = useState(video.episode_num?.toString() ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(video.episode_num?.toString() ?? '');
  }, [video.episode_num]);

  const commit = async () => {
    const trimmed = value.trim();
    const parsed = trimmed === '' ? null : parseInt(trimmed, 10);
    if (trimmed !== '' && Number.isNaN(parsed as number)) {
      setValue(video.episode_num?.toString() ?? ''); // entrada inválida: revertir
      return;
    }
    if (parsed === (video.episode_num ?? null)) return; // sin cambios reales

    setSaving(true);
    try {
      await onSave(video.id, parsed);
    } catch {
      setValue(video.episode_num?.toString() ?? ''); // falló: revertir visualmente
    } finally {
      setSaving(false);
    }
  };

  return (
    <input
      type="number"
      inputMode="numeric"
      value={value}
      disabled={saving}
      onChange={e => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={e => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') { setValue(video.episode_num?.toString() ?? ''); (e.target as HTMLInputElement).blur(); }
      }}
      onClick={e => e.stopPropagation()}
      placeholder="—"
      title="Nº de episodio — edítalo aquí directamente"
      className="w-11 bg-transparent border border-admin-border rounded px-1 py-0.5 text-admin-text-secondary text-[11px] font-mono
                 focus:outline-none focus:border-brand-bright focus:bg-admin-hover transition-colors disabled:opacity-40
                 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  );
}

// ─── Campo de formulario ─────────────────────────────────────────────────────

function Field({ label, error, hint, children }: {
  label: string; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-admin-text-secondary uppercase tracking-wide">{label}</label>
      {children}
      {error && <p className="text-[#c0392b] text-xs">{error}</p>}
      {hint && !error && <p className="text-admin-text-tertiary text-xs">{hint}</p>}
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
      className="w-full bg-white border border-admin-input-border rounded-md px-3 py-2 text-admin-text text-sm
                 placeholder-admin-text-tertiary focus:outline-none focus:border-brand-bright transition-colors"
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
      className="w-full bg-white border border-admin-input-border rounded-md px-3 py-2 text-admin-text text-sm
                 placeholder-admin-text-tertiary focus:outline-none focus:border-brand-bright transition-colors resize-none"
    />
  );
}

function Select({ value, onChange, children, disabled }: { value: string; onChange: (v: string) => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="w-full bg-white border border-admin-input-border rounded-md px-3 py-2 text-admin-text text-sm
                 focus:outline-none focus:border-brand-bright transition-colors disabled:opacity-40
                 [&>option]:bg-white"
    >
      {children}
    </select>
  );
}

// Selector múltiple de crew en formato dropdown — a diferencia de un
// <select multiple> nativo, no crece en altura según el número de
// miembros: la lista solo ocupa espacio mientras está abierta (overlay con
// scroll propio), y las chips de seleccionados debajo son compactas.
function CrewMultiSelect({ crewList, selectedIds, onChange }: {
  crewList: CrewMember[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) { setQuery(''); searchRef.current?.focus(); }
  }, [open]);

  const selected = crewList.filter(m => selectedIds.includes(m.id));
  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };

  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const filteredCrew = query
    ? crewList.filter(m => normalize(m.name).includes(normalize(query)))
    : crewList;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between bg-white border border-admin-input-border rounded-md
                   px-3 py-2 text-sm focus:outline-none focus:border-brand-bright transition-colors"
      >
        <span className={selected.length ? 'text-admin-text' : 'text-admin-text-tertiary'}>
          {selected.length ? `${selected.length} seleccionado(s)` : 'Seleccionar crew…'}
        </span>
        <svg className={`w-4 h-4 text-admin-text-tertiary transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-admin-border rounded-md shadow-lg py-1">
          <div className="px-2 pb-1.5 sticky top-0 bg-white">
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.stopPropagation()}
              placeholder="Buscar…"
              className="w-full bg-admin-bg border border-admin-input-border rounded px-2.5 py-1.5 text-sm text-admin-text
                         placeholder-admin-text-tertiary focus:outline-none focus:border-brand-bright transition-colors"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {crewList.length === 0 ? (
              <p className="px-3 py-2 text-admin-text-tertiary text-xs">No hay miembros de crew</p>
            ) : filteredCrew.length === 0 ? (
              <p className="px-3 py-2 text-admin-text-tertiary text-xs">Sin resultados para &quot;{query}&quot;</p>
            ) : filteredCrew.map(m => (
              <label key={m.id} className="flex items-center gap-2 px-3 py-1.5 text-sm text-admin-text hover:bg-admin-hover cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(m.id)}
                  onChange={() => toggle(m.id)}
                  className="w-3.5 h-3.5 accent-brand-bright shrink-0"
                />
                {m.role === 'socio' ? '★ ' : ''}{m.name}
              </label>
            ))}
          </div>
        </div>
      )}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map(m => (
            <span key={m.id} className="inline-flex items-center gap-1 text-[11px] bg-admin-border-soft text-admin-text-secondary pl-2 pr-1 py-0.5 rounded">
              {m.name}
              <button type="button" onClick={() => toggle(m.id)} title="Quitar"
                className="w-3.5 h-3.5 flex items-center justify-center rounded-full text-admin-text-tertiary hover:text-[#c0392b] hover:bg-[#fdecea]">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────

export default function AdminVideosPage() {
  const { toast } = useToast();
  const [videos, setVideos]         = useState<AdminVideo[]>([]);
  const [seriesList, setSeriesList] = useState<AdminSeries[]>([]);
  const [crewList, setCrewList]     = useState<CrewMember[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(0);

  // Filtros
  const [q, setQ]                   = useState('');
  const [filterPub, setFilterPub]   = useState<'' | 'true' | 'false'>('');
  const [filterSeries, setFilterSeries] = useState('');
  const [sort, setSort]             = useState<'' | 'rated' | 'series'>('series');

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
      apiClient.getAdminSeries(),
      apiClient.getAdminCrew(),
    ]).then(([sRes, crewRes]) => {
      setSeriesList(sRes.series);
      setCrewList(crewRes.crew);
    }).catch(() => {/* no bloquea la tabla */});
  }, []);

  // Carga la página de vídeos (re-ejecuta cuando cambian filtros o página).
  // silent=true evita el parpadeo de "Cargando…" en toda la tabla — lo usa
  // la edición inline del nº de episodio, que solo cambia una fila.
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const vRes = await apiClient.getAdminVideos({
        q: q || undefined,
        published: filterPub ? filterPub === 'true' : undefined,
        series: filterSeries || undefined,
        sort: sort || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setVideos(vRes.videos);
      setTotal(vRes.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al cargar vídeos');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [q, filterPub, filterSeries, sort, page]);

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
      thumbnailUrl: v.thumbnail_url ?? '',
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
      seriesId: form.seriesId || undefined,
      // Igual que publishedAt: número si lo hay, o null explícito para
      // borrarlo al editar (undefined en creación simplemente no lo manda).
      episodeNum: form.episodeNum || (editing ? null : undefined),
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

  // ── Toggle destacado en portada (hero de Home) ─────────────────────────────
  // Solo puede haber uno activo a la vez; el backend desmarca el anterior.

  const toggleFeatured = async (v: AdminVideo) => {
    try {
      await apiClient.updateAdminVideo(v.id, { isFeatured: !v.is_featured });
      await load();
      toast('success', v.is_featured ? 'Ya no es el destacado de portada' : `"${v.title}" es ahora el destacado de portada`);
    } catch (e) {
      toast('error', e instanceof ApiError ? e.message : 'No se pudo cambiar el destacado');
    }
  };

  // ── Edición inline del nº de episodio (columna "Serie") ────────────────────
  // silent=true en el load(): no queremos que toda la tabla parpadee a
  // "Cargando…" por cambiar un solo campo de una fila.

  const saveEpisodeNum = async (id: string, episodeNum: number | null) => {
    await apiClient.updateAdminVideo(id, { episodeNum });
    await load(true);
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

  // Series asignables a un vídeo: los vídeos viven en series sin temporadas
  // propias (planas o temporadas hijas), nunca en una serie madre que solo
  // agrupa temporadas ("La Picada" a secas no es asignable, sus temporadas sí).
  const assignableSeries = seriesList
    .filter(s => s.season_count === 0)
    .map(s => ({
      id: s.id,
      label: s.parent_series_id ? `${s.parent_title} — Temporada ${s.season_num ?? '?'}` : s.title,
      sortKey: (s.parent_title ?? s.title).toLowerCase(),
      seasonNum: s.season_num ?? 0,
    }))
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.seasonNum - b.seasonNum);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[22px] font-bold text-admin-text">Vídeos</h1>
          <p className="text-admin-text-secondary text-sm mt-0.5">Catálogo completo — publicados y borradores</p>
        </div>
        <Button theme="light" variant="primary" size="sm" onClick={openCreate}>
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
          className="bg-white border border-admin-input-border rounded-md px-3 py-2 text-admin-text text-sm
                     placeholder-admin-text-tertiary focus:outline-none focus:border-brand-bright w-64 transition-colors"
        />
        <select
          value={filterPub}
          onChange={e => { setFilterPub(e.target.value as '' | 'true' | 'false'); setPage(0); }}
          className="bg-white border border-admin-input-border rounded-md px-3 py-2 text-admin-text text-sm
                     focus:outline-none focus:border-brand-bright [&>option]:bg-white"
        >
          <option value="">Todos</option>
          <option value="true">Publicados</option>
          <option value="false">Borradores</option>
        </select>
        <select
          value={filterSeries}
          onChange={e => { setFilterSeries(e.target.value); setPage(0); }}
          className="bg-white border border-admin-input-border rounded-md px-3 py-2 text-admin-text text-sm
                     focus:outline-none focus:border-brand-bright [&>option]:bg-white"
        >
          <option value="">Todas las series</option>
          {assignableSeries.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select
          value={sort}
          onChange={e => { setSort(e.target.value as '' | 'rated' | 'series'); setPage(0); }}
          className="bg-white border border-admin-input-border rounded-md px-3 py-2 text-admin-text text-sm
                     focus:outline-none focus:border-brand-bright [&>option]:bg-white"
        >
          <option value="">Más recientes</option>
          <option value="rated">Más valorados</option>
          <option value="series">Por serie · temporada · episodio</option>
        </select>
      </div>

      {/* Error global */}
      {error && (
        <div className="bg-[#fdecea] border border-[#f7cfc9] rounded-md px-4 py-3 text-[#c0392b] text-sm">
          {error}
        </div>
      )}

      {/* Tabla */}
      <div className="rounded-admin-card border border-admin-border overflow-hidden bg-admin-surface shadow-admin-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-admin-thead border-b border-admin-border">
              <th className="text-left px-4 py-3 text-admin-text-muted font-medium text-xs uppercase tracking-wide">Vídeo</th>
              <th className="text-left px-4 py-3 text-admin-text-muted font-medium text-xs uppercase tracking-wide hidden lg:table-cell">Serie</th>
              <th className="text-left px-4 py-3 text-admin-text-muted font-medium text-xs uppercase tracking-wide hidden md:table-cell">Categoría</th>
              <th className="text-left px-4 py-3 text-admin-text-muted font-medium text-xs uppercase tracking-wide hidden lg:table-cell">Duración</th>
              <th className="text-left px-4 py-3 text-admin-text-muted font-medium text-xs uppercase tracking-wide hidden xl:table-cell">Crew</th>
              <th className="text-left px-4 py-3 text-admin-text-muted font-medium text-xs uppercase tracking-wide hidden md:table-cell">Valoraciones</th>
              <th className="text-left px-4 py-3 text-admin-text-muted font-medium text-xs uppercase tracking-wide">Estado</th>
              <th className="px-4 py-3 w-28" />
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-border-soft">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-admin-text-tertiary">Cargando…</td></tr>
            ) : videos.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-admin-text-tertiary">No hay vídeos</td></tr>
            ) : videos.map(v => (
              <tr key={v.id} className="hover:bg-admin-hover transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleFeatured(v)}
                      title={v.is_featured ? 'Destacado en portada — pulsa para quitarlo' : 'Marcar como destacado en portada'}
                      className={`shrink-0 p-1 rounded transition-colors ${
                        v.is_featured ? 'text-[#b45309]' : 'text-admin-text-tertiary hover:text-admin-text-secondary'
                      }`}
                    >
                      <svg className="w-[18px] h-[18px]" fill={v.is_featured ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </button>
                    {v.thumbnail_url ? (
                      <img src={v.thumbnail_url} alt="" className="w-14 aspect-video rounded object-cover bg-admin-border-soft shrink-0" />
                    ) : (
                      <div className="w-14 aspect-video rounded bg-admin-border-soft shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-admin-text font-medium truncate max-w-[220px]">{v.title}</p>
                      {v.is_featured ? (
                        <p className="text-[#b45309] text-[10px] font-semibold uppercase tracking-wide mt-0.5">Destacado en portada</p>
                      ) : (
                        <p className="text-admin-text-muted text-xs mt-0.5 font-mono truncate max-w-[220px]">{v.vimeo_id}</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  {v.series_id ? (
                    <div className="min-w-0">
                      <p className="text-admin-text-secondary text-xs truncate max-w-[160px]">
                        {v.series_parent_title ?? v.series_title}
                      </p>
                      <p className="text-admin-text-tertiary text-[11px] font-mono mt-0.5 flex items-center gap-1">
                        <span>T{v.season_num ?? 1} · E</span>
                        <EpisodeNumInput video={v} onSave={saveEpisodeNum} />
                      </p>
                    </div>
                  ) : (
                    <span className="text-admin-text-tertiary text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-admin-text-secondary text-xs">{v.category_name ?? '—'}</span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-admin-text-secondary text-xs tabular-nums">{fmtDuration(v.duration_sec)}</span>
                </td>
                <td className="px-4 py-3 hidden xl:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {(v.crew ?? []).slice(0, 3).map(c => (
                      <span key={c.id} className="text-[10px] bg-admin-border-soft text-admin-text-secondary px-1.5 py-0.5 rounded">
                        {c.name.split(' ')[0]}
                      </span>
                    ))}
                    {(v.crew ?? []).length > 3 && (
                      <span className="text-[10px] text-admin-text-tertiary">+{(v.crew ?? []).length - 3}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <RatingsCell ratings={v.ratings} />
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
                      className="p-1.5 rounded text-admin-text-secondary hover:text-admin-text hover:bg-admin-hover transition-colors"
                      title="Editar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setPendingDelete(v)}
                      className="p-1.5 rounded text-admin-text-secondary hover:text-[#c0392b] hover:bg-[#fdecea] transition-colors"
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
        theme="light"
        total={total} page={page} pageSize={PAGE_SIZE}
        onPageChange={setPage} loading={loading}
      />

      {/* ── Modal formulario ── */}
      <AdminModal
        theme="light"
        title={editing ? 'Editar vídeo' : 'Nuevo vídeo'}
        open={showForm}
        onClose={() => setShowForm(false)}
        footer={
          <>
            {formError && (
              <p className="text-[#c0392b] text-sm bg-[#fdecea] border border-[#f7cfc9] rounded px-3 py-2 mb-3">
                {formError}
              </p>
            )}
            <div className="flex gap-3">
              <Button theme="light" type="submit" form="video-form" variant="primary" size="md" loading={saving} className="flex-1 justify-center">
                {editing ? 'Guardar cambios' : 'Crear vídeo'}
              </Button>
              <Button theme="light" type="button" variant="ghost" size="md" onClick={() => setShowForm(false)} disabled={saving}>
                Cancelar
              </Button>
            </div>
          </>
        }
      >
        <form id="video-form" onSubmit={handleSave} className="space-y-4">
          {/* 1. Vimeo ID */}
          <Field label="Vimeo ID *" hint="El ID numérico del vídeo ya subido a Vimeo.">
            <div className="flex gap-2">
              <input
                type="text"
                value={form.vimeoId}
                onChange={e => setForm(f => ({ ...f, vimeoId: e.target.value }))}
                placeholder="123456789"
                required
                className="flex-1 bg-white border border-admin-input-border rounded-md px-3 py-2 text-admin-text text-sm
                           placeholder-admin-text-tertiary focus:outline-none focus:border-brand-bright transition-colors"
              />
              <button
                type="button"
                onClick={fetchVimeoMetadata}
                disabled={!form.vimeoId.trim() || fetchingVimeo}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold
                           bg-admin-bg border border-admin-input-border text-admin-text-secondary hover:text-admin-text hover:bg-admin-hover
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

          {/* 2. Título */}
          <Field label="Título *">
            <Input
              value={form.title}
              onChange={v => setForm(f => ({ ...f, title: v, slug: editing ? f.slug : toSlug(v) }))}
              placeholder="El título del vídeo"
              required
            />
          </Field>

          {/* 3. Slug */}
          <Field label="Slug *" hint="Solo a-z, 0-9, guiones. Se genera solo.">
            <Input
              value={form.slug}
              onChange={v => setForm(f => ({ ...f, slug: v }))}
              placeholder="el-titulo-del-video"
              required
            />
          </Field>

          {/* 4. Descripción */}
          <Field label="Descripción">
            <Textarea
              value={form.description ?? ''}
              onChange={v => setForm(f => ({ ...f, description: v }))}
              placeholder="Descripción opcional…"
            />
          </Field>

          {/* 5. Fecha de publicación */}
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
              className="w-full bg-white border border-admin-input-border rounded-md px-3 py-2 text-admin-text text-sm
                         focus:outline-none focus:border-brand-bright transition-colors
                         [color-scheme:light]"
            />
          </Field>

          {/* 6. Serie + nº episodio, en la misma fila (80% / 20%). La duración
              no se muestra: se sigue guardando (autorrelleno desde Vimeo),
              simplemente no hace falta editarla a mano. La categoría la
              lleva la serie, no el vídeo (ver /admin/series). */}
          <div className="grid grid-cols-5 gap-3">
            <div className="col-span-4">
              <Field label="Serie" hint="Las series con varias temporadas muestran cada temporada por separado; el vídeo va a la temporada, no a la serie madre.">
                <Select
                  value={form.seriesId ?? ''}
                  onChange={v => setForm(f => ({ ...f, seriesId: v }))}
                >
                  <option value="">— Sin serie —</option>
                  {assignableSeries.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Nº Episodio">
              <Input
                type="number"
                value={form.episodeNum ?? ''}
                onChange={v => setForm(f => ({ ...f, episodeNum: v ? parseInt(v) : undefined }))}
                placeholder="—"
              />
            </Field>
          </div>

          {/* 8. Crew */}
          <Field label="Crew" hint="Personas que aparecen en este vídeo.">
            <CrewMultiSelect
              crewList={crewList}
              selectedIds={form.crewMemberIds ?? []}
              onChange={ids => setForm(f => ({ ...f, crewMemberIds: ids }))}
            />
          </Field>

          {/* 9. Miniatura URL */}
          <Field label="Miniatura URL">
            <Input
              value={form.thumbnailUrl ?? ''}
              onChange={v => setForm(f => ({ ...f, thumbnailUrl: v }))}
              placeholder="https://…"
            />
          </Field>

          {/* 10. Publicado */}
          <div className="flex items-center gap-3 pt-1">
            <input
              id="pub" type="checkbox" checked={form.published ?? false}
              onChange={e => setForm(f => ({ ...f, published: e.target.checked }))}
              className="w-4 h-4 accent-brand-bright cursor-pointer"
            />
            <label htmlFor="pub" className="text-sm text-admin-text cursor-pointer select-none">
              Publicado
            </label>
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
