'use client';

import React, { useEffect, useState } from 'react';

interface ProgressDotProps {
  active: boolean;
  /** Si hay auto-avance real para este carrusel (si no, se queda como punto estático simple). */
  autoplay: boolean;
  durationMs: number;
  onClick: () => void;
  label: string;
}

// Punto de carrusel que, mientras está activo y hay auto-avance, se rellena
// progresivamente hasta el cambio automático (como las stories de
// Instagram) en vez de ser un punto estático. El relleno se reinicia solo
// al activarse (useEffect ligado a `active`): opacity/width a 0 sin
// transición, y en el siguiente frame a 100% con `transition: width
// durationMs linear` — así la barra tarda exactamente lo mismo que el
// intervalo real de auto-avance del carrusel.
export function ProgressDot({ active, autoplay, durationMs, onClick, label }: ProgressDotProps) {
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    if (!active || !autoplay) { setFilled(false); return; }
    setFilled(false);
    const raf = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(raf);
  }, [active, autoplay, durationMs]);

  if (!autoplay) {
    return (
      <button
        onClick={onClick}
        aria-label={label}
        className="p-0 border-none cursor-pointer"
        style={{
          width: active ? 28 : 14,
          height: 5,
          borderRadius: 3,
          background: active ? '#cf4a35' : 'rgba(255,255,255,0.35)',
          transition: 'all .3s',
        }}
      />
    );
  }

  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="relative p-0 border-none cursor-pointer overflow-hidden"
      style={{
        width: active ? 28 : 14,
        height: 5,
        borderRadius: 3,
        background: active ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.35)',
        transition: 'width .3s, background .3s',
      }}
    >
      {active && (
        <div
          className="absolute inset-y-0 left-0"
          style={{
            width: filled ? '100%' : '0%',
            background: '#cf4a35',
            transition: filled ? `width ${durationMs}ms linear` : 'none',
          }}
        />
      )}
    </button>
  );
}
