'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Mismos 4 destinos, mismos iconos (Tabler) y mismos colores activo/inactivo
// que la tab bar inferior de la app nativa (apps/mobile) — visible solo por
// debajo de md, y solo en las 4 pantallas "de app" (Inicio/Explorar/Mi
// Lista/Perfil); nunca en detalle/reproductor/login, igual que en la app.
const TABS = [
  { href: '/home', label: 'Inicio', icon: 'home' },
  { href: '/explorar', label: 'Explorar', icon: 'compass' },
  { href: '/mi-lista', label: 'Mi Lista', icon: 'bookmark' },
  { href: '/perfil', label: 'Perfil', icon: 'user' },
] as const;

export function MobileTabBar() {
  const pathname = usePathname();

  // Igual que en la app nativa (showTabs): solo en las 4 pantallas de app,
  // nunca en detalle de vídeo/serie, reproductor o ficha de crew.
  const showTabs = TABS.some((t) => pathname.startsWith(t.href));
  if (!showTabs) return null;

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex"
      style={{
        background: 'rgba(10,14,17,0.92)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        paddingTop: 8,
        paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
        paddingLeft: 6,
        paddingRight: 6,
      }}
    >
      {TABS.map(({ href, label, icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className="flex-1 flex flex-col items-center gap-[3px] py-1"
            style={{ color: active ? '#fff' : '#7d8d86' }}
          >
            <i className={`ti ti-${icon} text-[22px]`} />
            <span className="text-[10px] font-semibold">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
