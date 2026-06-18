'use client';

import React, { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Logo, Button } from '@carp-partners/ui';
import { useSession } from '@/context/SessionContext';

const PLANS = [
  {
    id: 'monthly',
    label: 'Mensual',
    price: '9,99 €',
    period: '/mes',
    description: 'Acceso completo al catálogo. Cancela cuando quieras.',
    highlight: false,
  },
  {
    id: 'annual',
    label: 'Anual',
    price: '89,99 €',
    period: '/año',
    description: 'Ahorra más de 29 € respecto al plan mensual.',
    highlight: true,
    badge: 'Más popular',
  },
];

const FEATURES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
      </svg>
    ),
    title: 'Vídeos exclusivos',
    desc: 'Técnicas, aventuras y series de carpfishing en HD. Solo aquí.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    title: 'En todos tus dispositivos',
    desc: 'Web, iOS y Android desde una sola cuenta. Mismo progreso en todo.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M5 3l14 9-14 9V3z" />
      </svg>
    ),
    title: 'Continúa donde lo dejaste',
    desc: 'Tu progreso se guarda automáticamente. Retoma en cualquier momento.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
    title: 'Sin publicidad',
    desc: 'Disfruta del contenido sin interrupciones. Pura pesca.',
  },
];

function LandingContent() {
  const { user, status, hasSubscription } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const showPlans = searchParams.get('planes') === '1';

  useEffect(() => {
    if (status !== 'authenticated') return;
    if (user?.role === 'admin') {
      router.replace('/admin');
    } else if (hasSubscription) {
      router.replace('/home');
    }
  }, [status, user, hasSubscription, router]);

  return (
    <div className="min-h-screen bg-surface text-white">
      {/* ── Navbar mínima ── */}
      <header className="flex items-center justify-between px-6 md:px-12 py-5 relative z-10">
        <Logo iconSize={26} />
        <Link href="/login">
          <Button variant="outline" size="sm">Entrar</Button>
        </Link>
      </header>

      {/* ── Hero ── */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 py-28 md:py-40 overflow-hidden">
        {/* Fondo con gradiente radial granate */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 70% 60% at 50% 40%, rgba(104,20,11,0.22) 0%, transparent 70%)',
          }}
        />

        <span className="relative inline-block text-brand-bright text-[12px] font-semibold uppercase tracking-[0.12em] mb-5">
          La plataforma de carpfishing
        </span>

        <h1 className="relative font-display font-extrabold text-white leading-[1.05] tracking-[-0.02em] max-w-3xl mb-6
                       text-[38px] md:text-[58px]">
          Todo el carpfishing.<br />
          <span className="text-brand-bright">Solo para ti.</span>
        </h1>

        <p className="relative text-white/60 text-[16px] leading-[1.65] max-w-lg mb-10">
          Series, técnicas y aventuras de pesca de carpa en alta definición.
          Sin anuncios. Cancela cuando quieras.
        </p>

        <div className="relative flex flex-col sm:flex-row gap-3 items-center">
          <Link href="/login">
            <Button variant="primary" size="lg">Empieza ahora</Button>
          </Link>
          <a href="#planes">
            <Button variant="ghost" size="lg">Ver planes</Button>
          </a>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="px-6 md:px-12 py-16 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-surface-raised rounded-card p-6 flex gap-4 items-start
                         border border-cp-border hover:border-white/15 transition-colors"
            >
              <span className="text-brand-bright mt-0.5 shrink-0">{f.icon}</span>
              <div>
                <h3 className="text-white font-semibold text-[15px] mb-1.5">{f.title}</h3>
                <p className="text-white/50 text-[13.5px] leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Planes ── */}
      <section id="planes" className="px-6 md:px-12 py-16 max-w-3xl mx-auto">
        {showPlans && (
          <p className="text-center text-brand-bright font-semibold mb-4 text-sm">
            Necesitas una suscripción activa para acceder al contenido.
          </p>
        )}
        <h2 className="font-display font-bold text-[32px] text-center mb-10 tracking-[-0.015em]">
          Elige tu plan
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={[
                'relative rounded-card border p-7 flex flex-col gap-4 transition-all',
                plan.highlight
                  ? 'border-brand bg-brand-dim'
                  : 'border-white/10 bg-surface-raised',
              ].join(' ')}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-white text-[11px] font-bold px-3 py-1 rounded-full tracking-wide">
                  {plan.badge}
                </span>
              )}
              <div>
                <p className="text-cp-gray text-[11px] font-semibold uppercase tracking-[0.1em] mb-1.5">
                  {plan.label}
                </p>
                <div className="flex items-end gap-1">
                  <span className="font-display text-[40px] font-extrabold text-white leading-none">
                    {plan.price}
                  </span>
                  <span className="text-cp-gray mb-1 text-sm">{plan.period}</span>
                </div>
              </div>
              <p className="text-white/50 text-[13.5px]">{plan.description}</p>
              <Link href={`/login?plan=${plan.id}`} className="mt-auto">
                <Button
                  variant={plan.highlight ? 'primary' : 'outline'}
                  size="md"
                  className="w-full justify-center"
                >
                  Empezar — {plan.label}
                </Button>
              </Link>
            </div>
          ))}
        </div>
        <p className="text-center text-white/30 text-xs mt-6">
          El pago se gestiona de forma segura a través de Stripe. Cancela en cualquier momento.
        </p>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/8 px-6 md:px-12 py-10 text-center">
        <Logo iconSize={22} className="justify-center mb-4" />
        <p className="text-white/25 text-xs">
          © {new Date().getFullYear()} Carp Partners TV. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  );
}

export default function LandingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <LandingContent />
    </Suspense>
  );
}
