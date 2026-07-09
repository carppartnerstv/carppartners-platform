'use client';

import React, { Suspense, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient, ApiError } from '@carp-partners/api-client';

// ─── Fuerza de contraseña (mismo criterio que /login) ─────────────────────────

function pwStrength(p: string): number {
  let s = 0;
  if (p.length >= 6) s++;
  if (p.length >= 10) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/[0-9]/.test(p) || /[^A-Za-z0-9]/.test(p)) s++;
  return s;
}
const pwColor = (s: number) => s <= 1 ? '#c0392b' : s <= 2 ? '#d8a64a' : '#3e9d6b';

function SetPasswordContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const [pass, setPass]           = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [focus, setFocus]         = useState('');
  const [apiError, setApiError]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);

  const strength = pwStrength(pass);
  const barColor = pwColor(strength);
  const barOff = 'rgba(255,255,255,0.1)';
  const border = (f: string) => focus === f ? 'rgba(207,74,53,0.6)' : 'rgba(255,255,255,0.1)';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');
    if (!pass || pass.length < 8) { setApiError('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (pass !== confirm) { setApiError('Las contraseñas no coinciden.'); return; }

    setLoading(true);
    try {
      await apiClient.setPassword(token, pass);
      setDone(true);
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : 'Ha ocurrido un error inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen w-full flex flex-col items-center justify-center px-6 py-[48px]"
      style={{ background: '#06090c', fontFamily: 'Inter, sans-serif' }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(120% 80% at 75% 4%, #28424a 0%, rgba(40,66,74,0) 50%), radial-gradient(110% 90% at 8% 96%, #2a1411 0%, rgba(42,20,17,0) 52%), linear-gradient(165deg, #0a1216, #06090c 65%)' }} />

      <div className="absolute top-0 left-0 right-0 flex items-center px-8 py-6">
        <Image
          src="/carp-partners-logo blanc.png"
          alt="Carp Partners TV"
          width={110} height={19}
          className="h-6 w-auto cursor-pointer"
          onClick={() => router.push('/')}
        />
      </div>

      <div className="relative w-full" style={{ maxWidth: 418 }}>
        {!done && (
          <div className="text-center mb-[30px]">
            <h1 className="font-display font-bold text-white mb-2" style={{ fontSize: 30, letterSpacing: '-0.02em' }}>
              Establece tu contraseña
            </h1>
            <p style={{ fontSize: 14.5, color: '#9aa9a3' }}>
              Elige una contraseña para acceder a tu cuenta de Carp Partners TV
            </p>
          </div>
        )}

        <div
          className="px-[30px] py-8 rounded-[18px]"
          style={{
            background: 'rgba(14,21,26,0.7)',
            border: '1px solid rgba(255,255,255,0.09)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          }}
        >
          {!token ? (
            <InvalidLink />
          ) : done ? (
            <SuccessScreen onGoLogin={() => router.push('/login')} />
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              <FieldWrap
                label="Nueva contraseña"
                icon="lock"
                borderColor={border('pass')}
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
                  autoFocus
                  style={inputStyle}
                />
              </FieldWrap>

              <div className="flex gap-[5px] mt-[14px] mb-[18px]">
                {[1, 2, 3, 4].map(i => (
                  <div
                    key={i}
                    className="flex-1 rounded-[3px] transition-colors duration-300"
                    style={{ height: 4, background: strength >= i ? barColor : barOff }}
                  />
                ))}
              </div>

              <FieldWrap label="Confirma la contraseña" icon="lock" borderColor={border('confirm')} noMargin>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  onFocus={() => setFocus('confirm')}
                  onBlur={() => setFocus('')}
                  placeholder="••••••••"
                  style={inputStyle}
                />
              </FieldWrap>

              {apiError && <ErrorBanner message={apiError} />}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-[9px] mt-[22px] py-[15px] rounded-[11px] text-white font-bold text-[15px] transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: '#68140b', boxShadow: '0 8px 24px rgba(104,20,11,0.45)', border: 'none' }}
              >
                {loading
                  ? <><i className="ti ti-loader-2 animate-spin text-[18px]" />Guardando…</>
                  : <>Guardar contraseña<i className="ti ti-arrow-right text-[18px]" /></>
                }
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function InvalidLink() {
  return (
    <div className="text-center" style={{ padding: '8px 4px 4px' }}>
      <div
        className="flex items-center justify-center rounded-full mx-auto mb-[22px]"
        style={{ width: 64, height: 64, background: 'rgba(192,57,43,0.12)', border: '1px solid rgba(192,57,43,0.3)' }}
      >
        <i className="ti ti-link-off text-[31px]" style={{ color: '#ff8a80' }} />
      </div>
      <div className="font-display font-semibold mb-2.5" style={{ fontSize: 19, color: '#eef3f0' }}>
        Enlace inválido
      </div>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: '#9aa9a3', marginBottom: 24 }}>
        Este enlace no es válido o ha caducado. Pide uno nuevo a quien te lo envió.
      </p>
      <Link
        href="/login"
        className="inline-block w-full py-[14px] rounded-[11px] text-white font-bold text-[15px]"
        style={{ background: '#68140b', boxShadow: '0 8px 24px rgba(104,20,11,0.45)' }}
      >
        Ir a iniciar sesión
      </Link>
    </div>
  );
}

function SuccessScreen({ onGoLogin }: { onGoLogin: () => void }) {
  return (
    <div className="text-center" style={{ padding: '8px 4px 4px' }}>
      <div
        className="flex items-center justify-center rounded-full mx-auto mb-[22px]"
        style={{ width: 64, height: 64, background: 'rgba(104,20,11,0.16)', border: '1px solid rgba(207,74,53,0.35)' }}
      >
        <i className="ti ti-circle-check text-[31px]" style={{ color: '#cf4a35' }} />
      </div>
      <div className="font-display font-semibold mb-2.5" style={{ fontSize: 19, color: '#eef3f0' }}>
        Contraseña guardada
      </div>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: '#9aa9a3', marginBottom: 24 }}>
        Ya puedes iniciar sesión con tu correo y la nueva contraseña.
      </p>
      <button
        onClick={onGoLogin}
        className="w-full py-[14px] rounded-[11px] text-white font-bold text-[15px]"
        style={{ background: '#68140b', boxShadow: '0 8px 24px rgba(104,20,11,0.45)', border: 'none', cursor: 'pointer' }}
      >
        Iniciar sesión
      </button>
    </div>
  );
}

// ─── Componentes auxiliares (mismo estilo que /login) ─────────────────────────

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
      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#b3c0ba', marginBottom: 8 }}>
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
      className="mt-4 px-3 py-2.5 rounded-lg text-[13px] leading-snug"
      style={{ background: 'rgba(192,57,43,0.12)', border: '1px solid rgba(192,57,43,0.3)', color: '#ff8a80' }}
    >
      {message}
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: '#06090c' }} />}>
      <SetPasswordContent />
    </Suspense>
  );
}
