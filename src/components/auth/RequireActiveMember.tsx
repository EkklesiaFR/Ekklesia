
'use client';

import { useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser } from '@/firebase';
import { useAuthStatus } from './AuthStatusProvider';
import { MainLayout } from '@/components/layout/MainLayout';

/**
 * Composant Guard pour protéger l'accès aux pages privées.
 */
export function RequireActiveMember({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isUserLoading } = useUser();
  const { isMemberLoading, isActiveMember, isAdmin } = useAuthStatus();

  useEffect(() => {
    if (isUserLoading || isMemberLoading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (!isActiveMember && pathname !== '/access-denied') {
      router.replace('/access-denied');
      return;
    }

    // Protection pour la route admin
    if (pathname.startsWith('/admin') && !isAdmin) {
      router.replace('/access-denied');
      return;
    }
  }, [user, isUserLoading, isMemberLoading, isActiveMember, isAdmin, router, pathname]);

  // Détermination de l'autorisation pour l'affichage
  const isAuthorized = user && isActiveMember && (!pathname.startsWith('/admin') || isAdmin);

  if (isUserLoading || isMemberLoading || !isAuthorized) {
    return (
      <MainLayout statusText="Vérification">
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <div className="w-12 h-12 border-t-2 border-primary animate-spin rounded-full"></div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
            Vérification de vos accès...
          </p>
        </div>
      </MainLayout>
    );
  }

  return <>{children}</>;
}
