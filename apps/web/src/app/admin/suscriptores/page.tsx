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
  if (!status) return <span className="text-admin-text-tertiary text-xs">—</span>;
  const label = STATUS_LABELS[status] ?? status;
  const cls = {
    active:    'bg-[#e7f6ed] text-[#1a8a4a]',
    trialing:  'bg-[#fef3e2] text-[#b45309]',
    past_due:  'bg-[#fdeee0] text-[#c2650a]',
    cancelled: 'bg-admin-border-soft text-admin-text-muted',
  }[status] ?? 'bg-admin-border-soft text-admin-text-muted';
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
      <label className="block text-xs font-medium text-admin-text-secondary uppercase tracking-wide">Duración de la cortesía</label>
      <div className="grid grid-cols-2 gap-2">
        {options.map(o => (
          <button
            key={o.key}
            type="button"
            onClick={() => onChoice(o.key)}
            className="px-3 py-2 rounded-md text-[13px] font-medium text-left transition-colors"
            style={{
              background: choice === o.key ? '#fbebe8' : '#fff',
              border: `1px solid ${choice === o.key ? '#68140b' : '#dfe2e6'}`,
              color: choice === o.key ? '#68140b' : '#5a6169',
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
          className="w-full bg-white border border-admin-input-border rounded-md px-3 py-2 text-admin-text text-sm
                     focus:outline-none focus:border-brand-bright transition-colors [color-scheme:light]"
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
    <AdminModal
      theme="light"
      title="Crear suscriptor"
      open={open}
      onClose={handleClose}
      footer={
        link ? (
          <Button theme="light" variant="primary" size="md" onClick={handleClose} className="w-full justify-center">Cerrar</Button>
        ) : (
          <>
            {error && (
              <p className="text-[#c0392b] text-sm bg-[#fdecea] border border-[#f7cfc9] rounded px-3 py-2 mb-3">{error}</p>
            )}
            <div className="flex gap-3">
              <Button theme="light" type="submit" form="create-subscriber-form" variant="primary" size="md" loading={saving} className="flex-1 justify-center">
                Crear suscriptor
              </Button>
              <Button theme="light" type="button" variant="ghost" size="md" onClick={handleClose} disabled={saving}>
                Cancelar
              </Button>
            </div>
          </>
        )
      }
    >
      {link ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[#1a8a4a] text-sm font-medium">
            <i className="ti ti-circle-check-filled text-[18px]" />
            Suscriptor creado
          </div>
          <p className="text-admin-text-secondary text-sm">
            Comparte este enlace para que la persona establezca su contraseña. Caduca en 14 días.
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={link}
              className="flex-1 bg-white border border-admin-input-border rounded-md px-3 py-2 text-admin-text-secondary text-xs font-mono"
              onFocus={e => e.target.select()}
            />
            <Button theme="light" variant="ghost" size="sm" onClick={copyLink}>
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
        </div>
      ) : (
        <form id="create-subscriber-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-medium text-admin-text-secondary uppercase tracking-wide">Email *</label>
            <input
              type="email" required value={email} onChange={e => setEmail(e.target.value)}
              placeholder="persona@ejemplo.com"
              className="w-full bg-white border border-admin-input-border rounded-md px-3 py-2 text-admin-text text-sm
                         placeholder-admin-text-tertiary focus:outline-none focus:border-brand-bright transition-colors"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-admin-text-secondary uppercase tracking-wide">Nombre</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Nombre completo"
              className="w-full bg-white border border-admin-input-border rounded-md px-3 py-2 text-admin-text text-sm
                         placeholder-admin-text-tertiary focus:outline-none focus:border-brand-bright transition-colors"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-admin-text-secondary uppercase tracking-wide">Contraseña</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPasswordMode('link')}
                className="flex-1 px-3 py-2 rounded-md text-[13px] font-medium transition-colors"
                style={{
                  background: passwordMode === 'link' ? '#fbebe8' : '#fff',
                  border: `1px solid ${passwordMode === 'link' ? '#68140b' : '#dfe2e6'}`,
                  color: passwordMode === 'link' ? '#68140b' : '#5a6169',
                }}
              >
                Generar enlace
              </button>
              <button type="button" onClick={() => setPasswordMode('password')}
                className="flex-1 px-3 py-2 rounded-md text-[13px] font-medium transition-colors"
                style={{
                  background: passwordMode === 'password' ? '#fbebe8' : '#fff',
                  border: `1px solid ${passwordMode === 'password' ? '#68140b' : '#dfe2e6'}`,
                  color: passwordMode === 'password' ? '#68140b' : '#5a6169',
                }}
              >
                Establecerla ahora
              </button>
            </div>
            {passwordMode === 'password' && (
              <input
                type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full bg-white border border-admin-input-border rounded-md px-3 py-2 text-admin-text text-sm
                           placeholder-admin-text-tertiary focus:outline-none focus:border-brand-bright transition-colors"
              />
            )}
            {passwordMode === 'link' && (
              <p className="text-admin-text-tertiary text-xs">
                Se generará un enlace de un solo uso para que la persona elija su propia contraseña.
              </p>
            )}
          </div>

          <DurationPicker choice={choice} onChoice={setChoice} date={date} onDate={setDate} />
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
    <AdminModal
      theme="light"
      title="Otorgar / extender cortesía"
      open={!!user}
      onClose={onClose}
      footer={
        user ? (
          <>
            {error && (
              <p className="text-[#c0392b] text-sm bg-[#fdecea] border border-[#f7cfc9] rounded px-3 py-2 mb-3">{error}</p>
            )}
            <div className="flex gap-3">
              <Button theme="light" type="submit" form="courtesy-form" variant="primary" size="md" loading={saving} className="flex-1 justify-center">
                Guardar cortesía
              </Button>
              <Button theme="light" type="button" variant="ghost" size="md" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
            </div>
          </>
        ) : undefined
      }
    >
      {user && (
        <form id="courtesy-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-admin-text font-medium text-sm">{user.email}</p>
            {user.name && <p className="text-admin-text-muted text-xs mt-0.5">{user.name}</p>}
            {user.source === 'courtesy' && (
              <p className="text-admin-text-tertiary text-xs mt-2">
                Ya tiene una cortesía {user.period_end ? `hasta el ${fmtDate(user.period_end)}` : 'indefinida'}. Al guardar, se sustituye por la nueva duración.
              </p>
            )}
          </div>

          <DurationPicker choice={choice} onChoice={setChoice} date={date} onDate={setDate} />
        </form>
      )}
    </AdminModal>
  );
}

// ─── Pestañas ─────────────────────────────────────────────────────────────────

// 'with_subscription' = usuarios con cualquier suscripción (default)
// 'courtesy'          = filtra por source='courtesy', no es un status real
// ''                  = todos sin filtro (incluye usuarios sin suscripción)
type TabKey = 'with_subscription' | 'active' | 'courtesy' | 'past_due' | 'cancelled' | '';

interface Tab {
  key: TabKey;
  label: string;
  countKey: keyof UserStatusCounts | 'with_subscription';
}

const TABS: Tab[] = [
  { key: 'with_subscription', label: 'Con suscripción', countKey: 'with_subscription' },
  { key: 'active',            label: 'Activos',         countKey: 'active' },
  { key: 'courtesy',          label: 'Cortesía',        countKey: 'courtesy' },
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
          <h1 className="font-display text-[22px] font-bold text-admin-text">Suscriptores</h1>
          <p className="text-admin-text-secondary text-sm mt-0.5">Usuarios registrados y estado de su suscripción</p>
        </div>
        <Button theme="light" variant="primary" size="sm" onClick={() => setShowCreate(true)}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Crear suscriptor
        </Button>
      </div>

      {/* Pestañas de estado */}
      <div className="flex gap-1 flex-wrap border-b border-admin-border pb-0">
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
                  ? 'text-admin-text border-brand-bright bg-admin-thead'
                  : 'text-admin-text-secondary border-transparent hover:text-admin-text hover:bg-admin-hover',
              ].join(' ')}
            >
              {t.label}
              {' '}
              <span className={[
                'text-[11px] font-semibold',
                active ? 'text-brand-bright' : 'text-admin-text-tertiary',
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
          className="bg-white border border-admin-input-border rounded-md px-3 py-2 text-admin-text text-sm
                     placeholder-admin-text-tertiary focus:outline-none focus:border-brand-bright w-64 transition-colors"
        />
        </div>

      {error && (
        <div className="bg-[#fdecea] border border-[#f7cfc9] rounded-md px-4 py-3 text-[#c0392b] text-sm">{error}</div>
      )}

      {/* Tabla */}
      <div className="rounded-admin-card border border-admin-border overflow-hidden bg-admin-surface shadow-admin-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-admin-thead border-b border-admin-border">
              <th className="text-left px-4 py-3 text-admin-text-muted font-medium text-xs uppercase tracking-wide">Usuario</th>
              <th className="text-left px-4 py-3 text-admin-text-muted font-medium text-xs uppercase tracking-wide hidden md:table-cell">Plan</th>
              <th className="text-left px-4 py-3 text-admin-text-muted font-medium text-xs uppercase tracking-wide">Estado</th>
              <th className="text-left px-4 py-3 text-admin-text-muted font-medium text-xs uppercase tracking-wide hidden lg:table-cell">Fin de período</th>
              <th className="text-left px-4 py-3 text-admin-text-muted font-medium text-xs uppercase tracking-wide hidden xl:table-cell">Registrado</th>
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-admin-border-soft">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-3"><div className="h-4 w-48 rounded bg-admin-border-soft" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><div className="h-3 w-16 rounded bg-admin-border-soft" /></td>
                  <td className="px-4 py-3"><div className="h-5 w-14 rounded bg-admin-border-soft" /></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><div className="h-3 w-24 rounded bg-admin-border-soft" /></td>
                  <td className="px-4 py-3 hidden xl:table-cell"><div className="h-3 w-20 rounded bg-admin-border-soft" /></td>
                  <td className="px-4 py-3" />
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-admin-text-tertiary">
                {q ? 'Sin resultados para esta búsqueda.' : 'Sin usuarios en esta categoría.'}
              </td></tr>
            ) : users.map(u => (
              <tr key={u.id} className="hover:bg-admin-hover transition-colors">
                <td className="px-4 py-3">
                  <div>
                    <p className="text-admin-text font-medium text-sm">{u.email}</p>
                    {u.name && <p className="text-admin-text-muted text-xs mt-0.5">{u.name}</p>}
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-admin-text-secondary text-xs">
                    {u.plan ? (PLAN_LABELS[u.plan] ?? u.plan) : '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={u.status} />
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className="text-admin-text-secondary text-xs tabular-nums">
                    {u.source === 'courtesy' && !u.period_end ? 'Sin caducidad' : fmtDate(u.period_end)}
                  </span>
                </td>
                <td className="px-4 py-3 hidden xl:table-cell">
                  <span className="text-admin-text-muted text-xs tabular-nums">{fmtDate(u.created_at)}</span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setCourtesyUser(u)}
                    title="Otorgar / extender cortesía"
                    className="p-1.5 rounded text-admin-text-secondary hover:text-admin-text hover:bg-admin-hover transition-colors"
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
        theme="light"
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
