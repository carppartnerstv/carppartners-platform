'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '@carp-partners/api-client';
import type { AdminPageSummary, AdminPage, PageInput } from '@carp-partners/api-client';
import { Button } from '@carp-partners/ui';
import { AdminModal } from '@/components/admin/AdminModal';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { RichTextEditor } from '@/components/admin/RichTextEditor';
import { AvatarUploader } from '@/components/AvatarUploader';
import { useToast } from '@/context/ToastContext';

function toSlug(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

const EMPTY: PageInput = { slug: '', title: '', content: '', metaTitle: '', metaDescription: '' };

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-white/60 uppercase tracking-wide">{label}</label>
      {children}
      {hint && <p className="text-white/35 text-xs">{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, placeholder, required, readOnly }: {
  value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; readOnly?: boolean;
}) {
  return (
    <input
      type="text" value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} required={required} readOnly={readOnly}
      className={`w-full bg-surface border border-white/12 rounded-md px-3 py-2 text-white text-sm
                 placeholder-white/25 focus:outline-none focus:border-brand-bright transition-colors
                 ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
    />
  );
}

export default function AdminPagesPage() {
  const { toast } = useToast();
  const [items, setItems]     = useState<AdminPageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [showForm, setShowForm]   = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null); // null = creando
  const [form, setForm]           = useState<PageInput>(EMPTY);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving]       = useState(false);

  const [pendingDelete, setPendingDelete] = useState<AdminPageSummary | null>(null);
  const [deleting, setDeleting]           = useState(false);

  // Imagen social: archivo pendiente de subir + preview local + estado de subida/borrado
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview]         = useState<string | null>(null);
  const [imageUploading, setImageUploading]     = useState(false);
  const [currentOgImage, setCurrentOgImage]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { pages } = await apiClient.getAdminPages();
      setItems(pages);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al cargar las páginas');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetImageState = () => {
    setPendingImageFile(null);
    setImagePreview(null);
  };

  const openCreate = () => {
    setEditingSlug(null); setForm(EMPTY); setFormError(''); setCurrentOgImage(null);
    resetImageState(); setShowForm(true);
  };

  const openEdit = async (summary: AdminPageSummary) => {
    setEditingSlug(summary.slug); setFormError(''); resetImageState(); setShowForm(true);
    setFormLoading(true);
    try {
      const { page } = await apiClient.getAdminPage(summary.slug);
      setForm({
        slug: page.slug, title: page.title, content: page.content ?? '',
        metaTitle: page.meta_title ?? '', metaDescription: page.meta_description ?? '',
      });
      setCurrentOgImage(page.og_image);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'No se pudo cargar la página');
    } finally { setFormLoading(false); }
  };

  const handleImageSelect = (file: File) => {
    setPendingImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleDeleteImage = async () => {
    if (!editingSlug) return;
    setImageUploading(true);
    try {
      await apiClient.deletePageImage(editingSlug);
      toast('success', 'Imagen social eliminada');
      setCurrentOgImage(null);
      resetImageState();
      await load();
    } catch (e) {
      toast('error', e instanceof ApiError ? e.message : 'No se pudo eliminar la imagen');
    } finally { setImageUploading(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError('');
    const payload: PageInput = {
      ...form,
      content: form.content || undefined,
      metaTitle: form.metaTitle || undefined,
      metaDescription: form.metaDescription || undefined,
    };
    try {
      let savedSlug: string;
      if (editingSlug) {
        await apiClient.updateAdminPage(editingSlug, payload);
        savedSlug = editingSlug;
      } else {
        const { page } = await apiClient.createAdminPage(payload);
        savedSlug = page.slug;
      }

      if (pendingImageFile) {
        setImageUploading(true);
        try {
          await apiClient.uploadPageImage(savedSlug, pendingImageFile);
        } catch (uploadErr) {
          toast('error', uploadErr instanceof ApiError ? uploadErr.message : 'Error al subir la imagen');
        } finally { setImageUploading(false); }
      }

      toast('success', editingSlug ? 'Página actualizada' : 'Página creada');
      setShowForm(false);
      resetImageState();
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
      await apiClient.deleteAdminPage(pendingDelete.id);
      toast('success', `"${pendingDelete.title}" eliminada`);
      setPendingDelete(null);
      await load();
    } catch (e) {
      toast('error', e instanceof ApiError ? e.message : 'No se pudo eliminar');
    } finally { setDeleting(false); }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[22px] font-bold text-white">Páginas</h1>
          <p className="text-white/45 text-sm mt-0.5">Contenido editable de las páginas fijas de la web pública</p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreate}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva página
        </Button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-md px-4 py-3 text-red-400 text-sm">{error}</div>
      )}

      <div className="rounded-card border border-white/8 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/4 border-b border-white/8">
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide">Página</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide hidden md:table-cell">SEO</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide hidden lg:table-cell">Actualizado</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/6">
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-white/40">Cargando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-white/30 text-sm">Sin páginas</td></tr>
            ) : items.map(p => (
              <tr key={p.id} className="hover:bg-white/3 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-white font-medium">{p.title}</p>
                  <p className="text-white/35 text-xs font-mono">/{p.slug}</p>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  {p.meta_title || p.meta_description ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-green-400">
                      <i className="ti ti-circle-check-filled text-[13px]" /> Completo
                    </span>
                  ) : (
                    <span className="text-white/30 text-[11px]">Sin definir</span>
                  )}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-white/40 text-xs tabular-nums">{fmtDate(p.updated_at)}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(p)}
                      className="p-1.5 rounded text-white/50 hover:text-white hover:bg-white/8 transition-colors" title="Editar">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => setPendingDelete(p)}
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
      <AdminModal title={editingSlug ? 'Editar página' : 'Nueva página'} open={showForm} onClose={() => setShowForm(false)}>
        {formLoading ? (
          <p className="text-white/40 text-center py-10">Cargando…</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <Field label="Título *">
              <Input
                value={form.title}
                onChange={v => setForm(f => ({ ...f, title: v, slug: editingSlug ? f.slug : toSlug(v) }))}
                placeholder="Sobre Carp Partners"
                required
              />
            </Field>
            <Field
              label="Slug *"
              hint={editingSlug
                ? 'No se puede cambiar: esta página ya tiene una ruta pública fija.'
                : 'Solo a-z, 0-9, guiones. Define la URL pública (/slug).'}
            >
              <Input value={form.slug} onChange={v => setForm(f => ({ ...f, slug: v }))} readOnly={!!editingSlug} required />
            </Field>
            <Field label="Contenido">
              <RichTextEditor value={form.content ?? ''} onChange={v => setForm(f => ({ ...f, content: v }))} placeholder="Texto de la página…" />
            </Field>
            <Field label="Meta título" hint="Título para buscadores y al compartir en redes. Si se deja vacío, se usa el título de la página.">
              <Input value={form.metaTitle ?? ''} onChange={v => setForm(f => ({ ...f, metaTitle: v }))} placeholder="Sobre Carp Partners — Carp Partners TV" />
            </Field>
            <Field label="Meta descripción" hint="Resumen breve para buscadores y redes sociales.">
              <Input value={form.metaDescription ?? ''} onChange={v => setForm(f => ({ ...f, metaDescription: v }))} placeholder="Descripción breve…" />
            </Field>
            <Field label="Imagen social (og:image)">
              <AvatarUploader
                shape="cover"
                currentUrl={currentOgImage}
                pendingPreview={imagePreview}
                uploading={imageUploading}
                onFileSelect={handleImageSelect}
                onDelete={editingSlug ? handleDeleteImage : undefined}
              />
            </Field>

            {formError && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{formError}</p>
            )}

            <div className="flex gap-3 pt-2 border-t border-white/8">
              <Button type="submit" variant="primary" size="md" loading={saving} className="flex-1 justify-center">
                {editingSlug ? 'Guardar cambios' : 'Crear página'}
              </Button>
              <Button type="button" variant="ghost" size="md" onClick={() => setShowForm(false)} disabled={saving}>
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </AdminModal>

      <ConfirmDialog
        open={!!pendingDelete}
        title="¿Eliminar página?"
        message={`"${pendingDelete?.title}" se eliminará permanentemente. Su ruta pública dejará de funcionar.`}
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
        loading={deleting}
      />
    </div>
  );
}
