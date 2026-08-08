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
 * volver atrás, que se aplica DESPUÉS de este efecto y puede pisarlo. En
 * móvil, además, la barra de direcciones se contrae/expande durante la
 * navegación y ese cambio de altura del viewport puede introducir un
 * pequeño desplazamiento hacia abajo aunque ya hayamos puesto scrollY a 0.
 * Por eso se reafirma varias veces en la ventana justo después de navegar
 * (frames + timeouts cortos) en vez de una sola vez — a partir de ahí se
 * deja de tocar el scroll para no pelear con el usuario si decide bajar.
 */
export function ScrollToTop() {
  const pathname = usePathname();

  useIsomorphicLayoutEffect(() => {
    window.scrollTo(0, 0);

    const raf1 = requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      requestAnimationFrame(() => window.scrollTo(0, 0));
    });
    const timers = [50, 150, 300].map((ms) => setTimeout(() => window.scrollTo(0, 0), ms));

    return () => {
      cancelAnimationFrame(raf1);
      timers.forEach(clearTimeout);
    };
  }, [pathname]);

  return null;
}
