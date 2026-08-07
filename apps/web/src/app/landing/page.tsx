'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { LandingView } from '@/components/LandingView';

// Vista previa de la landing pública para administradores: misma UI que `/`,
// pero sin la redirección automática a /admin que aplica esa ruta.

export default function AdminLandingPreviewPage() {
  const { user, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated' || user?.role !== 'admin') router.replace('/');
  }, [status, user, router]);

  if (status !== 'authenticated' || user?.role !== 'admin') return null;

  return <LandingView />;
}
