'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '@carp-partners/api-client';
import type { CrewMember, CrewMemberInput } from '@carp-partners/api-client';
import { Button, Pagination } from '@carp-partners/ui';
import { AdminModal } from '@/components/admin/AdminModal';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { RichTextEditor } from '@/components/admin/RichTextEditor';
import { AvatarUploader } from '@/components/admin/AvatarUploader';
import { useToast } from '@/context/ToastContext';

function toSlug(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const EMPTY: CrewMemberInput = { name: '', slug: '', role: 'crew', bio: '', avatarUrl: '', orderIndex: 0 };

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
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} required={required}
      className="w-full bg-surface border border-white/12 rounded-md px-3 py-2 text-white text-sm
                 placeholder-white/25 focus:outline-none focus:border-brand-bright transition-colors" />
  );
}

function Textarea({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3}
      className="w-full bg-surface border border-white/12 rounded-md px-3 py-2 text-white text-sm
                 placeholder-white/25 focus:outline-none focus:border-brand-bright transition-colors resize-none" />
  );
}

export default function AdminCrewPage() {
  const { toast } = useToast();
  const [members, setMembers]   = useState<CrewMember[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<CrewMember | null>(null);
  const [form, setForm]         = useState<CrewMemberInput>(EMPTY);
  const [formError, setFormError] = useState('');
  const [saving, setSaving]     = useState(false);

  const [pendingDelete, setPendingDelete] = useState<CrewMember | null>(null);
  const [deleting, setDeleting]           = useState(false);

  // Avatar: archivo pendiente de subir + preview local + estado de subida/borrado
  const [pendingAvatarFile, setPendingAvatarFile]   = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview]           = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await apiClient.getAdminCrew();
      setMembers(res.crew);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al cargar la crew');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetAvatarState = () => {
    setPendingAvatarFile(null);
    setAvatarPreview(null);
  };

  const openCreate = () => {
    setEditing(null); setForm(EMPTY); setFormError(''); resetAvatarState(); setShowForm(true);
  };

  const openEdit = (m: CrewMember) => {
    setEditing(m);
    setForm({ name: m.name, slug: m.slug, role: m.role, bio: m.bio ?? '', avatarUrl: m.avatar_url ?? '', orderIndex: m.order_index });
    setFormError(''); resetAvatarState(); setShowForm(true);
  };

  const handleFileSelect = (file: File) => {
    setPendingAvatarFile(file);
    // Genera preview local con URL de objeto (se libera al cerrar el modal)
    const url = URL.createObjectURL(file);
    setAvatarPreview(url);
  };

  const handleDeleteAvatar = async () => {
    if (!editing) return;
    setAvatarUploading(true);
    try {
      await apiClient.deleteCrewAvatar(editing.id);
      toast('success', 'Foto eliminada');
      setForm(f => ({ ...f, avatarUrl: '' }));
      resetAvatarState();
      await load();
    } catch (e) {
      toast('error', e instanceof ApiError ? e.message : 'No se pudo eliminar la foto');
    } finally { setAvatarUploading(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setFormError('');
    const payload: CrewMemberInput = {
      ...form,
      bio: form.bio || undefined,
      avatarUrl: form.avatarUrl || undefined,
    };
    try {
      let savedId: string;
      if (editing) {
        await apiClient.updateAdminCrewMember(editing.id, payload);
        savedId = editing.id;
      } else {
        const { member } = await apiClient.createAdminCrewMember(payload);
        savedId = member.id;
      }

      // Si el usuario seleccionó un archivo, lo subimos ahora que tenemos el ID
      if (pendingAvatarFile) {
        setAvatarUploading(true);
        try {
          await apiClient.uploadCrewAvatar(savedId, pendingAvatarFile);
        } catch (uploadErr) {
          const msg = uploadErr instanceof ApiError ? uploadErr.message : 'Error al subir la imagen';
          toast('error', msg);
        } finally { setAvatarUploading(false); }
      }

      toast('success', editing ? 'Miembro actualizado' : 'Miembro creado');
      setShowForm(false);
      resetAvatarState();
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
      await apiClient.deleteAdminCrewMember(pendingDelete.id);
      toast('success', `"${pendingDelete.name}" eliminado`);
      setPendingDelete(null);
      await load();
    } catch (e) {
      toast('error', e instanceof ApiError ? e.message : 'No se pudo eliminar');
    } finally { setDeleting(false); }
  };

  // Agrupa: socios primero, crew debajo
  const socios = members.filter(m => m.role === 'socio');
  const crew   = members.filter(m => m.role === 'crew');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[22px] font-bold text-white">Crew</h1>
          <p className="text-white/45 text-sm mt-0.5">Personas que aparecen en los vídeos</p>
        </div>
        <Button variant="primary" size="sm" onClick={openCreate}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo miembro
        </Button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-md px-4 py-3 text-red-400 text-sm">{error}</div>
      )}

      {/* Socios */}
      {(loading || socios.length > 0) && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-gold uppercase tracking-widest px-1">Socios</h2>
          <CrewTable members={socios} loading={loading} onEdit={openEdit} onDelete={setPendingDelete} />
        </section>
      )}

      {/* Crew */}
      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-white/40 uppercase tracking-widest px-1">Crew</h2>
        <CrewTable members={crew} loading={loading && socios.length === 0} onEdit={openEdit} onDelete={setPendingDelete} />
      </section>

      {/* Contador total — sin navegación (el layout de dos secciones no es paginable) */}
      <Pagination
        total={members.length}
        page={0}
        pageSize={Math.max(members.length, 1)}
        onPageChange={() => {}}
        loading={loading}
      />

      {/* Modal */}
      <AdminModal title={editing ? 'Editar miembro' : 'Nuevo miembro'} open={showForm} onClose={() => setShowForm(false)}>
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Nombre *">
            <Input value={form.name} onChange={v => setForm(f => ({ ...f, name: v, slug: editing ? f.slug : toSlug(v) }))} placeholder="Nombre completo" required />
          </Field>
          <Field label="Slug *" hint="Solo a-z, 0-9, guiones.">
            <Input value={form.slug} onChange={v => setForm(f => ({ ...f, slug: v }))} placeholder="nombre-apellido" required />
          </Field>
          <Field label="Rol">
            <select
              value={form.role ?? 'crew'}
              onChange={e => setForm(f => ({ ...f, role: e.target.value as 'socio' | 'crew' }))}
              className="w-full bg-surface border border-white/12 rounded-md px-3 py-2 text-white text-sm
                         focus:outline-none focus:border-brand-bright [&>option]:bg-surface-raised"
            >
              <option value="crew">Crew</option>
              <option value="socio">Socio</option>
            </select>
          </Field>
          <Field label="Bio">
            <RichTextEditor value={form.bio ?? ''} onChange={v => setForm(f => ({ ...f, bio: v }))} placeholder="Descripción breve…" />
          </Field>
          <Field label="Foto de perfil">
            <AvatarUploader
              currentUrl={form.avatarUrl || null}
              pendingPreview={avatarPreview}
              initials={(form.name || '?').charAt(0).toUpperCase()}
              uploading={avatarUploading}
              onFileSelect={handleFileSelect}
              onDelete={editing ? handleDeleteAvatar : undefined}
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
              {editing ? 'Guardar cambios' : 'Crear miembro'}
            </Button>
            <Button type="button" variant="ghost" size="md" onClick={() => setShowForm(false)} disabled={saving}>
              Cancelar
            </Button>
          </div>
        </form>
      </AdminModal>

      <ConfirmDialog
        open={!!pendingDelete}
        title="¿Eliminar miembro?"
        message={`"${pendingDelete?.name}" se eliminará y desvinculará de todos los vídeos.`}
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
        loading={deleting}
      />
    </div>
  );
}

// ─── Tabla reutilizable ──────────────────────────────────────────────────────

function CrewTable({ members, loading, onEdit, onDelete }: {
  members: CrewMember[];
  loading: boolean;
  onEdit: (m: CrewMember) => void;
  onDelete: (m: CrewMember) => void;
}) {
  return (
    <div className="rounded-card border border-white/8 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-white/4 border-b border-white/8">
            <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide">Nombre</th>
            <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide hidden md:table-cell">Slug</th>
            <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide">Rol</th>
            <th className="text-right px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide w-10">Orden</th>
            <th className="px-4 py-3 w-20" />
          </tr>
        </thead>
        <tbody className="divide-y divide-white/6">
          {loading ? (
            <tr><td colSpan={5} className="px-4 py-10 text-center text-white/40">Cargando…</td></tr>
          ) : members.length === 0 ? (
            <tr><td colSpan={5} className="px-4 py-8 text-center text-white/30 text-sm">Sin miembros</td></tr>
          ) : members.map(m => (
            <tr key={m.id} className="hover:bg-white/3 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover bg-surface-raised shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-surface-raised shrink-0 flex items-center justify-center text-white/30 text-xs font-bold">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-white font-medium">{m.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <span className="text-white/35 text-xs font-mono">{m.slug}</span>
              </td>
              <td className="px-4 py-3">
                <RoleBadge role={m.role} />
              </td>
              <td className="px-4 py-3 text-right">
                <span className="text-white/40 text-xs tabular-nums">{m.order_index}</span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <button onClick={() => onEdit(m)}
                    className="p-1.5 rounded text-white/50 hover:text-white hover:bg-white/8 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => onDelete(m)}
                    className="p-1.5 rounded text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors">
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
  );
}

function RoleBadge({ role }: { role: 'socio' | 'crew' }) {
  return role === 'socio' ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-gold/15 text-gold">Socio</span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-white/8 text-white/50">Crew</span>
  );
}
