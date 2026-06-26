'use client';

import React, {
  createContext, useContext, useState, useCallback, useEffect, useRef,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (type: ToastType, message: string) => void;
}

// ─── Context / hook ───────────────────────────────────────────────────────────

const ToastCtx = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// ─── Single toast card ────────────────────────────────────────────────────────

const AUTO_CLOSE_MS = 3500;

function ToastCard({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  // Keep a stable ref so the cleanup in useEffect doesn't stale-close
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const t = setTimeout(() => onCloseRef.current(), AUTO_CLOSE_MS);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isError = item.type === 'error';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={[
        'toast-enter',
        'flex items-start gap-3 w-80 max-w-[calc(100vw-2.5rem)]',
        'rounded-lg px-4 py-3',
        'shadow-[0_8px_32px_rgba(0,0,0,0.55)]',
        isError
          ? 'bg-red-600 text-white border border-red-400/40'
          : 'bg-emerald-600 text-white border border-emerald-400/40',
      ].join(' ')}
    >
      {/* Icono */}
      <span className="mt-0.5 shrink-0 text-white/90">
        {isError ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </span>

      {/* Mensaje */}
      <p className="flex-1 text-sm leading-snug">{item.message}</p>

      {/* Cerrar manualmente */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar notificación"
        className="shrink-0 mt-0.5 opacity-40 hover:opacity-80 transition-opacity"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts(prev => [...prev.slice(-4), { id, type, message }]); // máx 5 apilados
  }, []);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      {/* Stack fijo — arriba a la derecha, encima del sidebar */}
      <div
        aria-label="Notificaciones"
        className="fixed top-5 right-5 z-[9999] flex flex-col gap-2 items-end pointer-events-none"
      >
        {toasts.map(item => (
          <div key={item.id} className="pointer-events-auto">
            <ToastCard item={item} onClose={() => remove(item.id)} />
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
