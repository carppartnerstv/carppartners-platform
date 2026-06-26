'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '@carp-partners/api-client';
import type { Series, SeriesInput, Category } from '@carp-partners/api-client';
import { Button, Pagination } from '@carp-partners/ui';
import { AdminModal } from '@/components/admin/AdminModal';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { useToast } from '@/context/ToastContext';

function toSlug(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const PAGE_SIZE = 25;
const EMPTY: SeriesInput = { title: '', slug: '', description: '', categoryId: '', seasonNum: 1, coverUrl: '', orderIndex: 0 };

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

function Textarea({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <textarea
      value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3}
      className="w-full bg-surface border border-white/12 rounded-md px-3 py-2 text-white text-sm
                 placeholder-white/25 focus:outline-none focus:border-brand-bright transition-colors resize-none"
    />
  );
}

function Select({ value, onChange, children }: {
  value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <select
      value={value} onChange={e => onChange(e.target.value)}
      className="w-full bg-surface border border-white/12 rounded-md px-3 py-2 text-white text-sm
                 focus:outline-none focus:border-brand-bright transition-colors [&>option]:bg-surface-raised"
    >
      {children}
    </select>
  );
}

export default function AdminSeriesPage() {
  const { toast } = useToast();
  const [items, setItems]         = useState<Series[]>([]);
  const [page, setPage]           = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<Series | null>(null);
  const [form, setForm]           = useState<SeriesInput>(EMPTY);
  const [formError, setFormError] = useState('');
  const [saving, setSaving]       = useState(false);

  const [pendingDelete, setPendingDelete] = useState<Series | null>(null);
  const [deleting, setDeleting]           = useState(false);

  // Filter by category
  const [filterCat, setFilterCat] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [sRes, cRes] = await Promise.all([
        apiClient.getSeries(filterCat ? { category: filterCat } : undefined),
        apiClient.getCategories(),
      ]);
      setItems(sRes.series);
      setCategories(cRes.categories);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al cargar series');
    } finally { setLoading(false); }
  }, [filterCat]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null); setForm(EMPTY); setFormError(''); setShowForm(true);
  };

  const openEdit = (s: Series) => {
    setEditing(s);
    setForm({
      title: s.title, slug: s.slug, description: s.description ?? '',
      categoryId: s.category_id ?? '', seasonNum: s.season_num ?? 1,
      coverUrl: s.cover_url ?? '', orderIndex: s.order_index,
    });
    setFormError(''); setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError('');
    const payload: SeriesInput = {
      ...form,
      description: form.description || undefined,
      categoryId: form.categoryId || undefined,
      coverUrl: form.coverUrl || undefined,
    };
    try {
      if (editing) {
        await apiClient.updateAdminSeries(editing.id, payload);
        toast('success', 'Serie actualizada');
      } else {
        await apiClient.createAdminSeries(payload);
        toast('success', 'Serie creada');
      }
      setShowForm(false);
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
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-white/40">No hay series</td></tr>
            ) : items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(s => (
              <tr key={s.id} className="hover:bg-white/3 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
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
                  <span className="text-white/60 text-xs">
                    {s.season_num != null ? `T${s.season_num}` : '—'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right hidden lg:table-cell">
                  <span className="text-white/40 text-xs tabular-nums">{s.episode_count}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-white/40 text-xs tabular-nums">{s.order_index}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
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
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        total={items.length} page={page} pageSize={PAGE_SIZE}
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
          <Field label="Descripción">
            <Textarea value={form.description ?? ''} onChange={v => setForm(f => ({ ...f, description: v }))} placeholder="Descripción opcional…" />
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
          <Field label="URL Portada">
            <Input value={form.coverUrl ?? ''} onChange={v => setForm(f => ({ ...f, coverUrl: v }))} placeholder="https://…" />
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
