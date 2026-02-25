'use client';

import { useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser } from '@/firebase';
import { useAuthStatus } from './AuthStatusProvider';
import { MainLayout } from '@/components/layout/MainLayout';

/**
 * Composant Guard pour protéger l'accès aux pages privées.
 * Amélioré pour fournir des raisons spécifiques lors de la redirection.
 */
export function RequireActiveMember({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isUserLoading } = useUser();
  const { isMemberLoading, isActiveMember, isAdmin, member } = useAuthStatus();

  useEffect(() => {
    if (isUserLoading || isMemberLoading) return;

    // 1. Non connecté
    if (!user) {
      router.replace('/login');
      return;
    }

    // 2. Pas de doc membre du tout
    if (!member && pathname !== '/access-denied') {
      router.replace('/access-denied?reason=no_member');
      return;
    }

    // 3. Membre existe mais pas actif
    if (!isActiveMember && pathname !== '/access-denied') {
      router.replace('/access-denied?reason=inactive');
      return;
    }

    // 4. Protection route admin
    if (pathname.startsWith('/admin') && !isAdmin) {
      router.replace('/access-denied?reason=admin');
      return;
    }
  }, [user, isUserLoading, isMemberLoading, isActiveMember, isAdmin, member, router, pathname]);

  // Détermination de l'autorisation finale pour l'affichage conditionnel
  const isAuthorized = user && isActiveMember && (!pathname.startsWith('/admin') || isAdmin);

  if (isUserLoading || isMemberLoading || !isAuthorized) {
    return (
      <MainLayout statusText="Vérification">
        <div className="flex flex-col items-center justify-center py-32 space-y-6">
          <div className="w-12 h-12 border-t-2 border-primary animate-spin rounded-full"></div>
          <div className="text-center space-y-2">
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-bold">
              Vérification des Accès
            </p>
            <p className="text-xs text-muted-foreground italic">Sécurisation de la session en cours...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return <>{children}</>;
}
