'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient, ApiError } from '@carp-partners/api-client';
import type { Carousel, CarouselDetail, CarouselImage, CarouselInput } from '@carp-partners/api-client';
import { Button, Pagination } from '@carp-partners/ui';
import { AdminModal } from '@/components/admin/AdminModal';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { useToast } from '@/context/ToastContext';

function toSlug(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const EMPTY: CarouselInput = { name: '', slug: '' };

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-admin-text-secondary uppercase tracking-wide">{label}</label>
      {children}
      {hint && <p className="text-admin-text-tertiary text-xs">{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, placeholder, required }: {
  value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean;
}) {
  return (
    <input type="text" value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} required={required}
      className="w-full bg-white border border-admin-input-border rounded-md px-3 py-2 text-admin-text text-sm
                 placeholder-admin-text-tertiary focus:outline-none focus:border-brand-bright transition-colors" />
  );
}

export default function AdminCarouselsPage() {
  const { toast } = useToast();
  const [carousels, setCarousels] = useState<Carousel[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<CarouselDetail | null>(null);
  const [form, setForm]           = useState<CarouselInput>(EMPTY);
  const [formError, setFormError] = useState('');
  const [saving, setSaving]       = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [uploading, setUploading]         = useState(false);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pendingDelete, setPendingDelete] = useState<Carousel | null>(null);
  const [deleting, setDeleting]           = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await apiClient.getAdminCarousels();
      setCarousels(res.carousels);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al cargar los carrousels');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null); setForm(EMPTY); setFormError(''); setShowForm(true);
  };

  const openEdit = async (c: Carousel) => {
    setForm({ name: c.name, slug: c.slug });
    setFormError(''); setShowForm(true); setLoadingDetail(true);
    try {
      const { carousel } = await apiClient.getAdminCarousel(c.id);
      setEditing(carousel);
    } catch (e) {
      toast('error', e instanceof ApiError ? e.message : 'No se pudo cargar el carrousel');
      setShowForm(false);
    } finally { setLoadingDetail(false); }
  };

  // Crea el carrousel (Name/Slug) y, si ya existía, solo actualiza esos campos.
  // Tras crear, el modal pasa a modo edición sin cerrarse para poder subir imágenes.
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError('');
    try {
      if (editing) {
        await apiClient.updateAdminCarousel(editing.id, form);
        toast('success', 'Carrousel actualizado');
      } else {
        const { carousel } = await apiClient.createAdminCarousel(form);
        setEditing(carousel);
        toast('success', 'Carrousel creado — añade ahora las imágenes');
      }
      await load();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Error al guardar';
      setFormError(msg);
      toast('error', msg);
    } finally { setSaving(false); }
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0 || !editing) return;
    setUploading(true);
    try {
      let updated = editing;
      for (const file of Array.from(files)) {
        const { image } = await apiClient.uploadCarouselImage(editing.id, file);
        updated = { ...updated, images: [...updated.images, image] };
        setEditing(updated);
      }
      await load();
    } catch (e) {
      toast('error', e instanceof ApiError ? e.message : 'No se pudo subir la imagen');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteImage = async (image: CarouselImage) => {
    if (!editing) return;
    setDeletingImageId(image.id);
    try {
      await apiClient.deleteCarouselImage(editing.id, image.id);
      setEditing({ ...editing, images: editing.images.filter(i => i.id !== image.id) });
      await load();
    } catch (e) {
      toast('error', e instanceof ApiError ? e.message : 'No se pudo eliminar la imagen');
    } finally { setDeletingImageId(null); }
  };

  const moveImage = async (index: number, dir: -1 | 1) => {
    if (!editing) return;
    const target = index + dir;
    if (target < 0 || target >= editing.images.length) return;
    const reordered = [...editing.images];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setEditing({ ...editing, images: reordered });
    try {
      const { images } = await apiClient.reorderCarouselImages(editing.id, reordered.map(i => i.id));
      setEditing(prev => (prev ? { ...prev, images } : prev));
    } catch (e) {
      toast('error', e instanceof ApiError ? e.message : 'No se pudo reordenar');
      const { carousel } = await apiClient.getAdminCarousel(editing.id);
      setEditing(carousel);
    }
  };

  const copyShortcode = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(`[carrousel:${slug}]`);
      toast('success', 'Shortcode copiado');
    } catch {
      toast('error', 'No se pudo copiar');
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await apiClient.deleteAdminCarousel(pendingDelete.id);
      toast('success', `"${pendingDelete.name}" eliminado`);
      setPendingDelete(null);
      await load();
    } catch (e) {
      toast('error', e instanceof ApiError ? e.message : 'No se pudo eliminar');
    } finally { setDeleting(false); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[22px] font-bold text-admin-text">Carrousels</h1>
          <p className="text-admin-text-secondary text-sm mt-0.5">
            Listas de imágenes reutilizables — hero de la landing y shortcode <code className="font-mono">[carrousel:slug]</code> en páginas.
          </p>
        </div>
        <Button theme="light" variant="primary" size="sm" onClick={openCreate}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo carrousel
        </Button>
      </div>

      {error && (
        <div className="bg-[#fdecea] border border-[#f7cfc9] rounded-md px-4 py-3 text-[#c0392b] text-sm">{error}</div>
      )}

      <div className="rounded-admin-card border border-admin-border overflow-hidden bg-admin-surface shadow-admin-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-admin-thead border-b border-admin-border">
              <th className="text-left px-4 py-3 text-admin-text-muted font-medium text-xs uppercase tracking-wide">Nombre</th>
              <th className="text-left px-4 py-3 text-admin-text-muted font-medium text-xs uppercase tracking-wide">Slug / shortcode</th>
              <th className="text-right px-4 py-3 text-admin-text-muted font-medium text-xs uppercase tracking-wide w-24">Imágenes</th>
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-border-soft">
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-admin-text-tertiary">Cargando…</td></tr>
            ) : carousels.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-admin-text-tertiary text-sm">Sin carrousels todavía</td></tr>
            ) : carousels.map(c => (
              <tr key={c.id} className="hover:bg-admin-hover transition-colors">
                <td className="px-4 py-3 text-admin-text font-medium">{c.name}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => copyShortcode(c.slug)}
                    title="Copiar shortcode"
                    className="inline-flex items-center gap-1.5 text-admin-text-tertiary text-xs font-mono hover:text-brand-bright transition-colors"
                  >
                    [carrousel:{c.slug}]
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-admin-text-muted text-xs tabular-nums">{c.image_count}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => openEdit(c)}
                      className="p-1.5 rounded text-admin-text-secondary hover:text-admin-text hover:bg-admin-hover transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button onClick={() => setPendingDelete(c)}
                      className="p-1.5 rounded text-admin-text-secondary hover:text-[#c0392b] hover:bg-[#fdecea] transition-colors">
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
        total={carousels.length}
        page={0}
        pageSize={Math.max(carousels.length, 1)}
        onPageChange={() => {}}
        loading={loading}
      />

      {/* Modal */}
      <AdminModal
        theme="light"
        title={editing ? 'Editar carrousel' : 'Nuevo carrousel'}
        open={showForm}
        onClose={() => setShowForm(false)}
        footer={
          <>
            {formError && (
              <p className="text-[#c0392b] text-sm bg-[#fdecea] border border-[#f7cfc9] rounded px-3 py-2 mb-3">{formError}</p>
            )}
            <div className="flex gap-3">
              <Button theme="light" type="submit" form="carousel-form" variant="primary" size="md" loading={saving} className="flex-1 justify-center">
                {editing ? 'Guardar cambios' : 'Crear carrousel'}
              </Button>
              <Button theme="light" type="button" variant="ghost" size="md" onClick={() => setShowForm(false)} disabled={saving}>
                Cerrar
              </Button>
            </div>
          </>
        }
      >
        <form id="carousel-form" onSubmit={handleSave} className="space-y-4">
          <Field label="Nombre *">
            <Input value={form.name} onChange={v => setForm(f => ({ ...f, name: v, slug: editing ? f.slug : toSlug(v) }))} placeholder="Hero landing" required />
          </Field>
          <Field label="Slug *" hint="Solo a-z, 0-9, guiones. Es lo que va dentro del shortcode.">
            <Input value={form.slug} onChange={v => setForm(f => ({ ...f, slug: v }))} placeholder="hero-landing" required />
          </Field>

          {editing && (
            <>
              <div
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-md text-xs font-mono text-admin-text-secondary"
                style={{ background: '#fafbfb', border: '1px solid #eef0f2' }}
              >
                [carrousel:{editing.slug}]
                <button type="button" onClick={() => copyShortcode(editing.slug)} className="text-brand-bright font-sans font-semibold shrink-0">
                  Copiar
                </button>
              </div>

              <Field label={`Imágenes (${editing.images.length})`} hint="Cada imagen es un elemento del carrousel, en el orden mostrado.">
                {loadingDetail ? (
                  <p className="text-admin-text-tertiary text-sm">Cargando…</p>
                ) : (
                  <div className="space-y-2">
                    {editing.images.map((img, i) => (
                      <div key={img.id} className="flex items-center gap-3 p-2 rounded-md border border-admin-border-soft bg-admin-bg">
                        <img src={img.image_url} alt="" className="w-16 h-9 object-cover rounded shrink-0 bg-admin-border-soft" />
                        <span className="flex-1 text-admin-text-tertiary text-xs truncate">{i + 1}</span>
                        <div className="flex items-center gap-0.5">
                          <button type="button" disabled={i === 0} onClick={() => moveImage(i, -1)}
                            className="p-1.5 rounded text-admin-text-secondary hover:text-admin-text hover:bg-admin-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button type="button" disabled={i === editing.images.length - 1} onClick={() => moveImage(i, 1)}
                            className="p-1.5 rounded text-admin-text-secondary hover:text-admin-text hover:bg-admin-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          <button type="button" disabled={deletingImageId === img.id} onClick={() => handleDeleteImage(img)}
                            className="p-1.5 rounded text-admin-text-secondary hover:text-[#c0392b] hover:bg-[#fdecea] disabled:opacity-50 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                    {editing.images.length === 0 && (
                      <p className="text-admin-text-tertiary text-sm">Sin imágenes todavía.</p>
                    )}
                    <label className="flex items-center justify-center gap-2 border border-dashed border-admin-input-border rounded-md py-3 text-sm text-admin-text-secondary cursor-pointer hover:border-brand-bright hover:text-brand-bright transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {uploading ? 'Subiendo…' : 'Añadir imágenes (JPG/PNG/WebP, máx 5 MB c/u)'}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        disabled={uploading}
                        onChange={e => handleFilesSelected(e.target.files)}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </Field>
            </>
          )}
        </form>
      </AdminModal>

      <ConfirmDialog
        open={!!pendingDelete}
        title="¿Eliminar carrousel?"
        message={`"${pendingDelete?.name}" y todas sus imágenes se eliminarán permanentemente.`}
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
        loading={deleting}
      />
    </div>
  );
}
