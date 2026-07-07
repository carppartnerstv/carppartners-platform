'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { ApiError } from '@carp-partners/api-client';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Screen = 'login' | 'register' | 'forgot' | 'sent';

// ─── Fuerza de contraseña ─────────────────────────────────────────────────────

function pwStrength(p: string): number {
  let s = 0;
  if (p.length >= 6) s++;
  if (p.length >= 10) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/[0-9]/.test(p) || /[^A-Za-z0-9]/.test(p)) s++;
  return s;
}
const pwColor = (s: number) => s <= 1 ? '#c0392b' : s <= 2 ? '#d8a64a' : '#3e9d6b';

// ─── Página ───────────────────────────────────────────────────────────────────

function LoginContent() {
  const { user, status, hasSubscription, login, register } = useSession();
  const router = useRouter();
  const params = useSearchParams();

  const [screen, setScreen] = useState<Screen>(
    params.get('mode') === 'register' ? 'register' : 'login',
  );
  const [name, setName]           = useState('');
  const [email, setEmail]         = useState('');
  const [pass, setPass]           = useState('');
  const [sentEmail, setSentEmail] = useState('');
  const [focus, setFocus]         = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [remember, setRemember]   = useState(true);
  const [apiError, setApiError]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [lastAction, setLastAction] = useState<'register' | null>(null);

  // Redirigir si ya autenticado
  useEffect(() => {
    if (status !== 'authenticated') return;
    if (user?.role === 'admin') router.replace('/admin');
    else if (hasSubscription) router.replace('/home');
    else router.replace(lastAction === 'register' ? '/planes?bienvenido=1' : '/planes');
  }, [status, user, hasSubscription, router, lastAction]);

  const go = (s: Screen) => { setScreen(s); setFocus(''); setApiError(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');

    // Validación manual (sin tooltips nativos del browser)
    if (screen === 'register' && !name.trim()) {
      setApiError('El nombre es obligatorio.');
      return;
    }
    if (!email.trim()) { setApiError('El correo es obligatorio.'); return; }
    if (!pass) { setApiError('La contraseña es obligatoria.'); return; }

    setLoading(true);
    // Marca la acción antes de la llamada para que el useEffect de redirect la lea
    setLastAction(screen === 'register' ? 'register' : null);
    try {
      if (screen === 'login') {
        await login(email.trim(), pass);
      } else {
        await register(email.trim(), pass, name.trim() || undefined);
      }
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : 'Ha ocurrido un error inesperado.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendReset = (e: React.FormEvent) => {
    e.preventDefault();
    setSentEmail(email.trim() || 'tu correo');
    setScreen('sent');
  };

  const strength = pwStrength(pass);
  const barColor = pwColor(strength);
  const barOff   = 'rgba(255,255,255,0.1)';

  const border = (f: string) =>
    focus === f ? 'rgba(207,74,53,0.6)' : 'rgba(255,255,255,0.1)';

  const titles: Record<Screen, string> = {
    login:    'Bienvenido de nuevo',
    register: 'Crea tu cuenta',
    forgot:   'Recuperar contraseña',
    sent:     'Enlace enviado',
  };
  const subtitles: Record<Screen, string> = {
    login:    'Inicia sesión para seguir viendo',
    register: 'Empieza gratis. Sin tarjeta para registrarte.',
    forgot:   'Te enviaremos un enlace para crear una nueva',
    sent:     '',
  };

  return (
    <div
      className="relative min-h-screen w-full flex flex-col items-center justify-center px-6 py-[48px]"
      style={{ background: '#06090c', fontFamily: 'Inter, sans-serif' }}
    >
      {/* Fondo degradado atmosférico */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(120% 80% at 75% 4%, #28424a 0%, rgba(40,66,74,0) 50%), radial-gradient(110% 90% at 8% 96%, #2a1411 0%, rgba(42,20,17,0) 52%), linear-gradient(165deg, #0a1216, #06090c 65%)' }} />

      {/* Header: logo izquierda · volver derecha */}
      <div className="absolute top-0 left-0 right-0 flex items-center px-8 py-6">
        <Image
          src="/logo.png"
          alt="Carp Partners TV"
          width={110} height={19}
          className="h-6 w-auto cursor-pointer"
          onClick={() => router.push('/')}
        />
        <div className="flex-1" />
        <Link
          href="/"
          className="inline-flex items-center gap-[7px] text-[13px] transition-colors hover:text-white"
          style={{ color: '#9aa9a3' }}
        >
          <i className="ti ti-arrow-left text-[17px]" />
          Volver al inicio
        </Link>
      </div>

      {/* Contenedor del formulario — max-width 418px */}
      <div className="relative w-full" style={{ maxWidth: 418 }}>

        {/* Título y subtítulo */}
        <div className="text-center mb-[30px]">
          <h1
            className="font-display font-bold text-white mb-2"
            style={{ fontSize: 30, letterSpacing: '-0.02em' }}
          >
            {titles[screen]}
          </h1>
          {subtitles[screen] && (
            <p style={{ fontSize: 14.5, color: '#9aa9a3' }}>{subtitles[screen]}</p>
          )}
        </div>

        {/* ── Tarjeta del formulario ── */}
        <div
          className="px-[30px] py-8 rounded-[18px]"
          style={{
            background: 'rgba(14,21,26,0.7)',
            border: '1px solid rgba(255,255,255,0.09)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          }}
        >

          {/* ══ LOGIN / REGISTER ══ */}
          {(screen === 'login' || screen === 'register') && (
            <form onSubmit={handleSubmit} noValidate>

              {/* Nombre (solo register) */}
              {screen === 'register' && (
                <FieldWrap label="Nombre completo" icon="user" borderColor={border('name')}>
                  <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onFocus={() => setFocus('name')}
                    onBlur={() => setFocus('')}
                    placeholder="Diego Ramírez"
                    autoFocus
                    style={inputStyle}
                  />
                </FieldWrap>
              )}

              {/* Email */}
              <FieldWrap label="Correo electrónico" icon="mail" borderColor={border('email')}>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setFocus('email')}
                  onBlur={() => setFocus('')}
                  placeholder="tu@correo.com"
                  autoFocus={screen === 'login'}
                  style={inputStyle}
                />
              </FieldWrap>

              {/* Contraseña */}
              <FieldWrap
                label="Contraseña"
                icon="lock"
                borderColor={border('pass')}
                noMargin
                suffix={
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="shrink-0 transition-colors hover:text-white/80"
                    style={{ color: '#85958e' }}
                  >
                    <i className={`ti ti-${showPass ? 'eye-off' : 'eye'} text-[18px]`} />
                  </button>
                }
              >
                <input
                  type={showPass ? 'text' : 'password'}
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                  onFocus={() => setFocus('pass')}
                  onBlur={() => setFocus('')}
                  placeholder="••••••••"
                  style={inputStyle}
                />
              </FieldWrap>

              {/* Barra de fuerza (register) */}
              {screen === 'register' && (
                <div className="flex gap-[5px] mt-[14px] mb-[18px]">
                  {[1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      className="flex-1 rounded-[3px] transition-colors duration-300"
                      style={{ height: 4, background: strength >= i ? barColor : barOff }}
                    />
                  ))}
                </div>
              )}

              {/* Recordarme + olvidé (login) */}
              {screen === 'login' && (
                <div className="flex items-center justify-between mt-0 mb-[22px]">
                  <label
                    className="inline-flex items-center gap-2 cursor-pointer select-none"
                    style={{ fontSize: 13, color: '#9aa9a3' }}
                    onClick={() => setRemember(v => !v)}
                  >
                    <span
                      className="flex items-center justify-center rounded-[5px] transition-colors"
                      style={{
                        width: 18, height: 18,
                        border: `1px solid ${remember ? '#68140b' : 'rgba(255,255,255,0.25)'}`,
                        background: remember ? '#68140b' : 'transparent',
                      }}
                    >
                      <i className="ti ti-check text-[13px] text-white" style={{ opacity: remember ? 1 : 0 }} />
                    </span>
                    Recordarme
                  </label>
                  <button
                    type="button"
                    onClick={() => go('forgot')}
                    className="text-[13px] font-medium hover:underline"
                    style={{ color: '#cf4a35' }}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}

              {/* Error */}
              {apiError && <ErrorBanner message={apiError} />}

              {/* CTA */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-[9px] py-[15px] rounded-[11px] text-white font-bold text-[15px] transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: '#68140b', boxShadow: '0 8px 24px rgba(104,20,11,0.45)', border: 'none' }}
              >
                {loading
                  ? <><i className="ti ti-loader-2 animate-spin text-[18px]" />Cargando…</>
                  : <>{screen === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}<i className="ti ti-arrow-right text-[18px]" /></>
                }
              </button>

              {/* Aviso legal (register) */}
              {screen === 'register' && (
                <p className="text-center mt-4" style={{ fontSize: 11.5, lineHeight: 1.5, color: '#6a7a73' }}>
                  Al crear tu cuenta aceptas los Términos y la Política de privacidad de Carp Partners TV.
                </p>
              )}
            </form>
          )}

          {/* ══ FORGOT PASSWORD ══ */}
          {screen === 'forgot' && (
            <form onSubmit={handleSendReset} noValidate>
              <FieldWrap label="Correo electrónico" icon="mail" borderColor={border('email')}>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setFocus('email')}
                  onBlur={() => setFocus('')}
                  placeholder="tu@correo.com"
                  autoFocus
                  style={inputStyle}
                />
              </FieldWrap>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-[9px] py-[15px] rounded-[11px] text-white font-bold text-[15px] transition-transform hover:scale-[1.02]"
                style={{ background: '#68140b', boxShadow: '0 8px 24px rgba(104,20,11,0.45)', border: 'none' }}
              >
                Enviar enlace de recuperación <i className="ti ti-send text-[18px]" />
              </button>
              <button
                type="button"
                onClick={() => go('login')}
                className="w-full flex items-center justify-center gap-[7px] mt-[18px] transition-colors hover:text-white"
                style={{ fontSize: 13.5, color: '#9aa9a3', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                <i className="ti ti-arrow-left text-[16px]" />Volver a iniciar sesión
              </button>
            </form>
          )}

          {/* ══ SENT ══ */}
          {screen === 'sent' && (
            <div className="text-center" style={{ padding: '8px 4px 4px' }}>
              <div
                className="flex items-center justify-center rounded-full mx-auto mb-[22px]"
                style={{ width: 64, height: 64, background: 'rgba(104,20,11,0.16)', border: '1px solid rgba(207,74,53,0.35)' }}
              >
                <i className="ti ti-mail-check text-[31px]" style={{ color: '#cf4a35' }} />
              </div>
              <div
                className="font-display font-semibold mb-2.5"
                style={{ fontSize: 19, color: '#eef3f0' }}
              >
                Revisa tu correo
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: '#9aa9a3', marginBottom: 24 }}>
                Si <span style={{ color: '#cdd6d2', fontWeight: 600 }}>{sentEmail}</span> tiene una cuenta, te hemos enviado un enlace para restablecer tu contraseña. Caduca en 30 minutos.
              </p>
              <button
                onClick={() => go('login')}
                className="w-full py-[14px] rounded-[11px] text-white font-bold text-[15px]"
                style={{ background: '#68140b', boxShadow: '0 8px 24px rgba(104,20,11,0.45)', border: 'none', cursor: 'pointer' }}
              >
                Volver a iniciar sesión
              </button>
              <div className="mt-[18px]" style={{ fontSize: 13, color: '#6a7a73' }}>
                ¿No te ha llegado?{' '}
                <button
                  onClick={() => go('forgot')}
                  className="font-semibold hover:underline"
                  style={{ color: '#cf4a35', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Reenviar enlace
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Enlace toggle login ↔ register */}
        {(screen === 'login' || screen === 'register') && (
          <div className="text-center mt-6" style={{ fontSize: 14, color: '#9aa9a3' }}>
            {screen === 'login' ? '¿Aún no tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
            <button
              onClick={() => go(screen === 'login' ? 'register' : 'login')}
              className="font-semibold hover:underline"
              style={{ color: '#cf4a35', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {screen === 'login' ? 'Suscríbete' : 'Inicia sesión'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: '#eef3f0',
  fontFamily: 'Inter, sans-serif',
  fontSize: 14.5,
  padding: '13px 0',
};

function FieldWrap({
  label, icon, borderColor, noMargin, suffix, children,
}: {
  label: string;
  icon: string;
  borderColor: string;
  noMargin?: boolean;
  suffix?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: noMargin ? 0 : 18 }}>
      <label
        style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#b3c0ba', marginBottom: 8 }}
      >
        {label}
      </label>
      <div
        className="flex items-center gap-2.5 px-[14px] rounded-[10px] transition-colors duration-200"
        style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${borderColor}` }}
      >
        <i className={`ti ti-${icon} text-[18px] shrink-0`} style={{ color: '#6a7a73' }} />
        {children}
        {suffix}
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="mb-4 px-3 py-2.5 rounded-lg text-[13px] leading-snug"
      style={{ background: 'rgba(192,57,43,0.12)', border: '1px solid rgba(192,57,43,0.3)', color: '#ff8a80' }}
    >
      {message}
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: '#06090c' }} />}>
      <LoginContent />
    </Suspense>
  );
}
