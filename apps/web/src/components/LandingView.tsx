'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { apiClient, type SeriesCoverSummary } from '@carp-partners/api-client';
import { PublicHeader } from '@/components/PublicHeader';
import { PublicFooter } from '@/components/PublicFooter';
import { usePublicCarousel } from '@/components/Carousel';

// Slug fijo del carrousel que alimenta el fondo del hero — se gestiona desde
// /admin/carrousels (créalo con este slug exacto para que aparezca aquí).
const HERO_CAROUSEL_SLUG = 'landing-hero';

// ─── Datos del diseño ─────────────────────────────────────────────────────────

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

const PLAN_PERKS = ['Catálogo completo sin límites', 'Estrenos cada semana', 'Resolución de vídeo Full HD', 'Sin anuncios, sin permanencia', 'Web, iOS y Android'];

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
  { q: '¿Qué es Carp Partners?', a: 'Carp Partners es la #1a plataforma de contenido de carpfishing en España. Ofrecemos una experiencia optimizada para el usuario, ideal para los amantes de la pesca. Disfruta de contenido exclusivo y de alta calidad, diseñado para satisfacer tanto a pescadores principiantes como a expertos.' },
  { q: '¿Qué tipo de contenido puedo encontrar en Carp Partners?', a: 'En Carp Partners, encontrarás una amplia variedad de contenido de pesca. Desde series, documentales, sesiones de pesca con amigos, entrevistas con expertos y mucho más. Nuestro contenido cubre tanto la pesca en agua dulce como en agua salada. No te pierdas el mejor contenido de pesca de España. ¡Consulta ya nuestros planes!' },
  { q: '¿Cómo puedo contactar al servicio de atención al cliente?', a: 'Si tienes alguna pregunta o necesitas asistencia, puedes contactar a nuestro equipo de atención al cliente a través de la sección «Contacto», ubicada en el footer (parte inferior) de nuestra web. Allí podrás rellenar un formulario con tus dudas.' },

];

// ─── Componente ───────────────────────────────────────────────────────────────
// Contenido puramente visual de la landing — sin lógica de sesión ni
// redirecciones, para poder reutilizarlo tanto en `/` (con su redirect si ya
// hay sesión) como en `/landing` (vista de solo-admin, sin redirect).

export function LandingView() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  // Solo para la tarjeta única de planes en móvil (formato tab) — en
  // desktop se siguen mostrando las dos tarjetas completas, sin selector.
  const [mobileBilling, setMobileBilling] = useState<'monthly' | 'annual'>('annual');

  const catRef   = useRef<HTMLElement>(null);
  const plansRef = useRef<HTMLElement>(null);
  const faqRef   = useRef<HTMLElement>(null);

  const scrollTo = useCallback((ref: React.RefObject<HTMLElement | null>) => () => {
    if (!ref.current) return;
    const y = ref.current.getBoundingClientRect().top + window.scrollY - 72;
    window.scrollTo({ top: y, behavior: 'smooth' });
  }, []);

  // Portadas reales para el bloque "Un vistazo al catálogo" — endpoint
  // público, sin sesión. Si falla o aún no hay portadas subidas, cae en los
  // recuadros de degradado (comportamiento previo, ver PREVIEW_MOODS).
  const [covers, setCovers] = useState<SeriesCoverSummary[]>([]);
  useEffect(() => {
    let cancelled = false;
    apiClient.getPublicSeriesCovers()
      .then(({ series }) => { if (!cancelled) setCovers(series); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Carrusel de fondo del hero: imágenes del carrousel "landing-hero"
  // (gestionado desde /admin/carrousels), crossfade automático cada 6s con
  // puntos de navegación clicables. Si no existe o no tiene imágenes, cae en
  // el degradado estático.
  const { images: heroImages } = usePublicCarousel(HERO_CAROUSEL_SLUG);
  const [heroSlide, setHeroSlide] = useState(0);
  useEffect(() => {
    if (heroImages.length < 2) return;
    const id = setInterval(() => setHeroSlide(s => (s + 1) % heroImages.length), 6000);
    return () => clearInterval(id);
  }, [heroImages.length]);

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
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-[150px] pb-[60px] overflow-hidden">
        {/* Carrusel de fondo: crossfade entre portadas reales, o degradado estático si aún no hay ninguna */}
        <div className="absolute inset-0">
          {heroImages.length > 0 ? (
            heroImages.map((img, i) => (
              <img
                key={img.id}
                src={img.image_url}
                alt=""
                aria-hidden
                className="absolute inset-0 w-full h-full object-cover"
                style={{ opacity: heroSlide === i ? 1 : 0, transition: 'opacity 1.4s ease' }}
              />
            ))
          ) : (
            <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 90% at 70% 6%, #3a5560 0%, rgba(58,85,96,0) 52%), radial-gradient(120% 100% at 12% 88%, #2a1411 0%, rgba(42,20,17,0) 55%), radial-gradient(90% 80% at 92% 96%, #1d3236 0%, rgba(29,50,54,0) 60%), linear-gradient(165deg, #0a161a 0%, #06090c 60%)' }} />
          )}
        </div>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(6,9,12,0.72) 0%, rgba(6,9,12,0.35) 32%, rgba(6,9,12,0.55) 68%, #06090c 100%)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(80% 60% at 50% 0%, rgba(6,9,12,0.2) 0%, rgba(6,9,12,0.55) 100%)' }} />
        {heroImages.length > 1 && (
          <div className="absolute bottom-9 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {heroImages.map((img, i) => (
              <button
                key={img.id}
                onClick={() => setHeroSlide(i)}
                aria-label={`Mostrar imagen ${i + 1}`}
                className="p-0 border-none cursor-pointer"
                style={{
                  width: heroSlide === i ? 28 : 14,
                  height: 5,
                  borderRadius: 3,
                  background: heroSlide === i ? '#cf4a35' : 'rgba(255,255,255,0.35)',
                  transition: 'all .3s',
                }}
              />
            ))}
          </div>
        )}
        <div className="relative max-w-[880px]">
          <div className="inline-flex items-center gap-2 px-[14px] py-[6px] uppercase mb-7 text-[10.5px] md:text-xs font-semibold tracking-[0.04em]">
            Streaming de carpfishing en España
          </div>
          <h1 className="font-display font-extrabold text-white mb-[22px]" style={{ fontSize: 'clamp(24px, 6.5vw, 66px)', lineHeight: 1.1, letterSpacing: '-0.025em', textShadow: '0 6px 40px rgba(0,0,0,0.6)' }}>
            Series, documentales y películas de carpfishing, en streaming.
          </h1>
          <p className="mx-auto mb-[38px] max-w-[620px]" style={{ fontSize: 15, lineHeight: 1.6, color: '#dbe4de', textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
            ¡Descubre la mejor plataforma de vídeos y series de carpfishing!
            Disfruta de tu pasión en cualquier sitio. Contenido nuevo cada semana.
          </p>
          {/* En móvil, los 2 CTA se apilan a ancho completo (igual que el
              diseño móvil); en desktop vuelven a ir en fila, a su ancho. */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-center gap-[10px] md:gap-[14px]">
            <Link href="/login?mode=register" className="w-full md:w-auto inline-flex items-center justify-center gap-[9px] px-[34px] py-4 rounded-[10px] text-white font-bold transition-transform hover:scale-[1.03]" style={{ fontSize: 16, background: '#68140b', boxShadow: '0 8px 28px rgba(104,20,11,0.55)' }}>
              Empezar ahora <i className="ti ti-arrow-right text-[19px]" />
            </Link>
            <button onClick={scrollTo(catRef)} className="w-full md:w-auto inline-flex items-center justify-center gap-[9px] px-7 py-4 rounded-[10px] border text-white font-semibold hover:bg-white/14 transition-colors" style={{ fontSize: 16, borderColor: 'rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(6px)' }}>
              <i className="ti ti-player-play-filled text-[17px]" />Ver catálogo
            </button>
          </div>
          <div className="hidden md:flex items-center justify-center gap-[26px] flex-wrap mt-[34px]" style={{ fontSize: 13, color: '#c7d1cb' }}>
            {[['ti-circle-check-filled', 'Cancela cuando quieras'], ['ti-device-tv', 'Web, móvil y tablet'], ['ti-badge-4k', 'Calidad 4K']].map(([icon, text]) => (
              <span key={text} className="inline-flex items-center gap-[7px]">
                <i className={`ti ${icon} text-[16px]`} style={{ color: '#cf4a35' }} />{text}
              </span>
            ))}
          </div>
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
                <p className="text-[15px] leading-relaxed" style={{ color: '#9aa9a3' }}>{f.body}</p>
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
        {/* Móvil: carrusel horizontal deslizable con portadas reales (o
            degradados de respaldo si aún no hay ninguna subida), igual que
            el diseño móvil — nada de filas borrosas decorativas aquí, eso
            es solo el tratamiento de escritorio. */}
        <div className="md:hidden">
          {(() => {
            const items: { id: string; title: string; cover_url: string; bg: string }[] = covers.length > 0
              ? covers.map((c) => ({ ...c, bg: '#0e151a' }))
              : PREVIEW_MOODS.map((bg, i) => ({ id: `ph-${i}`, title: '', cover_url: '', bg }));
            return (
              <>
                <div
                  className="flex gap-3 overflow-x-auto px-6 pb-4 scrollbar-hide"
                  style={{ scrollSnapType: 'x mandatory' }}
                >
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="flex-none rounded-[12px] overflow-hidden relative"
                      style={{ width: '78%', aspectRatio: '4/3', scrollSnapAlign: 'start', background: item.bg, border: '1px solid rgba(255,255,255,0.06)' }}
                    >
                      {item.cover_url && (
                        <img src={item.cover_url} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                      )}
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,rgba(0,0,0,0) 35%,rgba(4,8,10,0.9) 100%)' }} />
                      {item.title && (
                        <div className="absolute left-3.5 right-3.5 bottom-3">
                          <div className="text-[14px] font-bold text-white leading-[1.25] line-clamp-2">{item.title}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-center gap-1.5 mb-6">
                  {items.map((item) => (
                    <div key={item.id} className="w-[5px] h-[5px] rounded-full" style={{ background: 'rgba(255,255,255,0.3)' }} />
                  ))}
                </div>
              </>
            );
          })()}
          <div className="text-center px-6">
            <div className="font-display font-bold text-white text-[17px] mb-3.5">Suscríbete para ver todo el catálogo</div>
            <button onClick={scrollTo(plansRef)} className="inline-flex items-center gap-2 px-[22px] py-3 rounded-[10px] text-white text-[13.5px] font-bold" style={{ background: '#68140b', boxShadow: '0 8px 24px rgba(104,20,11,0.55)' }}>
              Ver planes <i className="ti ti-arrow-right text-[16px]" />
            </button>
          </div>
        </div>

        {/* Desktop: filas borrosas decorativas + CTA superpuesto (sin cambios) */}
        <div className="hidden md:block relative">
          <div className="flex flex-col gap-6" style={{ filter: 'blur(1.5px)', opacity: 0.85, maskImage: 'linear-gradient(180deg,#000 0%,#000 55%,transparent 100%)', WebkitMaskImage: 'linear-gradient(180deg,#000 0%,#000 55%,transparent 100%)' }}>
            {PREVIEW_ROWS.map((row, ri) => (
              <div key={ri} className="flex gap-[18px] px-14 overflow-hidden">
                {row.map((mi, ci) => {
                  const slot = ri * row.length + ci;
                  const cover = covers.length > 0 ? covers[slot % covers.length] : undefined;
                  return (
                    <div key={ci} className="flex-none rounded-[11px] overflow-hidden relative" style={{ width: 260, aspectRatio: '16/9', background: PREVIEW_MOODS[mi], border: '1px solid rgba(255,255,255,0.06)' }}>
                      {cover && (
                        <img
                          src={cover.cover_url}
                          alt=""
                          aria-hidden
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover"
                          style={{ filter: 'blur(9px) saturate(1.05)', transform: 'scale(1.15)' }}
                        />
                      )}
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,rgba(0,0,0,0) 50%,rgba(4,8,10,0.7) 100%)' }} />
                    </div>
                  );
                })}
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

          {/* Móvil: selector Mensual/Anual en formato tab + una sola tarjeta
              que cambia según la pestaña, igual que el diseño móvil. En
              desktop se mantienen las dos tarjetas completas de siempre. */}
          <div className="md:hidden text-left">
            <div className="flex justify-center mb-5">
              <div className="inline-flex items-center gap-1 p-1 rounded-[11px]" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
                <button
                  onClick={() => setMobileBilling('monthly')}
                  className="px-4 py-2 rounded-[8px] text-[12.5px] font-semibold transition-colors"
                  style={{ background: mobileBilling === 'monthly' ? '#68140b' : 'transparent', color: mobileBilling === 'monthly' ? '#fff' : '#9aa9a3' }}
                >
                  Mensual
                </button>
                <button
                  onClick={() => setMobileBilling('annual')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-[12.5px] font-semibold transition-colors"
                  style={{ background: mobileBilling === 'annual' ? '#68140b' : 'transparent', color: mobileBilling === 'annual' ? '#fff' : '#9aa9a3' }}
                >
                  Anual
                  <span className="px-1.5 py-[3px] rounded-[5px] text-[10px] font-bold" style={{ background: 'rgba(216,166,74,0.22)', color: '#e3bd72' }}>−25%</span>
                </button>
              </div>
            </div>

            <div
              className="relative p-[26px_24px] rounded-[18px]"
              style={
                mobileBilling === 'annual'
                  ? { background: 'linear-gradient(165deg, rgba(104,20,11,0.16), rgba(104,20,11,0.04))', border: '1.5px solid rgba(207,74,53,0.45)' }
                  : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }
              }
            >
              {mobileBilling === 'annual' && (
                <div className="absolute -top-[11px] right-6 px-3 py-[5px] rounded-[20px] text-white text-[10.5px] font-bold tracking-[0.04em]" style={{ background: '#68140b' }}>
                  RECOMENDADO
                </div>
              )}
              <div className="font-display font-semibold text-[17px] text-white mb-1.5">Premium</div>
              <div className="text-[12.5px] mb-4" style={{ color: '#c4d0cb' }}>Acceso total, sin límites</div>
              <div className="flex items-baseline gap-1.5 mb-1">
                <span className="font-display font-extrabold text-white" style={{ fontSize: 34, letterSpacing: '-0.02em' }}>
                  {mobileBilling === 'annual' ? '89,99€' : '9,99€'}
                </span>
                <span className="text-[13px]" style={{ color: '#c4d0cb' }}>/ {mobileBilling === 'annual' ? 'año' : 'mes'}</span>
              </div>
              <div className="text-[11.5px] mb-5" style={{ color: mobileBilling === 'annual' ? '#e3bd72' : '#85958e' }}>
                {mobileBilling === 'annual' ? 'Equivale a 7,50€/mes · Ahorras ~30€/año' : 'Facturación mensual · Cancela cuando quieras'}
              </div>
              <Link href="/login?mode=register" className="block w-full text-center py-3 rounded-[10px] text-white font-bold text-[13.5px] mb-4 transition-transform hover:scale-[1.02]" style={{ background: '#68140b', boxShadow: '0 8px 24px rgba(104,20,11,0.5)' }}>
                Suscribirme
              </Link>
              {PLAN_PERKS.map(p => (
                <div key={p} className="flex items-center gap-[9px] py-1.5 text-[15px]" style={{ color: mobileBilling === 'annual' ? '#e9efeb' : '#b3c0ba' }}>
                  <i className="ti ti-check text-[16px]" style={{ color: mobileBilling === 'annual' ? '#cf4a35' : '#6a7a73' }} />{p}
                </div>
              ))}
            </div>
            <div className="mt-5 text-[11.5px] text-center" style={{ color: '#6a7a73' }}>
              Pago seguro con tarjeta vía Stripe · Sin permanencia
            </div>
          </div>

          <div className="hidden md:grid grid-cols-2 gap-[22px] text-left">

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
                <div key={p} className="flex items-center gap-[11px] py-2 text-[15px]" style={{ color: '#b3c0ba' }}>
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
                <div key={p} className="flex items-center gap-[11px] py-2 text-[15px]" style={{ color: '#e9efeb' }}>
                  <i className="ti ti-check text-[18px]" style={{ color: '#cf4a35' }} />{p}
                </div>
              ))}
            </div>
          </div>
          <div className="hidden md:block mt-6 text-[12.5px]" style={{ color: '#6a7a73' }}>
            Pago seguro con tarjeta vía Stripe · Sin permanencia · Cancela en un clic
          </div>
        </div>
      </section>

      {/* ═══════════════ TESTIMONIALS ═══════════════ */}
      {/*
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
      */}
      
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
                  <div className="px-6 pb-[22px] text-[15px] leading-[1.65]" style={{ color: '#9aa9a3' }}>{faq.a}</div>
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
            <p className="mx-auto mb-8 max-w-[480px] text-[15px]" style={{ color: '#d8c0bb' }}>
              Únete a la comunidad de carpfishing más grande de España.
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
