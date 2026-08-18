'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '@carp-partners/api-client';
import type { AdminSeries, SeriesInput, Category } from '@carp-partners/api-client';
import { Button, Pagination } from '@carp-partners/ui';
import { AdminModal } from '@/components/admin/AdminModal';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { ContentIndicator, hasContent } from '@/components/admin/ContentIndicator';
import { RichTextEditor } from '@/components/admin/RichTextEditor';
import { AvatarUploader } from '@/components/AvatarUploader';
import { useToast } from '@/context/ToastContext';

function toSlug(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const PAGE_SIZE = 25;
const EMPTY: SeriesInput = {
  title: '', slug: '', description: '', categoryId: '', seasonNum: 1,
  coverUrl: '', orderIndex: 0, parentSeriesId: null,
};

function Field({ label, hint, error, children }: {
  label: string; hint?: string; error?: string; children: React.ReactNode;
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
  value: string | number; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required}
      className="w-full bg-white border border-admin-input-border rounded-md px-3 py-2 text-admin-text text-sm
                 placeholder-admin-text-tertiary focus:outline-none focus:border-brand-bright transition-colors"
    />
  );
}

function Select({ value, onChange, children, disabled }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <select
      value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
      className="w-full bg-white border border-admin-input-border rounded-md px-3 py-2 text-admin-text text-sm
                 focus:outline-none focus:border-brand-bright transition-colors [&>option]:bg-white
                 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {children}
    </select>
  );
}

export default function AdminSeriesPage() {
  const { toast } = useToast();
  const [items, setItems]         = useState<AdminSeries[]>([]);
  const [page, setPage]           = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<AdminSeries | null>(null);
  const [form, setForm]           = useState<SeriesInput>(EMPTY);
  const [formError, setFormError] = useState('');
  const [saving, setSaving]       = useState(false);

  const [pendingDelete, setPendingDelete] = useState<AdminSeries | null>(null);
  const [deleting, setDeleting]           = useState(false);

  // Portada horizontal: archivo pendiente de subir + preview local + estado de subida/borrado
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview]         = useState<string | null>(null);
  const [coverUploading, setCoverUploading]     = useState(false);

  // Portada vertical (2:3) — mismo patrón, campo independiente
  const [pendingCoverVerticalFile, setPendingCoverVerticalFile] = useState<File | null>(null);
  const [coverVerticalPreview, setCoverVerticalPreview]         = useState<string | null>(null);
  const [coverVerticalUploading, setCoverVerticalUploading]     = useState(false);
  const [coverVerticalUrl, setCoverVerticalUrl]                 = useState<string | null>(null);

  // Filter by category
  const [filterCat, setFilterCat] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [sRes, cRes] = await Promise.all([
        apiClient.getAdminSeries(filterCat ? { category: filterCat } : undefined),
        apiClient.getCategories(),
      ]);
      setItems(sRes.series);
      setCategories(cRes.categories);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al cargar series');
    } finally { setLoading(false); }
  }, [filterCat]);

  useEffect(() => { load(); }, [load]);

  // Serie de primer nivel = sin serie madre. Sus temporadas (hijas) se
  // muestran anidadas justo debajo, sin paginarse aparte.
  const topLevel = items.filter(s => !s.parent_series_id);
  const childrenOf = (id: string) => items.filter(s => s.parent_series_id === id);
  // Una serie solo puede ser "serie madre" si a su vez no tiene madre.
  const parentOptions = items.filter(s => !s.parent_series_id && s.id !== editing?.id);
  const editingHasSeasons = !!editing && editing.season_count > 0;

  const resetCoverState = () => {
    setPendingCoverFile(null);
    setCoverPreview(null);
    setPendingCoverVerticalFile(null);
    setCoverVerticalPreview(null);
    setCoverVerticalUrl(null);
  };

  const openCreate = () => {
    setEditing(null); setForm(EMPTY); setFormError(''); resetCoverState(); setShowForm(true);
  };

  const openEdit = (s: AdminSeries) => {
    setEditing(s);
    setForm({
      title: s.title, slug: s.slug, description: s.description ?? '',
      categoryId: s.category_id ?? '', seasonNum: s.season_num ?? 1,
      coverUrl: s.cover_url ?? '', orderIndex: s.order_index,
      parentSeriesId: s.parent_series_id ?? null,
    });
    setFormError(''); resetCoverState(); setCoverVerticalUrl(s.cover_vertical_url ?? null); setShowForm(true);
  };

  const openAddSeason = (parent: AdminSeries) => {
    setEditing(null);
    setForm({
      ...EMPTY, categoryId: parent.category_id ?? '', parentSeriesId: parent.id,
      seasonNum: (parent.season_count ?? 0) + 1,
    });
    setFormError(''); resetCoverState(); setShowForm(true);
  };

  const handleCoverFileSelect = (file: File) => {
    setPendingCoverFile(file);
    // Genera preview local con URL de objeto (se libera al cerrar el modal)
    const url = URL.createObjectURL(file);
    setCoverPreview(url);
  };

  const handleDeleteCover = async () => {
    if (!editing) return;
    setCoverUploading(true);
    try {
      await apiClient.deleteSeriesCover(editing.id);
      toast('success', 'Portada eliminada');
      setForm(f => ({ ...f, coverUrl: '' }));
      resetCoverState();
      await load();
    } catch (e) {
      toast('error', e instanceof ApiError ? e.message : 'No se pudo eliminar la portada');
    } finally { setCoverUploading(false); }
  };

  const handleCoverVerticalFileSelect = (file: File) => {
    setPendingCoverVerticalFile(file);
    const url = URL.createObjectURL(file);
    setCoverVerticalPreview(url);
  };

  const handleDeleteCoverVertical = async () => {
    if (!editing) return;
    setCoverVerticalUploading(true);
    try {
      await apiClient.deleteSeriesCoverVertical(editing.id);
      toast('success', 'Portada vertical eliminada');
      setCoverVerticalUrl(null);
      setPendingCoverVerticalFile(null);
      setCoverVerticalPreview(null);
      await load();
    } catch (e) {
      toast('error', e instanceof ApiError ? e.message : 'No se pudo eliminar la portada vertical');
    } finally { setCoverVerticalUploading(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError('');
    const payload: SeriesInput = {
      ...form,
      description: form.description || undefined,
      categoryId: form.categoryId || undefined,
      coverUrl: form.coverUrl || undefined,
      // parentSeriesId SÍ se envía explícitamente como null (a diferencia de
      // los campos de arriba) para poder desasignar la serie madre al editar.
      parentSeriesId: form.parentSeriesId || null,
    };
    try {
      let savedId: string;
      if (editing) {
        await apiClient.updateAdminSeries(editing.id, payload);
        savedId = editing.id;
      } else {
        const { series } = await apiClient.createAdminSeries(payload);
        savedId = series.id;
      }

      // Si el usuario seleccionó una portada, la subimos ahora que tenemos el ID
      if (pendingCoverFile) {
        setCoverUploading(true);
        try {
          await apiClient.uploadSeriesCover(savedId, pendingCoverFile);
        } catch (uploadErr) {
          const msg = uploadErr instanceof ApiError ? uploadErr.message : 'Error al subir la portada';
          toast('error', msg);
        } finally { setCoverUploading(false); }
      }

      if (pendingCoverVerticalFile) {
        setCoverVerticalUploading(true);
        try {
          await apiClient.uploadSeriesCoverVertical(savedId, pendingCoverVerticalFile);
        } catch (uploadErr) {
          const msg = uploadErr instanceof ApiError ? uploadErr.message : 'Error al subir la portada vertical';
          toast('error', msg);
        } finally { setCoverVerticalUploading(false); }
      }

      toast('success', editing ? 'Serie actualizada' : 'Serie creada');
      setShowForm(false);
      resetCoverState();
      await load();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Error al guardar';
      setFormError(msg);
      toast('error', msg);
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await apiClient.deleteAdminSeries(pendingDelete.id);
      toast('success', `"${pendingDelete.title}" eliminada`);
      setPendingDelete(null);
      await load();
    } catch (e) {
      toast('error', e instanceof ApiError ? e.message : 'No se pudo eliminar');
    } finally { setDeleting(false); }
  };

  const catName = (id: string | null) =>
    categories.find(c => c.id === id)?.name ?? '—';

  // ── Toggle "Mejores seleccionados para ti" (Home) ──────────────────────────
  // A diferencia del destacado de portada de vídeos, aquí puede haber varias
  // series marcadas a la vez — no hay lógica de "desmarcar las demás". Solo
  // tiene efecto en series de primer nivel: GET /series (curated=true) nunca
  // devuelve temporadas, así que marcar una no haría nada visible.
  const toggleCurated = async (s: AdminSeries) => {
    try {
      await apiClient.updateAdminSeries(s.id, { isCurated: !s.is_curated });
      await load();
      toast('success', s.is_curated ? `"${s.title}" ya no aparece en seleccionados` : `"${s.title}" aparece ahora en "Mejores seleccionados para ti"`);
    } catch (e) {
      toast('error', e instanceof ApiError ? e.message : 'No se pudo cambiar la selección');
    }
  };

  const renderRow = (s: AdminSeries, isChild: boolean) => (
    <tr key={s.id} className={`hover:bg-admin-hover transition-colors ${isChild ? 'bg-admin-thead' : ''}`}>
      <td className="px-4 py-3">
        <div className={`flex items-center gap-3 ${isChild ? 'pl-7' : ''}`}>
          {isChild && <span className="text-admin-text-tertiary text-sm shrink-0">↳</span>}
          {!isChild && (
            <button onClick={() => toggleCurated(s)}
              title={s.is_curated ? 'En "Mejores seleccionados para ti" — pulsa para quitarla' : 'Añadir a "Mejores seleccionados para ti"'}
              className={`shrink-0 p-1 rounded transition-colors ${
                s.is_curated ? 'text-[#cf4a35]' : 'text-admin-text-tertiary hover:text-admin-text-secondary'
              }`}
            >
              <svg className="w-[18px] h-[18px]" fill={s.is_curated ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
          )}
          {s.cover_url ? (
            <img src={s.cover_url} alt="" className="w-9 h-9 rounded object-cover bg-admin-border-soft shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded bg-admin-border-soft shrink-0 flex items-center justify-center text-admin-text-tertiary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          )}
          <div>
            <p className="text-admin-text font-medium">{s.title}</p>
            <p className="text-admin-text-tertiary text-xs font-mono">{s.slug}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <span className="text-admin-text-secondary text-xs">{catName(s.category_id)}</span>
      </td>
      <td className="px-4 py-3 hidden md:table-cell text-center">
        <ContentIndicator filled={hasContent(s.description)} labelFilled="Tiene descripción" labelEmpty="Sin descripción" />
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        {!isChild && s.season_count > 0 ? (
          <span className="text-admin-text-secondary text-xs">{s.season_count} temporada{s.season_count === 1 ? '' : 's'}</span>
        ) : (
          <span className="text-admin-text-secondary text-xs">{s.season_num != null ? `T${s.season_num}` : '—'}</span>
        )}
      </td>
      <td className="px-4 py-3 text-right hidden lg:table-cell">
        <span className="text-admin-text-muted text-xs tabular-nums">{s.video_count}</span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-admin-text-muted text-xs tabular-nums">{s.order_index}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {!isChild && (
            <button onClick={() => openAddSeason(s)}
              className="p-1.5 rounded text-admin-text-secondary hover:text-admin-text hover:bg-admin-hover transition-colors" title="Añadir temporada">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
            </button>
          )}
          <button onClick={() => openEdit(s)}
            className="p-1.5 rounded text-admin-text-secondary hover:text-admin-text hover:bg-admin-hover transition-colors" title="Editar">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button onClick={() => setPendingDelete(s)}
            className="p-1.5 rounded text-admin-text-secondary hover:text-[#c0392b] hover:bg-[#fdecea] transition-colors" title="Eliminar">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[22px] font-bold text-admin-text">Series</h1>
          <p className="text-admin-text-secondary text-sm mt-0.5">Colecciones de episodios por temporada</p>
        </div>
        <Button theme="light" variant="primary" size="sm" onClick={openCreate}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva serie
        </Button>
      </div>

      {/* Filtro por categoría */}
      <div>
        <select
          value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(0); }}
          className="bg-white border border-admin-input-border rounded-md px-3 py-2 text-admin-text text-sm
                     focus:outline-none focus:border-brand-bright [&>option]:bg-white"
        >
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}
        </select>
      </div>

      {error && (
        <div className="bg-[#fdecea] border border-[#f7cfc9] rounded-md px-4 py-3 text-[#c0392b] text-sm">{error}</div>
      )}

      {/* Tabla */}
      <div className="rounded-admin-card border border-admin-border overflow-hidden bg-admin-surface shadow-admin-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-admin-thead border-b border-admin-border">
              <th className="text-left px-4 py-3 text-admin-text-muted font-medium text-xs uppercase tracking-wide">Serie</th>
              <th className="text-left px-4 py-3 text-admin-text-muted font-medium text-xs uppercase tracking-wide hidden md:table-cell">Categoría</th>
              <th className="text-center px-4 py-3 text-admin-text-muted font-medium text-xs uppercase tracking-wide hidden md:table-cell w-16" title="Descripción">Desc.</th>
              <th className="text-left px-4 py-3 text-admin-text-muted font-medium text-xs uppercase tracking-wide hidden lg:table-cell">Temporada</th>
              <th className="text-right px-4 py-3 text-admin-text-muted font-medium text-xs uppercase tracking-wide hidden lg:table-cell">Eps.</th>
              <th className="text-right px-4 py-3 text-admin-text-muted font-medium text-xs uppercase tracking-wide w-10">Orden</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-border-soft">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-admin-text-tertiary">Cargando…</td></tr>
            ) : topLevel.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-admin-text-tertiary">No hay series</td></tr>
            ) : topLevel.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(s => (
              <React.Fragment key={s.id}>
                {renderRow(s, false)}
                {childrenOf(s.id).map(child => renderRow(child, true))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        theme="light"
        total={topLevel.length} page={page} pageSize={PAGE_SIZE}
        onPageChange={setPage} loading={loading}
      />

      {/* Modal */}
      <AdminModal
        theme="light"
        title={editing ? 'Editar serie' : 'Nueva serie'}
        open={showForm}
        onClose={() => setShowForm(false)}
        footer={
          <>
            {formError && (
              <p className="text-[#c0392b] text-sm bg-[#fdecea] border border-[#f7cfc9] rounded px-3 py-2 mb-3">{formError}</p>
            )}
            <div className="flex gap-3">
              <Button theme="light" type="submit" form="series-form" variant="primary" size="md" loading={saving} className="flex-1 justify-center">
                {editing ? 'Guardar cambios' : 'Crear serie'}
              </Button>
              <Button theme="light" type="button" variant="ghost" size="md" onClick={() => setShowForm(false)} disabled={saving}>
                Cancelar
              </Button>
            </div>
          </>
        }
      >
        <form id="series-form" onSubmit={handleSave} className="space-y-4">
          <Field label="Título *">
            <Input
              value={form.title}
              onChange={v => setForm(f => ({ ...f, title: v, slug: editing ? f.slug : toSlug(v) }))}
              placeholder="Temporada en el Ebro"
              required
            />
          </Field>
          <Field label="Slug *" hint="Solo a-z, 0-9, guiones.">
            <Input value={form.slug} onChange={v => setForm(f => ({ ...f, slug: v }))} placeholder="temporada-en-el-ebro" required />
          </Field>
          <Field
            label="Serie madre"
            hint={editingHasSeasons
              ? 'Esta serie ya tiene temporadas propias; no puede convertirse en temporada de otra.'
              : 'Convierte esta serie en una temporada de otra serie (solo un nivel).'}
          >
            <Select
              value={form.parentSeriesId ?? ''}
              onChange={v => setForm(f => ({ ...f, parentSeriesId: v || null }))}
              disabled={editingHasSeasons}
            >
              <option value="">— Ninguna (serie independiente) —</option>
              {parentOptions.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </Select>
          </Field>
          <Field label="Descripción">
            <RichTextEditor value={form.description ?? ''} onChange={v => setForm(f => ({ ...f, description: v }))} placeholder="Descripción opcional…" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoría">
              <Select value={form.categoryId ?? ''} onChange={v => setForm(f => ({ ...f, categoryId: v }))}>
                <option value="">— Sin categoría —</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Temporada nº">
              <Input
                type="number"
                value={form.seasonNum ?? ''}
                onChange={v => setForm(f => ({ ...f, seasonNum: v ? parseInt(v) : undefined }))}
                placeholder="1"
              />
            </Field>
          </div>
          <Field label="Portada horizontal (16:9)" hint="Se usa en escritorio y como respaldo si no hay portada vertical.">
            <AvatarUploader
              light
              shape="cover"
              currentUrl={form.coverUrl || null}
              pendingPreview={coverPreview}
              uploading={coverUploading}
              onFileSelect={handleCoverFileSelect}
              onDelete={editing ? handleDeleteCover : undefined}
            />
          </Field>
          <Field label="Portada vertical (2:3)" hint="Opcional. Se usa en móvil; si no la subes, se usa la horizontal recortada.">
            <AvatarUploader
              light
              shape="poster"
              currentUrl={coverVerticalUrl}
              pendingPreview={coverVerticalPreview}
              uploading={coverVerticalUploading}
              onFileSelect={handleCoverVerticalFileSelect}
              onDelete={editing ? handleDeleteCoverVertical : undefined}
            />
          </Field>
          <Field label="Orden" hint="Menor número = aparece antes.">
            <Input type="number" value={form.orderIndex ?? 0} onChange={v => setForm(f => ({ ...f, orderIndex: parseInt(v) || 0 }))} placeholder="0" />
          </Field>
        </form>
      </AdminModal>

      {/* Confirm */}
      <ConfirmDialog
        open={!!pendingDelete}
        title="¿Eliminar serie?"
        message={`"${pendingDelete?.title}" se eliminará permanentemente. Los vídeos de esta serie perderán su asociación.`}
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
        loading={deleting}
      />
    </div>
  );
}
