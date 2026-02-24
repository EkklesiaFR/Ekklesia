'use client';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuthStatus } from '@/components/auth/AuthStatusProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Cette page est désormais réservée à l'administration.
 * Elle redirige les membres classiques vers le dashboard.
 */
export default function ProjectsPage() {
  const { isAdmin, isMemberLoading } = useAuthStatus();
  const router = useRouter();

  useEffect(() => {
    if (!isMemberLoading && !isAdmin) {
      router.replace('/assembly');
    }
  }, [isAdmin, isMemberLoading, router]);

  return (
    <RequireActiveMember>
      <MainLayout statusText="Redirection Admin">
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <div className="w-12 h-12 border-t-2 border-primary animate-spin rounded-full"></div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
            Accès réservé aux administrateurs...
          </p>
        </div>
      </MainLayout>
    </RequireActiveMember>
  );
}
