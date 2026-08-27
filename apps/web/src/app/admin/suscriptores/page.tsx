'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiClient, ApiError } from '@carp-partners/api-client';
import { Button, Pagination } from '@carp-partners/ui';
import type { AdminUser, AdminUserDetail, UserStatusCounts, CourtesySubscriptionInput } from '@carp-partners/api-client';
import { AdminModal } from '@/components/admin/AdminModal';
import { useToast } from '@/context/ToastContext';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
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

type SortKey = 'email' | 'plan' | 'status' | 'period_end' | 'created_at';
type SortOrder = 'asc' | 'desc';

// Cabecera de columna clicable — alterna asc/desc si ya es la columna activa,
// o pasa a esa columna en desc si se cambia de columna.
function SortableTh({
  label,
  sortKey,
  currentSort,
  currentOrder,
  onSort,
  className = '',
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  currentOrder: SortOrder;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = currentSort === sortKey;
  return (
    <th className={`text-left px-4 py-3 text-admin-text-muted font-medium text-xs uppercase tracking-wide ${className}`}>
      <button
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 transition-colors ${active ? 'text-admin-text' : 'hover:text-admin-text'}`}
      >
        {label}
        <span className={active ? 'text-brand-bright' : 'text-admin-text-tertiary'}>
          {active ? (currentOrder === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}

// Para las cortesías, "status" se fija a 'active' al otorgarlas y no se
// vuelve a tocar nunca (no hay webhook que las revise, a diferencia de las
// de Stripe) — así que puede seguir diciendo "Activo" mucho después de que
// period_end haya pasado y el usuario ya no tenga acceso real. Este badge
// deriva la etiqueta "Cortesía vencida"/"Cortesía activa" a partir de la
// fecha, puramente en la vista — no escribe ni cambia el campo status.
function StatusBadge({
  status,
  source,
  plan,
  periodEnd,
}: {
  status: string | null;
  source?: 'stripe' | 'courtesy' | null;
  plan?: string | null;
  periodEnd?: string | null;
}) {
  if (!status) return <span className="text-admin-text-tertiary text-xs">—</span>;

  const isCourtesy = source === 'courtesy';
  // Puente para clientes de Stripe reales cuya Subscription todavía no
  // existe (solo un Schedule futuro) — se distingue de una cortesía-regalo
  // real por tener un plan de pago normal en vez de plan='courtesy'.
  const isStripeBridge = isCourtesy && plan !== 'courtesy';
  const expired = isCourtesy && !!periodEnd && new Date(periodEnd) < new Date();

  const label = isStripeBridge
    ? (expired ? 'Stripe · vencido' : 'Stripe · pendiente de activar')
    : isCourtesy
      ? (expired ? 'Cortesía vencida' : 'Cortesía activa')
      : (STATUS_LABELS[status] ?? status);

  const cls = expired
    ? 'bg-[#fdecea] text-[#c0392b]'
    : {
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

// ─── Popup de detalle del suscriptor ───────────────────────────────────────────

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  succeeded: 'Cobrado',
  pending:   'Pendiente',
  failed:    'Fallido',
};

function DetailTable({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-admin-border overflow-hidden overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-admin-thead border-b border-admin-border">{head}</tr>
        </thead>
        <tbody className="divide-y divide-admin-border-soft">{children}</tbody>
      </table>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3 py-2 text-admin-text-muted font-medium uppercase tracking-wide whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  );
}

// Popup lateral con el historial completo de un suscriptor concreto: TODAS
// sus filas de subscriptions (no solo la vigente, a diferencia de la tabla
// principal), sus cargos reales de Stripe, y su último inicio de sesión —
// no hay tabla de histórico de sesiones, solo el último momento registrado
// (users.last_login_at), así que se muestra tal cual, sin inventar más.
function SubscriberDetailModal({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const [detail, setDetail]   = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!userId) { setDetail(null); return; }
    setDetail(null); setLoading(true); setError('');
    apiClient.getAdminUserDetail(userId)
      .then(setDetail)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'No se pudo cargar el detalle'))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <AdminModal theme="light" title="Detalle del suscriptor" open={!!userId} onClose={onClose} maxWidth="max-w-2xl">
      {loading ? (
        <p className="text-admin-text-tertiary text-sm py-10 text-center">Cargando…</p>
      ) : error ? (
        <p className="text-[#c0392b] text-sm bg-[#fdecea] border border-[#f7cfc9] rounded px-3 py-2">{error}</p>
      ) : detail ? (
        <div className="space-y-6">
          <div>
            <p className="text-admin-text font-semibold text-[15px]">{detail.user.email}</p>
            {detail.user.name && <p className="text-admin-text-muted text-xs mt-0.5">{detail.user.name}</p>}
          </div>

          <div>
            <h3 className="text-admin-text font-semibold text-sm mb-2">Historial de membresía</h3>
            {detail.subscriptions.length === 0 ? (
              <p className="text-admin-text-tertiary text-xs">Sin ninguna suscripción registrada.</p>
            ) : (
              <DetailTable head={<>
                <Th>Plan</Th><Th>Tipo</Th><Th>Inicio</Th><Th>Caducidad</Th><Th right>Importe</Th><Th>Creado</Th>
              </>}>
                {detail.subscriptions.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2 text-admin-text whitespace-nowrap">{s.plan ? (PLAN_LABELS[s.plan] ?? s.plan) : '—'}</td>
                    <td className="px-3 py-2 text-admin-text-secondary whitespace-nowrap">{s.source === 'stripe' ? 'Stripe' : 'Cortesía'}</td>
                    <td className="px-3 py-2 text-admin-text-secondary tabular-nums whitespace-nowrap">{fmtDate(s.periodStart)}</td>
                    <td className="px-3 py-2 text-admin-text-secondary tabular-nums whitespace-nowrap">{s.periodEnd ? fmtDate(s.periodEnd) : 'Sin caducidad'}</td>
                    <td className="px-3 py-2 text-right text-admin-text tabular-nums whitespace-nowrap">{s.amount != null ? `${s.amount.toFixed(2)} €` : '—'}</td>
                    <td className="px-3 py-2 text-admin-text-tertiary tabular-nums whitespace-nowrap">{fmtDate(s.createdAt)}</td>
                  </tr>
                ))}
              </DetailTable>
            )}
          </div>

          <div>
            <h3 className="text-admin-text font-semibold text-sm mb-2">Historial de pagos</h3>
            {!detail.user.stripeCustomerId ? (
              <p className="text-admin-text-tertiary text-xs">Sin cliente de Stripe asociado.</p>
            ) : detail.payments.length === 0 ? (
              <p className="text-admin-text-tertiary text-xs">Sin cargos registrados en Stripe.</p>
            ) : (
              <DetailTable head={<><Th>Fecha</Th><Th right>Importe</Th><Th>Estado</Th></>}>
                {detail.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 text-admin-text-secondary tabular-nums whitespace-nowrap">{fmtDateTime(p.created)}</td>
                    <td className="px-3 py-2 text-right text-admin-text tabular-nums whitespace-nowrap">
                      {(p.amount / 100).toLocaleString('es-ES', { style: 'currency', currency: p.currency.toUpperCase() })}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {p.refunded ? 'Reembolsado' : (PAYMENT_STATUS_LABELS[p.status] ?? p.status)}
                    </td>
                  </tr>
                ))}
              </DetailTable>
            )}
          </div>

          <div>
            <h3 className="text-admin-text font-semibold text-sm mb-2">Historial de inicio de sesión</h3>
            {detail.loginHistory.length === 0 ? (
              <p className="text-admin-text-tertiary text-xs">Nunca ha iniciado sesión.</p>
            ) : (
              <DetailTable head={<><Th>Fecha</Th><Th>País</Th><Th>IP</Th><Th>Navegador</Th></>}>
                {detail.loginHistory.map((l, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-admin-text-secondary tabular-nums whitespace-nowrap">{fmtDateTime(l.loggedInAt)}</td>
                    <td className="px-3 py-2 text-admin-text-secondary whitespace-nowrap">{l.country ?? '—'}</td>
                    <td className="px-3 py-2 text-admin-text-secondary tabular-nums whitespace-nowrap">{l.ipAddress ?? '—'}</td>
                    <td className="px-3 py-2 text-admin-text-tertiary whitespace-nowrap" title={l.userAgent ?? undefined}>
                      {l.browser ?? '—'}
                    </td>
                  </tr>
                ))}
              </DetailTable>
            )}
          </div>
        </div>
      ) : null}
    </AdminModal>
  );
}

// ─── Pestañas ─────────────────────────────────────────────────────────────────

// 'with_subscription' = usuarios con cualquier suscripción (excluye admins)
// 'courtesy'          = filtra por source='courtesy', no es un status real (excluye admins)
// 'admin'             = filtra por role='admin' — única pestaña que SÍ los incluye
// ''                  = todos sin filtro (incluye admins y usuarios sin suscripción)
type TabKey = 'active' | 'past_due' | 'cancelled' | 'courtesy' | 'admin' | 'with_subscription' | 'no_plan' | '';

interface Tab {
  key: TabKey;
  label: string;
  countKey: keyof UserStatusCounts | 'with_subscription';
}

const TABS: Tab[] = [
  { key: 'active',            label: 'Activos',         countKey: 'active' },
  { key: 'past_due',          label: 'Vencidos',        countKey: 'past_due' },
  { key: 'cancelled',         label: 'Cancelados',      countKey: 'cancelled' },
  { key: 'courtesy',          label: 'Cortesía',        countKey: 'courtesy' },
  { key: 'admin',             label: 'Administradores', countKey: 'admin' },
  { key: 'with_subscription', label: 'Con suscripción', countKey: 'with_subscription' },
  { key: 'no_plan',           label: 'Sin plan',        countKey: 'no_plan' },
  { key: '',                  label: 'Todos',           countKey: 'total' },
];

const PAGE_SIZE = 25;

// ─── Página ───────────────────────────────────────────────────────────────────

export default function AdminSuscriptoresPage() {
  const searchParams = useSearchParams();
  const [users, setUsers]     = useState<AdminUser[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // Contadores de pestañas — se cargan una vez y no cambian con la búsqueda
  const [counts, setCounts]         = useState<UserStatusCounts | null>(null);
  const [countsLoading, setCountsLoading] = useState(true);

  // Filtros — tab admite un valor inicial por URL (?tab=active), para poder
  // enlazar aquí ya filtrado desde el dashboard.
  const [tab, setTab] = useState<TabKey>(() => {
    const fromUrl = searchParams.get('tab');
    return (TABS.some((t) => t.key === fromUrl) ? (fromUrl as TabKey) : 'active');
  });
  const [q, setQ]     = useState('');
  const [sort, setSort]   = useState<SortKey>('created_at');
  const [order, setOrder] = useState<SortOrder>('desc');

  const [showCreate, setShowCreate]       = useState(false);
  const [courtesyUser, setCourtesyUser]   = useState<AdminUser | null>(null);
  const [detailUserId, setDetailUserId]   = useState<string | null>(null);

  // Carga contadores al montar
  useEffect(() => {
    apiClient.getAdminUserStats()
      .then(res => setCounts(res.counts))
      .catch(() => {/* los contadores son UI extra, no bloquean */})
      .finally(() => setCountsLoading(false));
  }, []);

  const load = useCallback(async (p: number, currentTab: TabKey, currentQ: string, currentSort: SortKey, currentOrder: SortOrder) => {
    setLoading(true); setError('');
    try {
      const res = await apiClient.getAdminUsers({
        status:  currentTab || undefined,   // '' → sin parámetro → todos
        q:       currentQ   || undefined,
        limit:   PAGE_SIZE,
        offset:  p * PAGE_SIZE,
        sort:    currentSort,
        order:   currentOrder,
      });
      setUsers(res.users);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Error al cargar suscriptores');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(page, tab, q, sort, order); }, [load, page, tab, q, sort, order]);

  const refresh = useCallback(() => {
    load(page, tab, q, sort, order);
    apiClient.getAdminUserStats().then(res => setCounts(res.counts)).catch(() => null);
  }, [load, page, tab, q, sort, order]);

  const handleTab = (t: TabKey) => { setTab(t); setPage(0); };
  const handleQ   = (v: string)  => { setQ(v);  setPage(0); };
  const handleSort = (key: SortKey) => {
    if (key === sort) setOrder(o => (o === 'asc' ? 'desc' : 'asc'));
    else { setSort(key); setOrder('desc'); }
    setPage(0);
  };

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
              <SortableTh label="Usuario" sortKey="email" currentSort={sort} currentOrder={order} onSort={handleSort} />
              <SortableTh label="Plan" sortKey="plan" currentSort={sort} currentOrder={order} onSort={handleSort} className="hidden md:table-cell" />
              <SortableTh label="Estado" sortKey="status" currentSort={sort} currentOrder={order} onSort={handleSort} />
              <SortableTh label="Fin de período" sortKey="period_end" currentSort={sort} currentOrder={order} onSort={handleSort} className="hidden lg:table-cell" />
              <SortableTh label="Creación" sortKey="created_at" currentSort={sort} currentOrder={order} onSort={handleSort} className="hidden xl:table-cell" />
              <th className="px-4 py-3 w-24" />
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
                  <StatusBadge status={u.status} source={u.source} plan={u.plan} periodEnd={u.period_end} />
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <span className={[
                    'text-xs tabular-nums',
                    u.period_end && new Date(u.period_end) < new Date() ? 'text-[#c0392b] font-semibold' : 'text-admin-text-secondary',
                  ].join(' ')}>
                    {u.source === 'courtesy' && !u.period_end ? 'Sin caducidad' : fmtDate(u.period_end)}
                  </span>
                </td>
                <td className="px-4 py-3 hidden xl:table-cell">
                  <span className="text-admin-text-muted text-xs tabular-nums">{fmtDate(u.created_at)}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setDetailUserId(u.id)}
                      title="Ver detalle del suscriptor"
                      className="p-1.5 rounded text-admin-text-secondary hover:text-admin-text hover:bg-admin-hover transition-colors"
                    >
                      <i className="ti ti-info-circle text-[18px]" />
                    </button>
                    <button
                      onClick={() => setCourtesyUser(u)}
                      title="Otorgar / extender cortesía"
                      className="p-1.5 rounded text-admin-text-secondary hover:text-admin-text hover:bg-admin-hover transition-colors"
                    >
                      <i className="ti ti-gift text-[18px]" />
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
      <SubscriberDetailModal
        userId={detailUserId}
        onClose={() => setDetailUserId(null)}
      />
    </div>
  );
}
