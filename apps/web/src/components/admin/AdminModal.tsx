'use client';

import React, { useEffect, useRef } from 'react';

interface AdminModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Ancho máximo del panel. Default: max-w-xl */
  maxWidth?: string;
  /** 'dark' (default) = admin sin migrar (p. ej. Suscriptores). 'light' = panel admin rediseñado. */
  theme?: 'dark' | 'light';
  /**
   * Contenido fijo al pie del panel (p. ej. los botones Guardar/Cancelar),
   * siempre visible aunque el cuerpo tenga scroll — igual que la cabecera.
   * Si el formulario vive dentro de `children`, dale un `id` y enlaza el
   * botón de envío con `form="ese-id"` (atributo HTML nativo), ya que el
   * footer se renderiza fuera del <form>.
   */
  footer?: React.ReactNode;
}

/**
 * Panel lateral deslizante desde la derecha para formularios admin.
 * Cierra con Escape o click en el overlay.
 */
export function AdminModal({ title, open, onClose, children, maxWidth = 'max-w-xl', theme = 'dark', footer }: AdminModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const light = theme === 'light';

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={[
          'relative ml-auto h-full w-full', maxWidth, 'flex flex-col overflow-hidden',
          light
            ? 'bg-admin-surface border-l border-admin-border shadow-[−8px_0_32px_rgba(20,20,22,0.12)]'
            : 'bg-surface-raised border-l border-white/10 shadow-[−8px_0_32px_rgba(0,0,0,0.5)]',
        ].join(' ')}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 shrink-0 border-b ${light ? 'border-admin-border-soft' : 'border-white/10'}`}>
          <h2 className={`font-display text-[17px] font-semibold ${light ? 'text-admin-text' : 'text-white'}`}>{title}</h2>
          <button
            onClick={onClose}
            className={[
              'w-8 h-8 flex items-center justify-center rounded-md transition-colors',
              light ? 'text-admin-text-secondary hover:text-admin-text hover:bg-admin-bg' : 'text-white/50 hover:text-white hover:bg-white/8',
            ].join(' ')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cuerpo con scroll */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>

        {/* Footer fijo (opcional) */}
        {footer && (
          <div className={`shrink-0 px-6 py-4 border-t ${light ? 'border-admin-border-soft bg-admin-surface' : 'border-white/10 bg-surface-raised'}`}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
