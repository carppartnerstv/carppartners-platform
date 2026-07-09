'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '@carp-partners/api-client';
import type { AdminSeries, SeriesInput, Category } from '@carp-partners/api-client';
import { Button, Pagination } from '@carp-partners/ui';
import { AdminModal } from '@/components/admin/AdminModal';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
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
      <label className="block text-xs font-medium text-white/60 uppercase tracking-wide">{label}</label>
      {children}
      {error && <p className="text-red-400 text-xs">{error}</p>}
      {hint && !error && <p className="text-white/35 text-xs">{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text', required }: {
  value: string | number; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required}
      className="w-full bg-surface border border-white/12 rounded-md px-3 py-2 text-white text-sm
                 placeholder-white/25 focus:outline-none focus:border-brand-bright transition-colors"
    />
  );
}

function Select({ value, onChange, children, disabled }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <select
      value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
      className="w-full bg-surface border border-white/12 rounded-md px-3 py-2 text-white text-sm
                 focus:outline-none focus:border-brand-bright transition-colors [&>option]:bg-surface-raised
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

  // Portada: archivo pendiente de subir + preview local + estado de subida/borrado
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview]         = useState<string | null>(null);
  const [coverUploading, setCoverUploading]     = useState(false);

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
    setFormError(''); resetCoverState(); setShowForm(true);
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

  const renderRow = (s: AdminSeries, isChild: boolean) => (
    <tr key={s.id} className={`hover:bg-white/3 transition-colors ${isChild ? 'bg-white/[0.015]' : ''}`}>
      <td className="px-4 py-3">
        <div className={`flex items-center gap-3 ${isChild ? 'pl-7' : ''}`}>
          {isChild && <span className="text-white/25 text-sm shrink-0">↳</span>}
          {s.cover_url ? (
            <img src={s.cover_url} alt="" className="w-9 h-9 rounded object-cover bg-surface-raised shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded bg-surface-raised shrink-0 flex items-center justify-center text-white/20">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          )}
          <div>
            <p className="text-white font-medium">{s.title}</p>
            <p className="text-white/35 text-xs font-mono">{s.slug}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <span className="text-white/60 text-xs">{catName(s.category_id)}</span>
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        {!isChild && s.season_count > 0 ? (
          <span className="text-white/60 text-xs">{s.season_count} temporada{s.season_count === 1 ? '' : 's'}</span>
        ) : (
          <span className="text-white/60 text-xs">{s.season_num != null ? `T${s.season_num}` : '—'}</span>
        )}
      </td>
      <td className="px-4 py-3 text-right hidden lg:table-cell">
        <span className="text-white/40 text-xs tabular-nums">{s.video_count}</span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-white/40 text-xs tabular-nums">{s.order_index}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          {!isChild && (
            <button onClick={() => openAddSeason(s)}
              className="p-1.5 rounded text-white/50 hover:text-white hover:bg-white/8 transition-colors" title="Añadir temporada">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
            </button>
          )}
          <button onClick={() => openEdit(s)}
            className="p-1.5 rounded text-white/50 hover:text-white hover:bg-white/8 transition-colors" title="Editar">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button onClick={() => setPendingDelete(s)}
            className="p-1.5 rounded text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Eliminar">
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
          <h1 className="font-display text-[22px] font-bold text-white">Series</h1>
          <p className="text-white/45 text-sm mt-0.5">Colecciones de episodios por temporada</p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreate}>
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
          className="bg-surface-raised border border-white/12 rounded-md px-3 py-2 text-white text-sm
                     focus:outline-none focus:border-brand-bright [&>option]:bg-surface-raised"
        >
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}
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
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide">Serie</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide hidden md:table-cell">Categoría</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide hidden lg:table-cell">Temporada</th>
              <th className="text-right px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide hidden lg:table-cell">Eps.</th>
              <th className="text-right px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide w-10">Orden</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/6">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-white/40">Cargando…</td></tr>
            ) : topLevel.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-white/40">No hay series</td></tr>
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
        total={topLevel.length} page={page} pageSize={PAGE_SIZE}
        onPageChange={setPage} loading={loading}
      />

      {/* Modal */}
      <AdminModal title={editing ? 'Editar serie' : 'Nueva serie'} open={showForm} onClose={() => setShowForm(false)}>
        <form onSubmit={handleSave} className="space-y-4">
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
          <Field label="Portada">
            <AvatarUploader
              shape="cover"
              currentUrl={form.coverUrl || null}
              pendingPreview={coverPreview}
              uploading={coverUploading}
              onFileSelect={handleCoverFileSelect}
              onDelete={editing ? handleDeleteCover : undefined}
            />
          </Field>
          <Field label="Orden" hint="Menor número = aparece antes.">
            <Input type="number" value={form.orderIndex ?? 0} onChange={v => setForm(f => ({ ...f, orderIndex: parseInt(v) || 0 }))} placeholder="0" />
          </Field>
          {formError && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{formError}</p>
          )}
          <div className="flex gap-3 pt-2 border-t border-white/8">
            <Button type="submit" variant="primary" size="md" loading={saving} className="flex-1 justify-center">
              {editing ? 'Guardar cambios' : 'Crear serie'}
            </Button>
            <Button type="button" variant="ghost" size="md" onClick={() => setShowForm(false)} disabled={saving}>
              Cancelar
            </Button>
          </div>
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
