'use client';

import React from 'react';
import { useSession } from '@/context/SessionContext';
import { apiClient } from '@carp-partners/api-client';
import { Button } from '@carp-partners/ui';

export default function PerfilPage() {
  const { user, subscription, logout } = useSession();

  const openBillingPortal = async () => {
    try {
      const { url } = await apiClient.getBillingPortal();
      window.location.href = url;
    } catch {
      alert('No se pudo abrir el portal de facturación.');
    }
  };

  return (
    <div className="min-h-screen bg-surface px-6 md:px-12 py-10 max-w-xl mx-auto">
      <h1 className="text-white text-3xl font-bold mb-8">Mi perfil</h1>

      {/* Datos del usuario */}
      <section className="bg-surface-raised rounded-xl p-6 mb-6">
        <div className="w-14 h-14 rounded-full bg-brand flex items-center justify-center text-2xl font-bold text-white mb-4 uppercase">
          {user?.name?.[0] ?? user?.email[0]}
        </div>
        <p className="text-white font-semibold text-lg">{user?.name ?? '—'}</p>
        <p className="text-white/50 text-sm">{user?.email}</p>
      </section>

      {/* Suscripción */}
      <section className="bg-surface-raised rounded-xl p-6 mb-6">
        <h2 className="text-white font-semibold mb-3">Suscripción</h2>
        {subscription ? (
          <div className="space-y-2 text-sm">
            <Row label="Plan" value={subscription.plan === 'annual' ? 'Anual' : 'Mensual'} />
            <Row label="Estado" value={subscription.status} />
            {subscription.period_end && (
              <Row
                label="Próxima renovación"
                value={new Date(subscription.period_end).toLocaleDateString('es-ES')}
              />
            )}
          </div>
        ) : (
          <p className="text-white/40 text-sm">Sin suscripción activa.</p>
        )}
        {user?.stripe_customer_id && (
          <Button
            variant="outline"
            size="sm"
            onClick={openBillingPortal}
            className="mt-4"
          >
            Gestionar suscripción →
          </Button>
        )}
      </section>

      {/* Cerrar sesión */}
      <Button variant="ghost" size="md" onClick={logout} className="w-full">
        Cerrar sesión
      </Button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-white/50">{label}</span>
      <span className="text-white capitalize">{value}</span>
    </div>
  );
}
