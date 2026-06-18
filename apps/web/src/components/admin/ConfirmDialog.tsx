'use client';

import React from 'react';
import { Button } from '@carp-partners/ui';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({
  open, title, message, confirmLabel = 'Eliminar',
  onConfirm, onCancel, loading = false,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative bg-surface-raised border border-white/12 rounded-menu
                      shadow-[0_16px_48px_rgba(0,0,0,0.7)] w-full max-w-sm p-6 space-y-4">
        <h3 className="font-display text-[16px] font-semibold text-white">{title}</h3>
        <p className="text-white/60 text-sm leading-relaxed">{message}</p>
        <div className="flex gap-3 pt-1">
          <Button variant="danger" size="sm" onClick={onConfirm} loading={loading} className="flex-1 justify-center">
            {confirmLabel}
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading} className="flex-1 justify-center">
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
