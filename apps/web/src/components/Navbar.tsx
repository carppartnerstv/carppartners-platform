'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Logo } from '@carp-partners/ui';
import { useSession } from '@/context/SessionContext';

const NAV_LINKS = [
  { href: '/home',     label: 'Inicio' },
  { href: '/explorar', label: 'Explorar' },
  { href: '/mi-lista', label: 'Mi lista' },
];

export function Navbar() {
  const { user, status, logout } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    router.push('/');
  };

  const initials = user?.name
    ? user.name.split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16
                       bg-gradient-to-b from-black/75 to-transparent
                       backdrop-blur-[2px]">
      <div className="flex items-center justify-between h-full px-6 md:px-12">
        {/* Logo */}
        <Link href={status === 'authenticated' ? '/home' : '/'} className="shrink-0">
          <Logo iconSize={25} />
        </Link>

        {/* Nav links — solo autenticado */}
        {status === 'authenticated' && (
          <nav className="hidden md:flex items-center gap-7 absolute left-1/2 -translate-x-1/2">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={[
                  'text-[13.5px] font-medium transition-colors duration-150',
                  pathname.startsWith(href)
                    ? 'text-white'
                    : 'text-white/55 hover:text-white',
                ].join(' ')}
              >
                {label}
              </Link>
            ))}
          </nav>
        )}

        {/* Derecha */}
        <div className="relative flex items-center gap-3">
          {status === 'authenticated' && user ? (
            <>
              {/* Search icon */}
              <Link href="/explorar" aria-label="Buscar">
                <button className="w-9 h-9 rounded-full flex items-center justify-center
                                   text-white/60 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </button>
              </Link>

              {/* Avatar + chevron */}
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-1.5 group"
              >
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center
                             text-white text-[13px] font-semibold font-display
                             border border-white/20 shadow-sm"
                  style={{ background: 'linear-gradient(135deg,#5a241d,#2a1411)' }}
                >
                  {initials}
                </span>
                <svg
                  className={`w-3.5 h-3.5 text-white/50 group-hover:text-white transition-all duration-200 ${menuOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown */}
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-11 z-50 w-52 rounded-menu bg-surface-raised
                                  border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)]
                                  overflow-hidden">
                    {/* Header del menú */}
                    <div className="px-4 py-3 border-b border-white/10">
                      <p className="text-white text-sm font-semibold truncate">
                        {user.name ?? user.email}
                      </p>
                      <p className="text-cp-gray text-xs truncate mt-0.5">{user.email}</p>
                    </div>
                    <Link
                      href="/perfil"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-white/80
                                 hover:bg-white/8 hover:text-white transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Perfil
                    </Link>
                    {user.role === 'admin' && (
                      <Link
                        href="/admin"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-white/80
                                   hover:bg-white/8 hover:text-white transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Admin
                      </Link>
                    )}
                    <hr className="border-white/10" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm
                                 text-white/55 hover:bg-white/8 hover:text-white transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Cerrar sesión
                    </button>
                  </div>
                </>
              )}
            </>
          ) : status !== 'loading' ? (
            <Link
              href="/login"
              className="text-[13.5px] font-semibold text-white bg-brand hover:brightness-110
                         px-4 py-1.5 rounded-btn transition-all shadow-btn-primary"
            >
              Entrar
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
