'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { apiClient, ApiError } from '@carp-partners/api-client';
import type { WatchHistoryItem, User } from '@carp-partners/api-client';
import { Button } from '@carp-partners/ui';
import { ToastProvider, useToast } from '@/context/ToastContext';
import { AvatarUploader } from '@/components/AvatarUploader';

type Tab = 'account' | 'history' | 'notifs';

const PLAN_LABELS: Record<string, string> = {
  monthly: 'Mensual',
  annual: 'Anual',
  courtesy: 'Cortesía',
};

// Precios de referencia (los mismos que en /planes) — no hay endpoint que los devuelva.
const PLAN_PRICES: Record<string, string> = {
  monthly: '9,99€ / mes',
  annual: '89,99€ / año',
  courtesy: 'Acceso de cortesía',
};

const NOTIF_ROWS = [
  { key: 'estrenos', label: 'Nuevos estrenos', desc: 'Avisos cuando se publique contenido nuevo' },
  { key: 'recomendaciones', label: 'Recomendaciones', desc: 'Sugerencias basadas en lo que ves' },
  { key: 'promos', label: 'Ofertas y promociones', desc: 'Descuentos y novedades de planes' },
  { key: 'push', label: 'Notificaciones push (app)', desc: 'Avisos en tu móvil o tablet' },
] as const;

// Compara fechas de calendario (no una ventana móvil de 24h), para que un vídeo
// visto ayer a las 23:50 no aparezca como "Hoy" si son ya las 00:10 del día siguiente.
function formatRelative(dateStr: string): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(new Date(dateStr))) / 86_400_000);
  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 7) return `Hace ${days} días`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return weeks === 1 ? 'Hace 1 semana' : `Hace ${weeks} semanas`;
  const months = Math.floor(days / 30);
  return months <= 1 ? 'Hace 1 mes' : `Hace ${months} meses`;
}

export default function PerfilPage() {
  return (
    <ToastProvider>
      <PerfilContent />
    </ToastProvider>
  );
}

function PerfilContent() {
  const { user, subscription, logout, setUser } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>('account');
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [notifs, setNotifs] = useState<Record<string, boolean>>({
    estrenos: true, recomendaciones: true, promos: false, push: true,
  });

  useEffect(() => {
    apiClient
      .getContinueWatching()
      .then(({ items }) => setHistory(items))
      .catch(() => null)
      .finally(() => setLoadingHistory(false));
  }, []);

  const openBillingPortal = async () => {
    setPortalError('');
    setPortalLoading(true);
    try {
      const { url } = await apiClient.getBillingPortal();
      window.location.href = url;
    } catch {
      setPortalError('No se pudo abrir el portal de facturación. Inténtalo de nuevo.');
      setPortalLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  const initials = user?.name
    ? user.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  const planLabel = subscription ? PLAN_LABELS[subscription.plan] ?? subscription.plan : '';
  const planPrice = subscription ? PLAN_PRICES[subscription.plan] : undefined;

  return (
    <div className="min-h-screen bg-surface px-6 md:px-12 py-10">
      <h1 className="font-display font-bold text-white text-[34px] tracking-[-0.02em] mb-[30px]">
        Perfil
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 max-w-[1080px]">
        {/* ── Columna izquierda ── */}
        <div>
          <div className="rounded-[16px] border border-cp-border bg-white/[0.03] p-[28px_26px] mb-5">
            <div className="flex items-center gap-3.5 mb-5">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt=""
                  className="w-14 h-14 rounded-full object-cover border border-white/14 shrink-0"
                />
              ) : (
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center shrink-0
                             font-display font-semibold text-[19px] text-white border border-white/14"
                  style={{ background: 'linear-gradient(135deg,#5a241d,#2a1411)' }}
                >
                  {initials}
                </div>
              )}
              <div className="min-w-0">
                <div className="font-display text-[17px] font-semibold truncate" style={{ color: '#eef3f0' }}>
                  {user?.name ?? user?.email}
                </div>
                <div className="text-[12.5px] truncate" style={{ color: '#85958e' }}>{user?.email}</div>
              </div>
            </div>
            <button
              onClick={() => setShowEditModal(true)}
              className="w-full py-[11px] rounded-[9px] text-[13.5px] font-semibold transition-colors"
              style={{ border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.05)', color: '#e9efeb' }}
            >
              Editar perfil
            </button>
          </div>

          <div className="p-2 flex flex-col">
            <TabButton icon="user-circle" label="Cuenta y suscripción" active={tab === 'account'} onClick={() => setTab('account')} />
            <TabButton icon="history" label="Historial" active={tab === 'history'} onClick={() => setTab('history')} />
            <TabButton icon="bell" label="Notificaciones" active={tab === 'notifs'} onClick={() => setTab('notifs')} />
            <button
              onClick={handleLogout}
              className="flex items-center gap-[11px] px-4 py-3 rounded-[9px] text-[13.5px] font-medium mt-2.5 pt-[18px]"
              style={{ color: '#c0392b', borderTop: '1px solid rgba(255,255,255,0.07)' }}
            >
              <i className="ti ti-logout text-[19px]" />
              Cerrar sesión
            </button>
          </div>
        </div>

        {/* ── Columna derecha ── */}
        <div>
          {tab === 'account' && (
            <>
              <div
                className="p-[30px_32px] rounded-[16px] mb-5"
                style={{
                  background: 'linear-gradient(165deg, rgba(104,20,11,0.14), rgba(104,20,11,0.03))',
                  border: '1px solid rgba(207,74,53,0.3)',
                }}
              >
                <div className="flex items-center justify-between flex-wrap gap-3.5">
                  <div>
                    {subscription && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] mb-3
                                      bg-brand-dim text-brand-bright text-[11px] font-bold uppercase tracking-[0.03em]">
                        <i className="ti ti-circle-check-filled text-[13px]" />
                        Plan {planLabel} activo
                      </div>
                    )}
                    <div className="font-display text-[22px] font-bold text-white">
                      {planPrice ?? 'Sin suscripción'}
                    </div>
                    {subscription?.period_end && (
                      <div className="text-[13px] mt-1.5" style={{ color: '#9aa9a3' }}>
                        {subscription.status === 'cancelled' ? 'Acceso hasta el ' : 'Se renueva el '}
                        {new Date(subscription.period_end).toLocaleDateString('es-ES', {
                          day: 'numeric', month: 'long', year: 'numeric',
                        })}
                      </div>
                    )}
                  </div>
                  {user?.stripe_customer_id && (
                    <Button variant="primary" size="md" onClick={openBillingPortal} loading={portalLoading}>
                      Gestionar suscripción
                    </Button>
                  )}
                </div>
                {portalError && <p className="text-red-400 text-[12.5px] mt-3">{portalError}</p>}
              </div>

              <div className="rounded-[16px] border border-cp-border bg-white/[0.03] p-[26px_28px]">
                <div className="font-display text-[15.5px] font-semibold mb-4" style={{ color: '#eef3f0' }}>
                  Datos de la cuenta
                </div>
                <AccountRow label="Correo electrónico" value={user?.email ?? ''} />
                <AccountRow
                  label="Contraseña"
                  value={
                    <button
                      onClick={() => setShowPasswordModal(true)}
                      className="font-medium hover:underline"
                      style={{ color: '#cf4a35' }}
                    >
                      Cambiar contraseña
                    </button>
                  }
                />
                {/* Método de pago: placeholder — no hay endpoint que exponga la tarjeta guardada en Stripe todavía */}
                <AccountRow
                  label="Método de pago"
                  value={
                    <span className="inline-flex items-center gap-2" style={{ color: '#e9efeb' }}>
                      <i className="ti ti-credit-card text-[17px]" style={{ color: '#85958e' }} />
                      Visa ···· 4242
                    </span>
                  }
                  last
                />
              </div>
            </>
          )}

          {tab === 'history' && (
            <div className="rounded-[16px] border border-cp-border bg-white/[0.03] p-[26px_28px]">
              <div className="font-display text-[15.5px] font-semibold mb-1.5" style={{ color: '#eef3f0' }}>
                Visto recientemente
              </div>
              <div className="text-[12.5px] mb-[18px]" style={{ color: '#7d8d86' }}>
                Tu actividad de los últimos días
              </div>
              {loadingHistory ? (
                <p className="text-[13.5px]" style={{ color: '#7d8d86' }}>Cargando…</p>
              ) : history.length === 0 ? (
                <p className="text-[13.5px]" style={{ color: '#7d8d86' }}>Todavía no has visto ningún vídeo.</p>
              ) : (
                <div className="flex flex-col">
                  {history.map((item, i) => (
                    <div
                      key={item.id}
                      onClick={() => router.push(`/watch/${item.id}/play`)}
                      className="flex items-center gap-3.5 py-[13px] cursor-pointer"
                      style={{ borderBottom: i < history.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
                    >
                      <div className="flex-none w-[84px] h-12 rounded-[7px] bg-surface-raised overflow-hidden relative">
                        {item.thumbnail_url && (
                          <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <i className="ti ti-player-play-filled text-[15px] text-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] font-semibold truncate" style={{ color: '#e9efeb' }}>
                          {item.title}
                        </div>
                        <div className="text-[12px] mt-0.5" style={{ color: '#7d8d86' }}>
                          {formatRelative(item.last_watched_at)}
                        </div>
                      </div>
                      <div className="text-[12px] tabular-nums" style={{ color: '#85958e' }}>
                        {Math.round(item.duration_sec / 60)} min
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'notifs' && (
            <div className="rounded-[16px] border border-cp-border bg-white/[0.03] p-[26px_28px]">
              <div className="font-display text-[15.5px] font-semibold mb-1" style={{ color: '#eef3f0' }}>
                Preferencias de notificación
              </div>
              <p className="text-[12px] mb-4" style={{ color: '#7d8d86' }}>
                Estas preferencias se aplicarán a los avisos que recibas en la app móvil.
              </p>
              {NOTIF_ROWS.map((n, i) => {
                const on = notifs[n.key];
                return (
                  <div
                    key={n.key}
                    className="flex items-center justify-between gap-4 py-[15px]"
                    style={{ borderBottom: i < NOTIF_ROWS.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
                  >
                    <div>
                      <div className="text-[13.5px] font-medium" style={{ color: '#e9efeb' }}>{n.label}</div>
                      <div className="text-[12px] mt-0.5" style={{ color: '#7d8d86' }}>{n.desc}</div>
                    </div>
                    <button
                      onClick={() => setNotifs((s) => ({ ...s, [n.key]: !s[n.key] }))}
                      aria-label={n.label}
                      aria-pressed={on}
                      className="shrink-0 w-[42px] h-6 rounded-full relative transition-colors"
                      style={{ background: on ? '#cf4a35' : 'rgba(255,255,255,0.14)' }}
                    >
                      <span
                        className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                        style={{ left: on ? 20 : 2, boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showPasswordModal && (
        <ChangePasswordModal
          onClose={() => setShowPasswordModal(false)}
          onSuccess={() => {
            setShowPasswordModal(false);
            toast('success', 'Contraseña actualizada correctamente.');
          }}
        />
      )}

      {showEditModal && user && (
        <EditProfileModal
          user={user}
          onClose={() => setShowEditModal(false)}
          onSaved={(updated) => {
            setUser(updated);
            setShowEditModal(false);
            toast('success', 'Perfil actualizado.');
          }}
        />
      )}
    </div>
  );
}

// ─── Filas de la tarjeta "Datos de la cuenta" ─────────────────────────────────

function AccountRow({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
  return (
    <div
      className="flex items-center justify-between py-3.5"
      style={{ borderBottom: last ? 'none' : '1px solid rgba(255,255,255,0.06)' }}
    >
      <span className="text-[13.5px]" style={{ color: '#85958e' }}>{label}</span>
      <span className="text-[13.5px]">{value}</span>
    </div>
  );
}

// ─── Pestaña lateral ──────────────────────────────────────────────────────────

function TabButton({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-[11px] px-4 py-3 rounded-[9px] text-[13.5px] font-medium text-left transition-colors"
      style={{ background: active ? 'rgba(104,20,11,0.16)' : 'transparent', color: active ? '#fff' : '#9aa9a3' }}
    >
      <i className={`ti ti-${icon} text-[19px]`} />
      {label}
    </button>
  );
}

// ─── Modal: editar perfil (nombre + foto) ─────────────────────────────────────

function EditProfileModal({
  user, onClose, onSaved,
}: {
  user: User;
  onClose: () => void;
  onSaved: (user: User) => void;
}) {
  const [name, setName] = useState(user.name ?? '');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const initials = user.name
    ? user.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
    : user.email[0]?.toUpperCase() ?? '?';

  const handleFileSelect = (file: File) => {
    setPendingFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleDeleteAvatar = async () => {
    setAvatarUploading(true);
    setError('');
    try {
      await apiClient.deleteAvatar();
      onSaved({ ...user, avatar_url: null });
      setPendingFile(null);
      setPreview(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar la foto.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('El nombre no puede estar vacío.');
      return;
    }

    setSaving(true);
    try {
      let updated = (await apiClient.updateProfile(name.trim())).user;
      if (pendingFile) {
        setAvatarUploading(true);
        try {
          updated = (await apiClient.uploadAvatar(pendingFile)).user;
        } finally {
          setAvatarUploading(false);
        }
      }
      onSaved(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[420px] rounded-[18px] p-[30px_28px]"
        style={{ background: '#0e151a', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display font-semibold text-white text-[18px]">Editar perfil</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-white/50 hover:text-white">
            <i className="ti ti-x text-[20px]" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <AvatarUploader
              currentUrl={user.avatar_url}
              pendingPreview={preview}
              initials={initials}
              uploading={avatarUploading}
              onFileSelect={handleFileSelect}
              onDelete={user.avatar_url ? handleDeleteAvatar : undefined}
            />
          </div>

          <div className="mb-[14px]">
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#b3c0ba', marginBottom: 8 }}>
              Nombre
            </label>
            <div
              className="flex items-center gap-2.5 px-[14px] rounded-[10px]"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <i className="ti ti-user text-[18px]" style={{ color: '#6a7a73' }} />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: '#eef3f0', fontFamily: 'Inter, sans-serif', fontSize: 14.5, padding: '13px 0',
                }}
              />
            </div>
          </div>

          <div className="mb-5">
            <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#b3c0ba', marginBottom: 8 }}>
              Correo electrónico
            </label>
            <div
              className="flex items-center gap-2.5 px-[14px] rounded-[10px] opacity-60"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <i className="ti ti-lock text-[16px]" style={{ color: '#6a7a73' }} />
              <input
                value={user.email}
                disabled
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: '#9aa9a3', fontFamily: 'Inter, sans-serif', fontSize: 14.5, padding: '13px 0',
                  cursor: 'not-allowed',
                }}
              />
            </div>
            <p className="text-[11.5px] mt-1.5" style={{ color: '#7d8d86' }}>
              Está vinculado a tu facturación de Stripe y no se puede cambiar aquí.
            </p>
          </div>

          {error && (
            <div
              className="mb-4 px-3 py-2.5 rounded-lg text-[13px] leading-snug"
              style={{ background: 'rgba(192,57,43,0.12)', border: '1px solid rgba(192,57,43,0.3)', color: '#ff8a80' }}
            >
              {error}
            </div>
          )}

          <Button variant="primary" size="md" className="w-full" loading={saving}>
            Guardar cambios
          </Button>
        </form>
      </div>
    </div>
  );
}

// ─── Modal: cambiar contraseña ────────────────────────────────────────────────

function ChangePasswordModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      await apiClient.changePassword(currentPassword, newPassword);
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[420px] rounded-[18px] p-[30px_28px]"
        style={{ background: '#0e151a', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display font-semibold text-white text-[18px]">Cambiar contraseña</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-white/50 hover:text-white">
            <i className="ti ti-x text-[20px]" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <PasswordField label="Contraseña actual" value={currentPassword} onChange={setCurrentPassword} autoFocus />
          <PasswordField label="Nueva contraseña" value={newPassword} onChange={setNewPassword} />
          <PasswordField label="Confirmar nueva contraseña" value={confirmPassword} onChange={setConfirmPassword} last />

          {error && (
            <div
              className="mb-4 px-3 py-2.5 rounded-lg text-[13px] leading-snug"
              style={{ background: 'rgba(192,57,43,0.12)', border: '1px solid rgba(192,57,43,0.3)', color: '#ff8a80' }}
            >
              {error}
            </div>
          )}

          <Button variant="primary" size="md" className="w-full" loading={loading}>
            Guardar contraseña
          </Button>
        </form>
      </div>
    </div>
  );
}

function PasswordField({
  label, value, onChange, autoFocus, last,
}: {
  label: string; value: string; onChange: (v: string) => void; autoFocus?: boolean; last?: boolean;
}) {
  return (
    <div style={{ marginBottom: last ? 20 : 14 }}>
      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#b3c0ba', marginBottom: 8 }}>
        {label}
      </label>
      <div
        className="flex items-center gap-2.5 px-[14px] rounded-[10px]"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <i className="ti ti-lock text-[18px]" style={{ color: '#6a7a73' }} />
        <input
          type="password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          required
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: '#eef3f0', fontFamily: 'Inter, sans-serif', fontSize: 14.5, padding: '13px 0',
          }}
        />
      </div>
    </div>
  );
}
