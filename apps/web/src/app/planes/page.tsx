'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from '@/context/SessionContext';

const PERKS = [
  'Catálogo completo sin límites',
  'Estrenos cada semana',
  'Calidad hasta 4K UHD',
  'Sin anuncios, sin permanencia',
  'Web, iOS y Android',
];

// ─── Modal "pago próximamente" ────────────────────────────────────────────────

function ComingSoonModal({ plan, onClose }: { plan: 'mensual' | 'anual'; onClose: () => void }) {
  const price = plan === 'mensual' ? '9,99€/mes' : '89,99€/año';
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[420px] rounded-[20px] p-[36px_32px] text-center"
        style={{
          background: '#0e151a',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Icono */}
        <div
          className="flex items-center justify-center rounded-full mx-auto mb-5"
          style={{ width: 60, height: 60, background: 'rgba(104,20,11,0.15)', border: '1px solid rgba(207,74,53,0.3)' }}
        >
          <i className="ti ti-credit-card text-[28px]" style={{ color: '#cf4a35' }} />
        </div>

        <h2 className="font-display font-bold text-white mb-2" style={{ fontSize: 20 }}>
          Integración de pago en desarrollo
        </h2>
        <p className="text-[14px] leading-[1.6] mb-1" style={{ color: '#9aa9a3' }}>
          Has seleccionado el plan <strong style={{ color: '#eef3f0' }}>{plan === 'mensual' ? 'Mensual' : 'Anual'}</strong> ({price}).
        </p>
        <p className="text-[14px] leading-[1.6] mb-6" style={{ color: '#9aa9a3' }}>
          El pasarela de pago con Stripe estará disponible muy pronto. Tu cuenta ya está creada y lista para cuando se active.
        </p>

        <button
          onClick={onClose}
          className="w-full py-[13px] rounded-[10px] font-semibold text-[14.5px] text-white transition-opacity hover:opacity-80"
          style={{ background: '#68140b', border: 'none', cursor: 'pointer' }}
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

function PlanesContent() {
  const { status, hasSubscription, user, logout } = useSession();
  const router   = useRouter();
  const params   = useSearchParams();
  const bienvenido = params.get('bienvenido') === '1';

  const [modal, setModal] = useState<'mensual' | 'anual' | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'authenticated' && hasSubscription) {
      router.replace('/home');
    }
  }, [status, hasSubscription, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#06090c' }}>
        <svg className="animate-spin w-9 h-9" viewBox="0 0 24 24" fill="none" style={{ color: '#68140b' }}>
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  // Si no hay sesión, los botones redirigen a registro
  // Si hay sesión sin sub, los botones muestran modal (Stripe pendiente)
  const handlePlan = (plan: 'mensual' | 'anual') => {
    if (status === 'authenticated') {
      setModal(plan);
    } else {
      router.push('/login?mode=register');
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: '#06090c', fontFamily: 'Inter, sans-serif', color: '#e9efeb' }}
    >
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(120% 60% at 50% 0%, #1a0e0c 0%, rgba(26,14,12,0) 60%)' }}
      />

      {/* Modal */}
      {modal && <ComingSoonModal plan={modal} onClose={() => setModal(null)} />}

      {/* Header */}
      <header className="relative flex items-center px-6 md:px-14 py-6">
        <Image
          src="/logo.png"
          alt="Carp Partners TV"
          width={110} height={19}
          className="h-6 w-auto cursor-pointer"
          onClick={() => router.push('/')}
        />
        <div className="flex-1" />
        {status === 'authenticated' ? (
          <div className="flex items-center gap-5">
            <button
              onClick={() => router.push('/')}
              className="text-[13px] transition-colors hover:text-white"
              style={{ color: '#9aa9a3', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Volver al inicio
            </button>
            <button
              onClick={async () => { await logout(); router.replace('/login'); }}
              className="flex items-center gap-[6px] text-[13px] transition-colors hover:text-white"
              style={{ color: '#9aa9a3', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <i className="ti ti-logout text-[16px]" />
              Cerrar sesión
            </button>
          </div>
        ) : (
          <Link href="/login" className="text-[13px] transition-colors hover:text-white" style={{ color: '#9aa9a3' }}>
            Iniciar sesión
          </Link>
        )}
      </header>

      {/* Contenido */}
      <main className="relative px-6 md:px-14 pt-4 pb-20">
        <div className="max-w-[920px] mx-auto">

          {/* Banner contextual */}
          {bienvenido ? (
            <div
              className="flex items-start gap-3 px-5 py-4 rounded-[14px] mb-10"
              style={{ background: 'rgba(62,157,107,0.12)', border: '1px solid rgba(62,157,107,0.3)' }}
            >
              <i className="ti ti-circle-check-filled text-[22px] mt-0.5 shrink-0" style={{ color: '#3e9d6b' }} />
              <div>
                <p className="font-semibold text-[15px]" style={{ color: '#eef3f0' }}>
                  ¡Cuenta creada correctamente{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
                </p>
                <p className="text-[13.5px] mt-0.5" style={{ color: '#9aa9a3' }}>
                  Elige un plan para empezar a ver el contenido.
                </p>
              </div>
            </div>
          ) : (
            <div
              className="flex items-start gap-3 px-5 py-4 rounded-[14px] mb-10"
              style={{ background: 'rgba(104,20,11,0.12)', border: '1px solid rgba(207,74,53,0.25)' }}
            >
              <i className="ti ti-lock text-[20px] mt-0.5 shrink-0" style={{ color: '#cf4a35' }} />
              <div>
                <p className="font-semibold text-[15px]" style={{ color: '#eef3f0' }}>
                  Necesitas una suscripción para acceder al contenido
                </p>
                <p className="text-[13.5px] mt-0.5" style={{ color: '#9aa9a3' }}>
                  Elige el plan que mejor te encaje. Cancela cuando quieras.
                </p>
              </div>
            </div>
          )}

          {/* Cabecera */}
          <div className="text-center mb-10">
            <h1
              className="font-display font-bold text-white"
              style={{ fontSize: 'clamp(26px,4vw,38px)', letterSpacing: '-0.02em' }}
            >
              Elige cómo quieres ver
            </h1>
            <p className="mt-2 text-[15px]" style={{ color: '#9aa9a3' }}>
              Acceso completo al catálogo · Sin permanencia · Cancela cuando quieras
            </p>
          </div>

          {/* Tarjetas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[22px]">

            {/* Mensual */}
            <div
              className="p-[36px_32px] rounded-[18px]"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="font-display font-semibold text-[20px] mb-2" style={{ color: '#eef3f0' }}>Mensual</div>
              <div className="text-[13.5px] mb-[22px]" style={{ color: '#85958e' }}>
                Facturación mensual · Cancela cuando quieras
              </div>
              <div className="flex items-baseline gap-1.5 mb-[26px]">
                <span className="font-display font-extrabold text-white" style={{ fontSize: 46, letterSpacing: '-0.02em' }}>9,99€</span>
                <span className="text-[14px]" style={{ color: '#85958e' }}>/ mes</span>
              </div>
              <PlanButton primary={false} onClick={() => handlePlan('mensual')}>
                Empezar con mensual
              </PlanButton>
              {PERKS.map(p => (
                <div key={p} className="flex items-center gap-[11px] py-2 text-[14px]" style={{ color: '#b3c0ba' }}>
                  <i className="ti ti-check text-[18px]" style={{ color: '#6a7a73' }} />{p}
                </div>
              ))}
            </div>

            {/* Anual */}
            <div
              className="relative p-[36px_32px] rounded-[18px]"
              style={{
                background: 'linear-gradient(165deg, rgba(104,20,11,0.16), rgba(104,20,11,0.04))',
                border: '1.5px solid rgba(207,74,53,0.45)',
                boxShadow: '0 20px 60px rgba(104,20,11,0.2)',
              }}
            >
              <div
                className="absolute -top-[13px] right-7 px-[14px] py-[5px] rounded-[20px] text-white text-[11.5px] font-bold tracking-[0.04em]"
                style={{ background: '#68140b' }}
              >
                RECOMENDADO
              </div>
              <div className="font-display font-semibold text-[20px] text-white mb-2">Anual</div>
              <div className="text-[13.5px] mb-[22px]" style={{ color: '#c4d0cb' }}>
                Facturado una vez al año · Sin permanencia
              </div>
              <div className="flex items-baseline gap-1.5 mb-1.5">
                <span className="font-display font-extrabold text-white" style={{ fontSize: 46, letterSpacing: '-0.02em' }}>89,99€</span>
                <span className="text-[14px]" style={{ color: '#c4d0cb' }}>/ año</span>
              </div>
              <div className="text-[13px] mb-6" style={{ color: '#e3bd72' }}>
                Equivale a 7,50€/mes · Ahorras ~30€/año
              </div>
              <PlanButton primary onClick={() => handlePlan('anual')}>
                Empezar con anual
              </PlanButton>
              {PERKS.map(p => (
                <div key={p} className="flex items-center gap-[11px] py-2 text-[14px]" style={{ color: '#e9efeb' }}>
                  <i className="ti ti-check text-[18px]" style={{ color: '#cf4a35' }} />{p}
                </div>
              ))}
            </div>
          </div>

          <p className="text-center mt-6 text-[12.5px]" style={{ color: '#6a7a73' }}>
            Pago seguro con tarjeta vía Stripe · Sin permanencia · Cancela en un clic
          </p>
        </div>
      </main>
    </div>
  );
}

// ─── Botón de plan ────────────────────────────────────────────────────────────

function PlanButton({ primary, onClick, children }: { primary: boolean; onClick: () => void; children: React.ReactNode }) {
  const base = 'block w-full text-center py-[13px] rounded-[10px] font-semibold text-[14.5px] mb-[26px] transition-all cursor-pointer';
  if (primary) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={base + ' hover:scale-[1.02]'}
        style={{ background: '#68140b', color: '#fff', boxShadow: '0 8px 24px rgba(104,20,11,0.5)', border: 'none', width: '100%' }}
      >
        {children}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={base + ' hover:bg-white/10'}
      style={{ border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.06)', color: '#fff', width: '100%' }}
    >
      {children}
    </button>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function PlanesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: '#06090c' }} />}>
      <PlanesContent />
    </Suspense>
  );
}
