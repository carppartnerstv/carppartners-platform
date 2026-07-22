'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';

// El acceso lo activa el webhook de Stripe (checkout.session.completed /
// customer.subscription.created), no este redirect — puede tardar unos
// segundos en llegar. Aquí hacemos polling corto a /auth/me hasta ver la
// suscripción activa, en vez de asumir que ya lo está.
const POLL_INTERVAL_MS = 1500;
const MAX_ATTEMPTS = 8; // ~12s de espera antes de mostrar el aviso de "tarda más de lo normal"

export default function PlanActivadaPage() {
  const { status, hasSubscription, refresh } = useSession();
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') { router.replace('/login'); return; }
    if (hasSubscription) { router.replace('/home'); return; }
    if (attempts >= MAX_ATTEMPTS) { setTimedOut(true); return; }

    const timer = setTimeout(async () => {
      try { await refresh(); } catch { /* seguimos reintentando igualmente */ }
      setAttempts((a) => a + 1);
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [status, hasSubscription, attempts, refresh, router]);

  const retry = () => { setTimedOut(false); setAttempts(0); };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: '#06090c', fontFamily: 'Inter, sans-serif' }}
    >
      <div
        className="w-full max-w-[440px] rounded-[20px] p-[40px_32px] text-center"
        style={{ background: '#0e151a', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        {!timedOut ? (
          <>
            <svg className="animate-spin w-11 h-11 mx-auto mb-6" viewBox="0 0 24 24" fill="none" style={{ color: '#cf4a35' }}>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <h1 className="font-display font-bold text-white mb-2" style={{ fontSize: 21 }}>
              Confirmando tu pago…
            </h1>
            <p className="text-[14px] leading-[1.6]" style={{ color: '#9aa9a3' }}>
              Stripe ya ha procesado el cobro. En unos segundos activamos tu acceso automáticamente — no cierres esta pantalla.
            </p>
          </>
        ) : (
          <>
            <div
              className="flex items-center justify-center rounded-full mx-auto mb-5"
              style={{ width: 56, height: 56, background: 'rgba(104,20,11,0.15)', border: '1px solid rgba(207,74,53,0.3)' }}
            >
              <i className="ti ti-clock text-[26px]" style={{ color: '#cf4a35' }} />
            </div>
            <h1 className="font-display font-bold text-white mb-2" style={{ fontSize: 20 }}>
              Está tardando más de lo normal
            </h1>
            <p className="text-[14px] leading-[1.6] mb-6" style={{ color: '#9aa9a3' }}>
              Tu pago se ha procesado correctamente, pero la confirmación aún no ha llegado. No hace falta que pagues otra vez — puedes comprobarlo de nuevo en unos segundos.
            </p>
            <button
              onClick={retry}
              className="w-full py-[13px] rounded-[10px] font-semibold text-[14.5px] text-white transition-opacity hover:opacity-80 mb-3"
              style={{ background: '#68140b', border: 'none', cursor: 'pointer' }}
            >
              Comprobar de nuevo
            </button>
            <button
              onClick={() => router.push('/planes')}
              className="w-full py-[11px] text-[13.5px] transition-colors hover:text-white"
              style={{ color: '#9aa9a3', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Volver a la pantalla de planes
            </button>
          </>
        )}
      </div>
    </div>
  );
}
