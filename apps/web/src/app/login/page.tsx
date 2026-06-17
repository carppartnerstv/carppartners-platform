'use client';

import React, { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Logo, Button } from '@carp-partners/ui';
import { useSession } from '@/context/SessionContext';
import { ApiError } from '@carp-partners/api-client';

type Mode = 'login' | 'register';

function LoginContent() {
  const { status, hasSubscription, login, register } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Si ya tiene sesión y suscripción, redirige al home
  useEffect(() => {
    if (status === 'authenticated' && hasSubscription) {
      router.replace('/home');
    }
  }, [status, hasSubscription, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, name || undefined);
      }
      // La redirección la gestiona el useEffect de arriba
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Ha ocurrido un error inesperado.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <Link href="/" className="mb-10">
        <Logo iconSize={36} />
      </Link>

      <div className="w-full max-w-sm bg-surface-raised rounded-xl p-8 shadow-2xl">
        {/* Tabs login / registro */}
        <div className="flex rounded-lg bg-surface overflow-hidden mb-6">
          {(['login', 'register'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              className={[
                'flex-1 py-2 text-sm font-semibold transition-colors',
                mode === m
                  ? 'bg-brand text-white'
                  : 'text-white/50 hover:text-white',
              ].join(' ')}
            >
              {m === 'login' ? 'Iniciar sesión' : 'Registrarse'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <Field
              label="Nombre"
              type="text"
              value={name}
              onChange={setName}
              placeholder="Tu nombre"
              autoFocus
            />
          )}
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="tu@email.com"
            autoFocus={mode === 'login'}
            required
          />
          <Field
            label="Contraseña"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            required
          />

          {error && (
            <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={loading}
            className="w-full mt-2"
          >
            {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </Button>
        </form>

        {mode === 'login' && (
          <p className="text-center text-white/40 text-xs mt-6">
            ¿No tienes cuenta?{' '}
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className="text-brand hover:underline"
            >
              Regístrate aquí
            </button>
          </p>
        )}

        <p className="text-center text-white/30 text-xs mt-4">
          <Link href="/" className="hover:text-white/60 transition-colors">
            ← Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <LoginContent />
    </Suspense>
  );
}

// ─── Campo de formulario reutilizable ─────────────────────────────────────────

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  required,
  autoFocus,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-white/60 text-xs font-medium uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        className="bg-surface border border-white/10 rounded px-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-brand transition-colors"
      />
    </div>
  );
}
