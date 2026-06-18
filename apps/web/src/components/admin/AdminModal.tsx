'use client';

import React, { useEffect, useRef } from 'react';

interface AdminModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Ancho máximo del panel. Default: max-w-xl */
  maxWidth?: string;
}

/**
 * Panel lateral deslizante desde la derecha para formularios admin.
 * Cierra con Escape o click en el overlay.
 */
export function AdminModal({ title, open, onClose, children, maxWidth = 'max-w-xl' }: AdminModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

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
        className={`relative ml-auto h-full w-full ${maxWidth} bg-surface-raised
                    border-l border-white/10 shadow-[−8px_0_32px_rgba(0,0,0,0.5)]
                    flex flex-col overflow-hidden`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <h2 className="font-display text-[17px] font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md text-white/50
                       hover:text-white hover:bg-white/8 transition-colors"
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
      </div>
    </div>
  );
}
