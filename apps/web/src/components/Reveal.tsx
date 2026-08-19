'use client';

import React, { useEffect, useRef, useState } from 'react';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Retraso en ms — para escalonar varios Reveal seguidos (cards de una grid, etc.) */
  delayMs?: number;
  /** Dirección de entrada — 'up' (por defecto) o lateral ('left'/'right'). */
  from?: 'up' | 'left' | 'right';
}

const HIDDEN_TRANSFORM: Record<NonNullable<RevealProps['from']>, string> = {
  up: 'translateY(26px)',
  left: 'translateX(-40px)',
  right: 'translateX(40px)',
};

// Fade-in + desplazamiento al entrar en el viewport, vía IntersectionObserver
// (no CSS puro: así solo se anima la primera vez que el elemento aparece en
// pantalla, no se repite en cada scroll hacia arriba/abajo).
export function Reveal({ children, className = '', style, delayMs = 0, from = 'up' }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translate(0,0)' : HIDDEN_TRANSFORM[from],
        transition: `opacity 700ms ease ${delayMs}ms, transform 700ms ease ${delayMs}ms`,
      }}
    >
      {children}
    </div>
  );
}
