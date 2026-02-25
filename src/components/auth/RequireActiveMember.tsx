'use client';

import { useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser } from '@/firebase';
import { useAuthStatus } from './AuthStatusProvider';
import { MainLayout } from '@/components/layout/MainLayout';

/**
 * Composant Guard pour protéger l'accès aux pages privées.
 * Empêche les redirections hâtives pendant le chargement des profils.
 */
export function RequireActiveMember({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isUserLoading } = useUser();
  const { isMemberLoading, isActiveMember, isAdmin, member } = useAuthStatus();

  useEffect(() => {
    // RÈGLE D'OR : On ne redirige JAMAIS tant qu'on n'a pas fini de charger
    if (isUserLoading || isMemberLoading) return;

    // Ne pas protéger les pages qui gèrent elles-mêmes le refus ou le login
    const isPublicPage = pathname === '/login' || pathname === '/access-denied';
    if (isPublicPage) return;

    // 1. Utilisateur non authentifié
    if (!user) {
      router.replace('/login');
      return;
    }

    // 2. Utilisateur authentifié mais profil membre inexistant dans Firestore
    if (!member) {
      router.replace('/access-denied?reason=no_member');
      return;
    }

    // 3. Profil membre trouvé mais état non actif (ex: pending ou revoked)
    if (!isActiveMember) {
      router.replace('/access-denied?reason=inactive');
      return;
    }

    // 4. Protection spécifique de la section Administration
    if (pathname.startsWith('/admin') && !isAdmin) {
      router.replace('/access-denied?reason=admin');
      return;
    }
  }, [user, isUserLoading, isMemberLoading, isActiveMember, isAdmin, member, router, pathname]);

  // Autorisation finale pour le rendu
  const isAuthorized = user && isActiveMember && (!pathname.startsWith('/admin') || isAdmin);
  const isSpecialPage = pathname === '/login' || pathname === '/access-denied';

  if ((isUserLoading || isMemberLoading) && !isSpecialPage) {
    return (
      <MainLayout statusText="Vérification">
        <div className="flex flex-col items-center justify-center py-32 space-y-6">
          <div className="w-12 h-12 border-t-2 border-primary animate-spin rounded-full"></div>
          <div className="text-center space-y-2">
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-bold">
              Identification en cours
            </p>
            <p className="text-xs text-muted-foreground italic">Sécurisation de l'accès à l'assemblée...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Si on est sur une page publique ou autorisé, on affiche les enfants
  return <>{(isAuthorized || isSpecialPage) ? children : null}</>;
}
