
'use client';

import { useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser } from '@/firebase';
import { useAuthStatus } from './AuthStatusProvider';
import { MainLayout } from '@/components/layout/MainLayout';

export function RequireActiveMember({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isUserLoading } = useUser();
  const { member, isMemberLoading, isActiveMember, isAdmin } = useAuthStatus();

  useEffect(() => {
    if (isUserLoading || isMemberLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (!isActiveMember && pathname !== '/access-denied') {
      router.push('/access-denied');
      return;
    }

    // Protection supplémentaire pour /admin
    if (pathname.startsWith('/admin') && !isAdmin) {
      router.push('/');
      return;
    }
  }, [user, isUserLoading, isMemberLoading, isActiveMember, isAdmin, router, pathname]);

  if (isUserLoading || isMemberLoading) {
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

  // Si on est sur une route protégée et que les conditions sont remplies
  if (user && isActiveMember) {
    return <>{children}</>;
  }

  return null;
}
