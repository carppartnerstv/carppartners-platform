'use client';

import React from 'react';

export interface PaginationProps {
  total: number;
  page: number;        // 0-indexed
  pageSize: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  className?: string;
}

export function Pagination({
  total, page, pageSize, onPageChange, loading = false, className = '',
}: PaginationProps) {
  const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 1;
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to   = Math.min((page + 1) * pageSize, total);

  const isFirst = page === 0;
  const isLast  = page >= totalPages - 1;

  function btn(label: string, ariaLabel: string, onClick: () => void, disabled: boolean) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        aria-label={ariaLabel}
        className={[
          'inline-flex items-center justify-center w-8 h-8 rounded text-[13px] font-medium select-none',
          'border border-white/10 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-bright',
          disabled || loading
            ? 'bg-white/3 text-white/20 cursor-not-allowed'
            : 'bg-white/8 text-white/60 hover:text-white hover:bg-white/14 cursor-pointer',
        ].join(' ')}
      >
        {label}
      </button>
    );
  }

  return (
    <div className={`flex items-center justify-between gap-4 flex-wrap min-h-[2rem] ${className}`}>
      {/* Contador — siempre visible */}
      <p className="text-white/40 text-xs tabular-nums" aria-live="polite">
        {loading
          ? 'Cargando…'
          : total === 0
          ? '0 elementos'
          : totalPages === 1
          ? `${total.toLocaleString('es-ES')} ${total === 1 ? 'elemento' : 'elementos'}`
          : `${from.toLocaleString('es-ES')}–${to.toLocaleString('es-ES')} de ${total.toLocaleString('es-ES')} elementos`}
      </p>

      {/* Controles — solo si hay más de una página */}
      {totalPages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Paginación">
          {btn('«', 'Primera página',   () => onPageChange(0),             isFirst)}
          {btn('‹', 'Página anterior',  () => onPageChange(page - 1),      isFirst)}
          <span className="px-3 text-[11px] text-white/45 tabular-nums whitespace-nowrap select-none">
            Pág.&nbsp;{(page + 1).toLocaleString('es-ES')}&nbsp;de&nbsp;{totalPages.toLocaleString('es-ES')}
          </span>
          {btn('›', 'Página siguiente', () => onPageChange(page + 1),      isLast)}
          {btn('»', 'Última página',    () => onPageChange(totalPages - 1), isLast)}
        </nav>
      )}
    </div>
  );
}
