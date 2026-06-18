'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '@carp-partners/api-client';
import type { Category, CategoryInput } from '@carp-partners/api-client';
import { Button } from '@carp-partners/ui';
import { AdminModal } from '@/components/admin/AdminModal';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';

function toSlug(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const EMPTY: CategoryInput = { name: '', slug: '', description: '', coverUrl: '', orderIndex: 0 };

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

export default function AdminCategoriasPage() {
  const [items, setItems]       = useState<Category[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<Category | null>(null);
  const [form, setForm]         = useState<CategoryInput>(EMPTY);
  const [formError, setFormError] = useState('');
  const [saving, setSaving]     = useState(false);

  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);
  const [deleting, setDeleting]           = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await apiClient.getCategories();
      setItems(res.categories);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al cargar categorías');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null); setForm(EMPTY); setFormError(''); setShowForm(true);
  };

  const openEdit = (c: Category) => {
    setEditing(c);
    setForm({ name: c.name, slug: c.slug, description: c.description ?? '', coverUrl: c.cover_url ?? '', orderIndex: c.order_index });
    setFormError(''); setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError('');
    const payload: CategoryInput = {
      ...form,
      description: form.description || undefined,
      coverUrl: form.coverUrl || undefined,
    };
    try {
      if (editing) {
        await apiClient.updateAdminCategory(editing.id, payload);
      } else {
        await apiClient.createAdminCategory(payload);
      }
      setShowForm(false);
      await load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Error al guardar');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await apiClient.deleteAdminCategory(pendingDelete.id);
      setPendingDelete(null);
      await load();
    } catch { } finally { setDeleting(false); }
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[22px] font-bold text-white">Categorías</h1>
          <p className="text-white/45 text-sm mt-0.5">Organiza el catálogo por tipo de contenido</p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreate}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva categoría
        </Button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-md px-4 py-3 text-red-400 text-sm">{error}</div>
      )}

      {/* Tabla */}
      <div className="rounded-card border border-white/8 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/4 border-b border-white/8">
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide">Nombre</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide hidden md:table-cell">Slug</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide hidden lg:table-cell">Descripción</th>
              <th className="text-right px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide w-10">Orden</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/6">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-white/40">Cargando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-white/40">No hay categorías</td></tr>
            ) : items.map(c => (
              <tr key={c.id} className="hover:bg-white/3 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {c.cover_url ? (
                      <img src={c.cover_url} alt="" className="w-9 h-9 rounded object-cover bg-surface-raised shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded bg-surface-raised shrink-0 flex items-center justify-center text-white/20">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-5 5a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 10V5a2 2 0 012-2z" />
                        </svg>
                      </div>
                    )}
                    <span className="text-white font-medium">{c.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-white/40 text-xs font-mono">{c.slug}</span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-white/50 text-xs line-clamp-1">{c.description ?? '—'}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-white/40 text-xs tabular-nums">{c.order_index}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(c)}
                      className="p-1.5 rounded text-white/50 hover:text-white hover:bg-white/8 transition-colors" title="Editar">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => setPendingDelete(c)}
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

      {/* Modal */}
      <AdminModal title={editing ? 'Editar categoría' : 'Nueva categoría'} open={showForm} onClose={() => setShowForm(false)}>
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Nombre *">
            <Input value={form.name} onChange={v => setForm(f => ({ ...f, name: v, slug: editing ? f.slug : toSlug(v) }))} placeholder="Carpfishing en Río" required />
          </Field>
          <Field label="Slug *" hint="Solo a-z, 0-9, guiones.">
            <Input value={form.slug} onChange={v => setForm(f => ({ ...f, slug: v }))} placeholder="carpfishing-en-rio" required />
          </Field>
          <Field label="Descripción">
            <Textarea value={form.description ?? ''} onChange={v => setForm(f => ({ ...f, description: v }))} placeholder="Descripción opcional…" />
          </Field>
          <Field label="URL Portada">
            <Input value={form.coverUrl ?? ''} onChange={v => setForm(f => ({ ...f, coverUrl: v }))} placeholder="https://…" />
          </Field>
          <Field label="Orden" hint="Posición en el menú. Menor número = primero.">
            <Input type="number" value={form.orderIndex ?? 0} onChange={v => setForm(f => ({ ...f, orderIndex: parseInt(v) || 0 }))} placeholder="0" />
          </Field>
          {formError && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{formError}</p>
          )}
          <div className="flex gap-3 pt-2 border-t border-white/8">
            <Button type="submit" variant="primary" size="md" loading={saving} className="flex-1 justify-center">
              {editing ? 'Guardar cambios' : 'Crear categoría'}
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
        title="¿Eliminar categoría?"
        message={`"${pendingDelete?.name}" se eliminará permanentemente. Los vídeos asociados perderán su categoría.`}
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
        loading={deleting}
      />
    </div>
  );
}
