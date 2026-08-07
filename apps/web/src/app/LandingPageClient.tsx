'use client';

import React, { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import { LandingView } from '@/components/LandingView';

function LandingContent() {
  const { user, status, hasSubscription } = useSession();
  const router = useRouter();

  // Redirigir si ya tiene sesión
  useEffect(() => {
    if (status !== 'authenticated') return;
    if (user?.role === 'admin') router.replace('/admin');
    else if (hasSubscription) router.replace('/home');
  }, [status, user, hasSubscription, router]);

  return <LandingView />;
}

export function LandingPageClient() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <LandingContent />
    </Suspense>
  );
}
