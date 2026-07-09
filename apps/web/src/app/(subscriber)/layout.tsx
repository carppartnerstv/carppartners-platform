'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { Navbar } from '@/components/Navbar';
import { ScrollToTop } from '@/components/ScrollToTop';

/**
 * Layout protegido: exige sesión activa y suscripción vigente.
 * - Sin sesión → /login
 * - Con sesión pero sin suscripción → / (landing con planes)
 */
export default function SubscriberLayout({ children }: { children: React.ReactNode }) {
  const { status, hasSubscription } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }

    if (!hasSubscription) {
      router.replace('/planes');
    }
  }, [status, hasSubscription, router]);

  // Spinner mientras carga la sesión
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <svg className="animate-spin w-10 h-10 text-brand" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (status === 'unauthenticated' || !hasSubscription) return null;

  return (
    <>
      <ScrollToTop />
      <Navbar />
      <main className="pt-16">{children}</main>
    </>
  );
}
