'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient, ApiError } from '@carp-partners/api-client';
import { Button, Pagination } from '@carp-partners/ui';
import type { AdminUser, UserStatusCounts, CourtesySubscriptionInput } from '@carp-partners/api-client';
import { AdminModal } from '@/components/admin/AdminModal';
import { useToast } from '@/context/ToastContext';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

const STATUS_LABELS: Record<string, string> = {
  active:    'Activo',
  trialing:  'Prueba',
  past_due:  'Vencido',
  cancelled: 'Cancelado',
};

const PLAN_LABELS: Record<string, string> = {
  monthly:  'Mensual',
  annual:   'Anual',
  courtesy: 'Cortesía',
};

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-white/30 text-xs">—</span>;
  const label = STATUS_LABELS[status] ?? status;
  const cls = {
    active:    'bg-green-500/15 text-green-400',
    trialing:  'bg-amber-500/15 text-amber-400',
    past_due:  'bg-orange-500/15 text-orange-400',
    cancelled: 'bg-white/8 text-white/40',
  }[status] ?? 'bg-white/8 text-white/40';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

// ─── Formulario reutilizable: elegir duración de una cortesía ────────────────

type DurationChoice = '6m' | '1y' | 'date' | 'indefinite';

function toCourtesyInput(choice: DurationChoice, dateValue: string): CourtesySubscriptionInput | null {
  if (choice === 'indefinite') return { indefinite: true };
  if (choice === '6m') return { durationMonths: 6 };
  if (choice === '1y') return { durationMonths: 12 };
  if (!dateValue) return null;
  return { endDate: new Date(dateValue).toISOString() };
}

function DurationPicker({ choice, onChoice, date, onDate }: {
  choice: DurationChoice; onChoice: (c: DurationChoice) => void;
  date: string; onDate: (d: string) => void;
}) {
  const options: { key: DurationChoice; label: string }[] = [
    { key: '6m', label: '6 meses' },
    { key: '1y', label: '1 año' },
    { key: 'date', label: 'Fecha concreta' },
    { key: 'indefinite', label: 'Indefinido (familiares)' },
  ];
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-white/60 uppercase tracking-wide">Duración de la cortesía</label>
      <div className="grid grid-cols-2 gap-2">
        {options.map(o => (
          <button
            key={o.key}
            type="button"
            onClick={() => onChoice(o.key)}
            className="px-3 py-2 rounded-md text-[13px] font-medium text-left transition-colors"
            style={{
              background: choice === o.key ? 'rgba(104,20,11,0.18)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${choice === o.key ? '#68140b' : 'rgba(255,255,255,0.1)'}`,
              color: choice === o.key ? '#fff' : '#c4d0cb',
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
      {choice === 'date' && (
        <input
          type="date"
          value={date}
          onChange={e => onDate(e.target.value)}
          className="w-full bg-surface border border-white/12 rounded-md px-3 py-2 text-white text-sm
                     focus:outline-none focus:border-brand-bright transition-colors"
        />
      )}
    </div>
  );
}

// ─── Modal: crear suscriptor ──────────────────────────────────────────────────

function CreateSubscriberModal({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: () => void;
}) {
  const { toast } = useToast();
  const [email, setEmail]         = useState('');
  const [name, setName]           = useState('');
  const [passwordMode, setPasswordMode] = useState<'link' | 'password'>('link');
  const [password, setPassword]   = useState('');
  const [choice, setChoice]       = useState<DurationChoice>('6m');
  const [date, setDate]           = useState('');
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [link, setLink]           = useState<string | null>(null);
  const [copied, setCopied]       = useState(false);

  const reset = () => {
    setEmail(''); setName(''); setPasswordMode('link'); setPassword('');
    setChoice('6m'); setDate(''); setError(''); setLink(null); setCopied(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const courtesy = toCourtesyInput(choice, date);
    if (!courtesy) { setError('Elige una fecha de fin para la cortesía'); return; }

    setSaving(true);
    try {
      const { user, setPasswordToken } = await apiClient.createAdminUser({
        email,
        name: name || undefined,
        password: passwordMode === 'password' ? password : undefined,
      });
      await apiClient.grantCourtesySubscription(user.id, courtesy);

      toast('success', `Suscriptor "${user.email}" creado`);
      onCreated();

      if (setPasswordToken) {
        setLink(`${window.location.origin}/set-password?token=${setPasswordToken}`);
      } else {
        handleClose();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al crear el suscriptor');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AdminModal title="Crear suscriptor" open={open} onClose={handleClose}>
      {link ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
            <i className="ti ti-circle-check-filled text-[18px]" />
            Suscriptor creado
          </div>
          <p className="text-white/60 text-sm">
            Comparte este enlace para que la persona establezca su contraseña. Caduca en 14 días.
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={link}
              className="flex-1 bg-surface border border-white/12 rounded-md px-3 py-2 text-white/70 text-xs font-mono"
              onFocus={e => e.target.select()}
            />
            <Button variant="ghost" size="sm" onClick={copyLink}>
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
          <div className="pt-2 border-t border-white/8">
            <Button variant="primary" size="md" onClick={handleClose}>Cerrar</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-white/60 uppercase tracking-wide">Email *</label>
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="persona@ejemplo.com"
              className="w-full bg-surface border border-white/12 rounded-md px-3 py-2 text-white text-sm
                         placeholder-white/25 focus:outline-none focus:border-brand-bright transition-colors"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-white/60 uppercase tracking-wide">Nombre</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Nombre completo"
              className="w-full bg-surface border border-white/12 rounded-md px-3 py-2 text-white text-sm
                         placeholder-white/25 focus:outline-none focus:border-brand-bright transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-white/60 uppercase tracking-wide">Contraseña</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPasswordMode('link')}
                className="flex-1 px-3 py-2 rounded-md text-[13px] font-medium transition-colors"
                style={{
                  background: passwordMode === 'link' ? 'rgba(104,20,11,0.18)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${passwordMode === 'link' ? '#68140b' : 'rgba(255,255,255,0.1)'}`,
                  color: passwordMode === 'link' ? '#fff' : '#c4d0cb',
                }}
              >
                Generar enlace
              </button>
              <button type="button" onClick={() => setPasswordMode('password')}
                className="flex-1 px-3 py-2 rounded-md text-[13px] font-medium transition-colors"
                style={{
                  background: passwordMode === 'password' ? 'rgba(104,20,11,0.18)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${passwordMode === 'password' ? '#68140b' : 'rgba(255,255,255,0.1)'}`,
                  color: passwordMode === 'password' ? '#fff' : '#c4d0cb',
                }}
              >
                Establecerla ahora
              </button>
            </div>
            {passwordMode === 'password' && (
              <input
                type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full bg-surface border border-white/12 rounded-md px-3 py-2 text-white text-sm
                           placeholder-white/25 focus:outline-none focus:border-brand-bright transition-colors"
              />
            )}
            {passwordMode === 'link' && (
              <p className="text-white/35 text-xs">
                Se generará un enlace de un solo uso para que la persona elija su propia contraseña.
              </p>
            )}
          </div>

          <DurationPicker choice={choice} onChoice={setChoice} date={date} onDate={setDate} />

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-2 border-t border-white/8">
            <Button type="submit" variant="primary" size="md" loading={saving} className="flex-1 justify-center">
              Crear suscriptor
            </Button>
            <Button type="button" variant="ghost" size="md" onClick={handleClose} disabled={saving}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </AdminModal>
  );
}

// ─── Modal: otorgar/extender cortesía sobre un usuario existente ────────────

function CourtesyModal({ user, onClose, onSaved }: {
  user: AdminUser | null; onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [choice, setChoice] = useState<DurationChoice>('6m');
  const [date, setDate]     = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    if (user) { setChoice('6m'); setDate(''); setError(''); }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');
    const courtesy = toCourtesyInput(choice, date);
    if (!courtesy) { setError('Elige una fecha de fin para la cortesía'); return; }

    setSaving(true);
    try {
      await apiClient.grantCourtesySubscription(user.id, courtesy);
      toast('success', `Cortesía actualizada para "${user.email}"`);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo guardar la cortesía');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminModal title="Otorgar / extender cortesía" open={!!user} onClose={onClose}>
      {user && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-white font-medium text-sm">{user.email}</p>
            {user.name && <p className="text-white/40 text-xs mt-0.5">{user.name}</p>}
            {user.source === 'courtesy' && (
              <p className="text-white/35 text-xs mt-2">
                Ya tiene una cortesía {user.period_end ? `hasta el ${fmtDate(user.period_end)}` : 'indefinida'}. Al guardar, se sustituye por la nueva duración.
              </p>
            )}
          </div>

          <DurationPicker choice={choice} onChoice={setChoice} date={date} onDate={setDate} />

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-2 border-t border-white/8">
            <Button type="submit" variant="primary" size="md" loading={saving} className="flex-1 justify-center">
              Guardar cortesía
            </Button>
            <Button type="button" variant="ghost" size="md" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </AdminModal>
  );
}

// ─── Pestañas ─────────────────────────────────────────────────────────────────

// 'with_subscription' = usuarios con cualquier suscripción (default)
// ''                  = todos sin filtro (incluye usuarios sin suscripción)
type TabKey = 'with_subscription' | 'active' | 'trialing' | 'past_due' | 'cancelled' | '';

interface Tab {
  key: TabKey;
  label: string;
  countKey: keyof UserStatusCounts | 'with_subscription';
}

const TABS: Tab[] = [
  { key: 'with_subscription', label: 'Con suscripción', countKey: 'with_subscription' },
  { key: 'active',            label: 'Activos',         countKey: 'active' },
  { key: 'trialing',          label: 'En prueba',       countKey: 'trialing' },
  { key: 'past_due',          label: 'Vencidos',        countKey: 'past_due' },
  { key: 'cancelled',         label: 'Cancelados',      countKey: 'cancelled' },
  { key: '',                  label: 'Todos',           countKey: 'total' },
];

const PAGE_SIZE = 25;

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AdminSuscriptoresPage() {
  const [users, setUsers]     = useState<AdminUser[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // Contadores de pestañas — se cargan una vez y no cambian con la búsqueda
  const [counts, setCounts]         = useState<UserStatusCounts | null>(null);
  const [countsLoading, setCountsLoading] = useState(true);

  // Filtros
  const [tab, setTab] = useState<TabKey>('with_subscription'); // default: solo con suscripción
  const [q, setQ]     = useState('');

  const [showCreate, setShowCreate]       = useState(false);
  const [courtesyUser, setCourtesyUser]   = useState<AdminUser | null>(null);

  // Carga contadores al montar
  useEffect(() => {
    apiClient.getAdminUserStats()
      .then(res => setCounts(res.counts))
      .catch(() => {/* los contadores son UI extra, no bloquean */})
      .finally(() => setCountsLoading(false));
  }, []);

  const load = useCallback(async (p: number, currentTab: TabKey, currentQ: string) => {
    setLoading(true); setError('');
    try {
      const res = await apiClient.getAdminUsers({
        status:  currentTab || undefined,   // '' → sin parámetro → todos
        q:       currentQ   || undefined,
        limit:   PAGE_SIZE,
        offset:  p * PAGE_SIZE,
      });
      setUsers(res.users);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al cargar suscriptores');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(page, tab, q); }, [load, page, tab, q]);

  const refresh = useCallback(() => {
    load(page, tab, q);
    apiClient.getAdminUserStats().then(res => setCounts(res.counts)).catch(() => null);
  }, [load, page, tab, q]);

  const handleTab = (t: TabKey) => { setTab(t); setPage(0); };
  const handleQ   = (v: string)  => { setQ(v);  setPage(0); };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[22px] font-bold text-white">Suscriptores</h1>
          <p className="text-white/45 text-sm mt-0.5">Usuarios registrados y estado de su suscripción</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Crear suscriptor
        </Button>
      </div>

      {/* Pestañas de estado */}
      <div className="flex gap-1 flex-wrap border-b border-white/8 pb-0">
        {TABS.map(t => {
          const active = tab === t.key;
          const count = counts ? counts[t.countKey as keyof UserStatusCounts] : null;
          return (
            <button
              key={t.key}
              onClick={() => handleTab(t.key)}
              className={[
                'px-3.5 py-2 text-[13px] font-medium rounded-t-md transition-all border-b-2 -mb-px',
                active
                  ? 'text-white border-brand-bright bg-white/4'
                  : 'text-white/50 border-transparent hover:text-white/80 hover:bg-white/3',
              ].join(' ')}
            >
              {t.label}
              {' '}
              <span className={[
                'text-[11px] font-semibold',
                active ? 'text-brand-bright' : 'text-white/30',
              ].join(' ')}>
                {countsLoading ? '…' : count != null ? `(${count.toLocaleString('es-ES')})` : ''}
              </span>
            </button>
          );
        })}
      </div>

      {/* Barra de búsqueda + contador */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text" value={q} onChange={e => handleQ(e.target.value)}
          placeholder="Buscar por email o nombre…"
          className="bg-surface-raised border border-white/12 rounded-md px-3 py-2 text-white text-sm
                     placeholder-white/30 focus:outline-none focus:border-brand-bright w-64 transition-colors"
        />
        </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-md px-4 py-3 text-red-400 text-sm">{error}</div>
      )}

      {/* Tabla */}
      <div className="rounded-card border border-white/8 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/4 border-b border-white/8">
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide">Usuario</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide hidden md:table-cell">Plan</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide">Estado</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide hidden lg:table-cell">Fin de período</th>
              <th className="text-left px-4 py-3 text-white/50 font-medium text-xs uppercase tracking-wide hidden xl:table-cell">Registrado</th>
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/6">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-3"><div className="h-4 w-48 rounded bg-white/8" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><div className="h-3 w-16 rounded bg-white/6" /></td>
                  <td className="px-4 py-3"><div className="h-5 w-14 rounded bg-white/8" /></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><div className="h-3 w-24 rounded bg-white/6" /></td>
                  <td className="px-4 py-3 hidden xl:table-cell"><div className="h-3 w-20 rounded bg-white/6" /></td>
                  <td className="px-4 py-3" />
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-white/40">
                {q ? 'Sin resultados para esta búsqueda.' : 'Sin usuarios en esta categoría.'}
              </td></tr>
            ) : users.map(u => (
              <tr key={u.id} className="hover:bg-white/3 transition-colors">
                <td className="px-4 py-3">
                  <div>
                    <p className="text-white font-medium text-sm">{u.email}</p>
                    {u.name && <p className="text-white/40 text-xs mt-0.5">{u.name}</p>}
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-white/60 text-xs">
                    {u.plan ? (PLAN_LABELS[u.plan] ?? u.plan) : '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={u.status} />
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-white/50 text-xs tabular-nums">
                    {u.source === 'courtesy' && !u.period_end ? 'Sin caducidad' : fmtDate(u.period_end)}
                  </span>
                </td>
                <td className="px-4 py-3 hidden xl:table-cell">
                  <span className="text-white/40 text-xs tabular-nums">{fmtDate(u.created_at)}</span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setCourtesyUser(u)}
                    title="Otorgar / extender cortesía"
                    className="p-1.5 rounded text-white/50 hover:text-white hover:bg-white/8 transition-colors"
                  >
                    <i className="ti ti-gift text-[18px]" />
                  </button>
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

      <CreateSubscriberModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={refresh}
      />
      <CourtesyModal
        user={courtesyUser}
        onClose={() => setCourtesyUser(null)}
        onSaved={refresh}
      />
    </div>
  );
}
