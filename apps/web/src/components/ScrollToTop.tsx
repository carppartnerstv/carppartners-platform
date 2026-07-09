'use client';

import { useEffect, useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * En cada cambio de ruta lleva el scroll a 0, siempre — también al volver
 * atrás (botón del navegador o router.back()). Las páginas cargan sus datos
 * de forma asíncrona, así que restaurar la posición exacta de scroll al
 * volver no es fiable; consistente > fiel al historial.
 *
 * Next.js App Router tiene su propia restauración automática de scroll al
 * volver atrás, que se aplica DESPUÉS de este efecto y puede pisarlo — por
 * eso se repite el scrollTo en el siguiente frame, para ganar esa carrera.
 */
export function ScrollToTop() {
  const pathname = usePathname();

  useIsomorphicLayoutEffect(() => {
    window.scrollTo(0, 0);
    const raf = requestAnimationFrame(() => window.scrollTo(0, 0));
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  return null;
}
