'use client';

import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';

// ─── Datos del diseño ─────────────────────────────────────────────────────────

const STATS = [
  { num: '180+', label: 'Vídeos en HD' },
  { num: '4', label: 'Series originales' },
  { num: 'Cada semana', label: 'Nuevos estrenos' },
  { num: '4K', label: 'Máxima calidad' },
];

const FEATURES = [
  { icon: 'movie', title: 'Series y documentales', body: 'Producciones originales rodadas en los mejores escenarios de pesca de carpa de España y Europa.' },
  { icon: 'school', title: 'Técnicas que funcionan', body: 'Montajes, cebado, localización y estrategia explicados paso a paso por pescadores expertos.' },
  { icon: 'device-tv', title: 'Donde y cuando quieras', body: 'Web, móvil y tablet. Continúa viendo desde donde lo dejaste, en calidad hasta 4K.' },
];

const PREVIEW_MOODS = [
  'radial-gradient(120% 100% at 18% 0%, #2a4a52 0%, rgba(42,74,82,0) 55%), linear-gradient(160deg, #0e1f24, #0a1518)',
  'radial-gradient(100% 90% at 72% 8%, #5a4326 0%, rgba(90,67,38,0) 55%), linear-gradient(160deg, #1a1810, #0b0d0c)',
  'radial-gradient(110% 100% at 28% 16%, #1e3a5c 0%, rgba(30,58,92,0) 55%), linear-gradient(160deg, #0c1626, #0a1014)',
  'radial-gradient(110% 95% at 82% 0%, #25402c 0%, rgba(37,64,44,0) 55%), linear-gradient(160deg, #101a12, #0a0f0c)',
  'radial-gradient(120% 100% at 50% 0%, #2e4d4a 0%, rgba(46,77,74,0) 60%), linear-gradient(160deg, #10201e, #0a1412)',
  'radial-gradient(100% 95% at 62% 8%, #1c2740 0%, rgba(28,39,64,0) 55%), linear-gradient(160deg, #0c1018, #08090d)',
  'radial-gradient(100% 85% at 22% 14%, #4a3320 0%, rgba(74,51,32,0) 55%), linear-gradient(160deg, #18130d, #0b0c0a)',
  'radial-gradient(110% 100% at 76% 6%, #2b3b44 0%, rgba(43,59,68,0) 55%), linear-gradient(160deg, #121a1f, #0a0f12)',
];
const PREVIEW_ROWS = [[0, 2, 4, 6, 1, 3, 7], [5, 7, 3, 0, 6, 2, 4]];

const PLAN_PERKS = ['Catálogo completo sin límites', 'Estrenos cada semana', 'Calidad hasta 4K UHD', 'Sin anuncios, sin permanencia', 'Web, iOS y Android'];

const TESTIMONIALS = [
  { quote: '"Por fin contenido serio de carpfishing en español. Las técnicas de montaje me han hecho mejorar muchísimo esta temporada."', name: 'Javier M.', loc: 'Zaragoza', initials: 'JM', av: 'linear-gradient(135deg,#2f5249,#16302b)' },
  { quote: '"La serie de Mequinenza es una pasada de producción. Lo veo en el móvil mientras espero la picada, engancha."', name: 'Carlos R.', loc: 'Valencia', initials: 'CR', av: 'linear-gradient(135deg,#5a241d,#2a1411)' },
  { quote: '"Pago el anual sin dudarlo. Cada semana hay algo nuevo y la calidad de imagen es de otro nivel."', name: 'Toni B.', loc: 'Lleida', initials: 'TB', av: 'linear-gradient(135deg,#3a4a5c,#1c2740)' },
];

const FAQS = [
  { q: '¿Necesito permanencia?', a: 'No. Puedes cancelar tu suscripción cuando quieras desde tu perfil, en un solo clic. Seguirás teniendo acceso hasta el final del periodo que ya has pagado.' },
  { q: '¿En qué dispositivos puedo ver Carp Partners TV?', a: 'En la web desde cualquier navegador, y en las apps de iOS y Android para móvil y tablet. Tu progreso se sincroniza entre todos tus dispositivos.' },
  { q: '¿Con qué frecuencia se publica contenido nuevo?', a: 'Publicamos contenido nuevo todas las semanas: nuevos episodios de series, documentales y vídeos de técnica.' },
  { q: '¿Cómo funciona el pago?', a: 'El pago es seguro a través de Stripe con tarjeta de crédito o débito. Puedes elegir plan mensual (9,99€/mes) o anual (89,99€/año), que equivale a 7,50€/mes y supone un ahorro de ~30€.' },
  { q: '¿Hay contenido gratuito?', a: 'Sí. Al registrarte gratis tienes acceso a tráilers, avances y un vídeo completo gratuito al mes para que conozcas la plataforma.' },
];

// ─── Componente principal ─────────────────────────────────────────────────────

function LandingContent() {
  const { user, status, hasSubscription } = useSession();
  const router = useRouter();

  const [openFaq, setOpenFaq]     = useState<number | null>(null);

  const catRef   = useRef<HTMLElement>(null);
  const plansRef = useRef<HTMLElement>(null);
  const faqRef   = useRef<HTMLElement>(null);

  // Redirigir si ya tiene sesión
  useEffect(() => {
    if (status !== 'authenticated') return;
    if (user?.role === 'admin') router.replace('/admin');
    else if (hasSubscription) router.replace('/home');
  }, [status, user, hasSubscription, router]);

  const scrollTo = useCallback((ref: React.RefObject<HTMLElement | null>) => () => {
    if (!ref.current) return;
    const y = ref.current.getBoundingClientRect().top + window.scrollY - 72;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }, []);


  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{ background: '#06090c', fontFamily: 'Inter, sans-serif', color: '#e9efeb' }}
    >
      {/* ═══════════════ NAVBAR ═══════════════ */}
      <PublicHeader
        transparentOnTop
        onNavClick={{ catalogo: scrollTo(catRef), planes: scrollTo(plansRef), preguntas: scrollTo(faqRef) }}
      />

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-[120px] pb-20 overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 70% 6%, #3a5560 0%, rgba(58,85,96,0) 52%), radial-gradient(120% 100% at 12% 88%, #2a1411 0%, rgba(42,20,17,0) 55%), radial-gradient(90% 80% at 92% 96%, #1d3236 0%, rgba(29,50,54,0) 60%), linear-gradient(165deg, #0a161a 0%, #06090c 60%)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(6,9,12,0.5) 0%, rgba(6,9,12,0.1) 30%, rgba(6,9,12,0.35) 70%, #06090c 100%)' }} />
        <div className="relative max-w-[880px]">
          <div className="inline-flex items-center gap-2 px-[14px] py-[6px] rounded-full border mb-7 text-xs font-semibold tracking-[0.04em]" style={{ background: 'rgba(216,166,74,0.12)', borderColor: 'rgba(216,166,74,0.32)', color: '#e3bd72' }}>
            <i className="ti ti-fish text-[15px]" />
            La plataforma del carpfishing en España
          </div>
          <h1 className="font-display font-extrabold text-white mb-[22px]" style={{ fontSize: 'clamp(42px, 7vw, 74px)', lineHeight: 1.02, letterSpacing: '-0.025em', textShadow: '0 6px 40px rgba(0,0,0,0.5)' }}>
            Las grandes carpas,<br />en tu pantalla.
          </h1>
          <p className="mx-auto mb-[38px] max-w-[620px]" style={{ fontSize: 19, lineHeight: 1.6, color: '#c4d0cb' }}>
            Series, documentales y técnicas de pesca de carpa en alta definición. Nuevo contenido cada semana, donde y cuando quieras.
          </p>
          <div className="flex items-center justify-center gap-[14px] flex-wrap">
            <Link href="/login?mode=register" className="inline-flex items-center gap-[9px] px-[34px] py-4 rounded-[10px] text-white font-bold transition-transform hover:scale-[1.03]" style={{ fontSize: 16, background: '#68140b', boxShadow: '0 8px 28px rgba(104,20,11,0.55)' }}>
              Empezar ahora <i className="ti ti-arrow-right text-[19px]" />
            </Link>
            <button onClick={scrollTo(catRef)} className="inline-flex items-center gap-[9px] px-7 py-4 rounded-[10px] border text-white font-semibold hover:bg-white/14 transition-colors" style={{ fontSize: 16, borderColor: 'rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(6px)' }}>
              <i className="ti ti-player-play-filled text-[17px]" />Ver catálogo
            </button>
          </div>
          <div className="flex items-center justify-center gap-[26px] flex-wrap mt-[34px]" style={{ fontSize: 13, color: '#9aa9a3' }}>
            {[['ti-circle-check-filled', 'Cancela cuando quieras'], ['ti-device-tv', 'Web, móvil y tablet'], ['ti-badge-4k', 'Calidad 4K']].map(([icon, text]) => (
              <span key={text} className="inline-flex items-center gap-[7px]">
                <i className={`ti ${icon} text-[16px]`} style={{ color: '#cf4a35' }} />{text}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ STATS ═══════════════ */}
      <section className="relative px-6 md:px-14 pb-[70px] -mt-[30px]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 max-w-[1100px] mx-auto">
          {STATS.map(s => (
            <div key={s.label} className="text-center px-4 py-7 rounded-[14px]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="font-display font-extrabold text-white" style={{ fontSize: 'clamp(26px,4vw,38px)', letterSpacing: '-0.02em' }}>{s.num}</div>
              <div className="mt-1.5 text-[13px]" style={{ color: '#85958e' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════ FEATURES ═══════════════ */}
      <section className="px-6 md:px-14 pt-[60px] pb-[80px]">
        <div className="max-w-[1100px] mx-auto text-center">
          <div className="text-[12.5px] font-semibold tracking-[0.12em] uppercase mb-[14px]" style={{ color: '#cf4a35' }}>Por qué Carp Partners TV</div>
          <h2 className="font-display font-bold text-white mb-[54px]" style={{ fontSize: 'clamp(28px,4vw,42px)', letterSpacing: '-0.02em' }}>Hecho por y para carpfishers</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {FEATURES.map(f => (
              <div key={f.title} className="p-8 rounded-[16px]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="w-[52px] h-[52px] rounded-[13px] flex items-center justify-center mb-5" style={{ background: 'rgba(104,20,11,0.18)', border: '1px solid rgba(207,74,53,0.3)' }}>
                  <i className={`ti ti-${f.icon} text-[26px]`} style={{ color: '#cf4a35' }} />
                </div>
                <h3 className="font-display font-semibold text-[20px] mb-2.5" style={{ color: '#eef3f0' }}>{f.title}</h3>
                <p className="text-[14.5px] leading-relaxed" style={{ color: '#9aa9a3' }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ CATALOG PREVIEW ═══════════════ */}
      <section ref={catRef} id="catalogo" className="pb-[90px] pt-10">
        <div className="text-center px-6 md:px-14 mb-10">
          <div className="text-[12.5px] font-semibold tracking-[0.12em] uppercase mb-[14px]" style={{ color: '#cf4a35' }}>Un vistazo al catálogo</div>
          <h2 className="font-display font-bold text-white" style={{ fontSize: 'clamp(28px,4vw,42px)', letterSpacing: '-0.02em' }}>Cientos de horas esperándote</h2>
        </div>
        <div className="relative">
          <div className="flex flex-col gap-6" style={{ filter: 'blur(1.5px)', opacity: 0.85, maskImage: 'linear-gradient(180deg,#000 0%,#000 55%,transparent 100%)', WebkitMaskImage: 'linear-gradient(180deg,#000 0%,#000 55%,transparent 100%)' }}>
            {PREVIEW_ROWS.map((row, ri) => (
              <div key={ri} className="flex gap-[18px] px-14 overflow-hidden">
                {row.map((mi, ci) => (
                  <div key={ci} className="flex-none rounded-[11px] overflow-hidden relative" style={{ width: 260, aspectRatio: '16/9', background: PREVIEW_MOODS[mi], border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,rgba(0,0,0,0) 50%,rgba(4,8,10,0.7) 100%)' }} />
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="absolute left-0 right-0 bottom-1.5 flex flex-col items-center text-center px-6">
            <div className="w-[60px] h-[60px] rounded-full flex items-center justify-center mb-[18px]" style={{ background: 'rgba(104,20,11,0.9)', boxShadow: '0 8px 30px rgba(104,20,11,0.6)' }}>
              <i className="ti ti-lock text-[27px] text-white" />
            </div>
            <div className="font-display font-bold text-white text-2xl mb-[18px]">Suscríbete para ver todo el catálogo</div>
            <button onClick={scrollTo(plansRef)} className="inline-flex items-center gap-[9px] px-7 py-[14px] rounded-[10px] text-white text-[15px] font-bold" style={{ background: '#68140b', boxShadow: '0 8px 28px rgba(104,20,11,0.55)' }}>
              Ver planes <i className="ti ti-arrow-right text-[18px]" />
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════════ PLANS ═══════════════ */}
      <section ref={plansRef} id="planes" className="px-6 md:px-14 py-[70px] md:py-[90px]" style={{ background: 'linear-gradient(180deg,#080d11 0%,#06090c 100%)' }}>
        <div className="max-w-[920px] mx-auto text-center">
          <div className="text-[12.5px] font-semibold tracking-[0.12em] uppercase mb-[14px]" style={{ color: '#cf4a35' }}>Planes</div>
          <h2 className="font-display font-bold text-white mb-[44px]" style={{ fontSize: 'clamp(28px,4vw,42px)', letterSpacing: '-0.02em' }}>Elige cómo quieres ver</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-[22px] text-left">

            {/* Plan Mensual */}
            <div className="p-[36px_32px] rounded-[18px]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="font-display font-semibold text-[20px] mb-2" style={{ color: '#eef3f0' }}>Mensual</div>
              <div className="text-[13.5px] mb-[22px]" style={{ color: '#85958e' }}>Facturación mensual · Cancela cuando quieras</div>
              <div className="flex items-baseline gap-1.5 mb-[26px]">
                <span className="font-display font-extrabold text-white" style={{ fontSize: 46, letterSpacing: '-0.02em' }}>9,99€</span>
                <span className="text-[14px]" style={{ color: '#85958e' }}>/ mes</span>
              </div>
              <Link href="/login?mode=register" className="block w-full text-center py-[13px] rounded-[10px] text-white font-semibold text-[14.5px] mb-[26px] transition-colors hover:bg-white/12" style={{ border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.06)' }}>
                Empezar
              </Link>
              {PLAN_PERKS.map(p => (
                <div key={p} className="flex items-center gap-[11px] py-2 text-[14px]" style={{ color: '#b3c0ba' }}>
                  <i className="ti ti-check text-[18px]" style={{ color: '#6a7a73' }} />{p}
                </div>
              ))}
            </div>

            {/* Plan Anual — recomendado */}
            <div className="relative p-[36px_32px] rounded-[18px]" style={{ background: 'linear-gradient(165deg, rgba(104,20,11,0.16), rgba(104,20,11,0.04))', border: '1.5px solid rgba(207,74,53,0.45)', boxShadow: '0 20px 60px rgba(104,20,11,0.2)' }}>
              <div className="absolute -top-[13px] right-7 px-[14px] py-[5px] rounded-[20px] text-white text-[11.5px] font-bold tracking-[0.04em]" style={{ background: '#68140b' }}>
                RECOMENDADO
              </div>
              <div className="font-display font-semibold text-[20px] text-white mb-2">Anual</div>
              <div className="text-[13.5px] mb-[22px]" style={{ color: '#c4d0cb' }}>Facturado una vez al año · Sin permanencia</div>
              <div className="flex items-baseline gap-1.5 mb-1.5">
                <span className="font-display font-extrabold text-white" style={{ fontSize: 46, letterSpacing: '-0.02em' }}>89,99€</span>
                <span className="text-[14px]" style={{ color: '#c4d0cb' }}>/ año</span>
              </div>
              <div className="text-[13px] mb-6" style={{ color: '#e3bd72' }}>Equivale a 7,50€/mes · Ahorras ~30€/año</div>
              <Link href="/login?mode=register" className="block w-full text-center py-[13px] rounded-[10px] text-white font-bold text-[14.5px] mb-[26px] transition-transform hover:scale-[1.02]" style={{ background: '#68140b', boxShadow: '0 8px 24px rgba(104,20,11,0.5)' }}>
                Empezar
              </Link>
              {PLAN_PERKS.map(p => (
                <div key={p} className="flex items-center gap-[11px] py-2 text-[14px]" style={{ color: '#e9efeb' }}>
                  <i className="ti ti-check text-[18px]" style={{ color: '#cf4a35' }} />{p}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-6 text-[12.5px]" style={{ color: '#6a7a73' }}>
            Pago seguro con tarjeta vía Stripe · Sin permanencia · Cancela en un clic
          </div>
        </div>
      </section>

      {/* ═══════════════ TESTIMONIALS ═══════════════ */}
      <section className="px-6 md:px-14 py-[70px] md:py-[80px]">
        <div className="max-w-[1100px] mx-auto">
          <div className="text-center mb-[50px]">
            <div className="text-[12.5px] font-semibold tracking-[0.12em] uppercase mb-[14px]" style={{ color: '#cf4a35' }}>La comunidad</div>
            <h2 className="font-display font-bold text-white" style={{ fontSize: 'clamp(28px,4vw,42px)', letterSpacing: '-0.02em' }}>Lo que dicen los pescadores</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[22px]">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="p-[30px_28px] rounded-[16px]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex gap-[3px] mb-[18px]">
                  {Array(5).fill(0).map((_, i) => <i key={i} className="ti ti-star-filled text-[16px]" style={{ color: '#e3bd72' }} />)}
                </div>
                <p className="text-[15px] leading-[1.65] mb-[22px]" style={{ color: '#cdd6d2' }}>{t.quote}</p>
                <div className="flex items-center gap-3">
                  <div className="w-[42px] h-[42px] rounded-full flex items-center justify-center font-display font-semibold text-[14px] text-white shrink-0" style={{ background: t.av, border: '1px solid rgba(255,255,255,0.12)' }}>
                    {t.initials}
                  </div>
                  <div>
                    <div className="text-[14px] font-semibold" style={{ color: '#eef3f0' }}>{t.name}</div>
                    <div className="text-[12.5px]" style={{ color: '#85958e' }}>{t.loc}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ FAQ ═══════════════ */}
      <section ref={faqRef} id="preguntas" className="px-6 md:px-14 py-[70px] md:py-[90px]">
        <div className="max-w-[760px] mx-auto">
          <div className="text-center mb-12">
            <div className="text-[12.5px] font-semibold tracking-[0.12em] uppercase mb-[14px]" style={{ color: '#cf4a35' }}>Preguntas frecuentes</div>
            <h2 className="font-display font-bold text-white" style={{ fontSize: 'clamp(28px,4vw,42px)', letterSpacing: '-0.02em' }}>Todo lo que necesitas saber</h2>
          </div>
          <div className="flex flex-col gap-3">
            {FAQS.map((faq, i) => (
              <div key={i} onClick={() => setOpenFaq(openFaq === i ? null : i)} className="rounded-[13px] overflow-hidden cursor-pointer transition-colors duration-200" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${openFaq === i ? 'rgba(207,74,53,0.35)' : 'rgba(255,255,255,0.07)'}` }}>
                <div className="flex items-center justify-between gap-4 px-6 py-5">
                  <span className="font-display font-medium text-[16.5px]" style={{ color: '#eef3f0' }}>{faq.q}</span>
                  <i className={`ti ti-${openFaq === i ? 'minus' : 'plus'} text-[21px] shrink-0`} style={{ color: openFaq === i ? '#cf4a35' : '#85958e' }} />
                </div>
                {openFaq === i && (
                  <div className="px-6 pb-[22px] text-[14.5px] leading-[1.65]" style={{ color: '#9aa9a3' }}>{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ CTA BAND ═══════════════ */}
      <section className="px-6 md:px-14 pb-[90px]">
        <div className="relative max-w-[1100px] mx-auto rounded-[24px] overflow-hidden px-10 py-16 text-center">
          <div className="absolute inset-0" style={{ background: 'radial-gradient(100% 120% at 50% 0%, #3a1a14 0%, #160a08 60%, #0a0606 100%)' }} />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(70% 80% at 80% 100%, rgba(104,20,11,0.35) 0%, rgba(104,20,11,0) 60%)' }} />
          <div className="relative">
            <h2 className="font-display font-extrabold text-white mb-4" style={{ fontSize: 'clamp(28px,4vw,46px)', letterSpacing: '-0.025em' }}>
              Tu próxima gran captura<br />empieza aquí.
            </h2>
            <p className="mx-auto mb-8 max-w-[480px] text-[17px]" style={{ color: '#d8c0bb' }}>
              Únete a la comunidad de carpfishing más grande de España. Primer contenido gratis al registrarte.
            </p>
            <Link href="/login?mode=register" className="inline-flex items-center gap-[9px] px-9 py-4 rounded-[11px] font-bold text-[16px] transition-transform hover:scale-[1.03]" style={{ background: '#fff', color: '#68140b', boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
              Crear mi cuenta <i className="ti ti-arrow-right text-[19px]" />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <PublicFooter />
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
