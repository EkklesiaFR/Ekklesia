'use client';

import { useEffect, ReactNode, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser } from '@/firebase';
import { useAuthStatus } from './AuthStatusProvider';
import { MainLayout } from '@/components/layout/MainLayout';

/**
 * Composant Guard pour protéger l'accès aux pages privées.
 * Utilise un délai de grâce pour éviter les flashs de redirection lors du chargement des profils.
 */
export function RequireActiveMember({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isUserLoading } = useUser();
  const { isMemberLoading, isActiveMember, isAdmin, member } = useAuthStatus();
  
  // État local pour gérer la période de grâce (évite le flash "Access Denied" au login)
  const [isWaitingForGracePeriod, setIsWaitingForGracePeriod] = useState(false);

  useEffect(() => {
    // 1. On ne fait rien tant que Firebase Auth ou le Provider Membre chargent
    if (isUserLoading || isMemberLoading) return;

    // 2. Whitelist : Ne pas appliquer de redirection sur les pages de login ou d'erreur
    const isPublicPage = pathname === '/login' || pathname === '/access-denied';
    if (isPublicPage) return;

    // 3. Utilisateur non authentifié -> Login
    if (!user) {
      router.replace('/login');
      return;
    }

    // 4. Utilisateur authentifié mais profil membre introuvable
    // On applique un délai de grâce avant de considérer que le membre n'existe vraiment pas
    if (!member) {
      setIsWaitingForGracePeriod(true);
      const timer = setTimeout(() => {
        // Si après 800ms le membre est toujours null, on redirige
        router.replace('/access-denied?reason=no_member');
      }, 800);
      return () => clearTimeout(timer);
    } else {
      setIsWaitingForGracePeriod(false);
    }

    // 5. Profil membre trouvé mais état non actif (ex: pending ou revoked)
    if (!isActiveMember) {
      router.replace('/access-denied?reason=inactive');
      return;
    }

    // 6. Protection spécifique de la section Administration
    if (pathname.startsWith('/admin') && !isAdmin) {
      router.replace('/access-denied?reason=admin');
      return;
    }
  }, [user, isUserLoading, isMemberLoading, isActiveMember, isAdmin, member, router, pathname]);

  // Autorisation finale pour le rendu
  const isAuthorized = user && isActiveMember && (!pathname.startsWith('/admin') || isAdmin);
  const isSpecialPage = pathname === '/login' || pathname === '/access-denied';

  // Pendant le chargement ou la période de grâce, on affiche un loader propre
  if ((isUserLoading || isMemberLoading || isWaitingForGracePeriod) && !isSpecialPage) {
    return (
      <MainLayout statusText="Vérification">
        <div className="flex flex-col items-center justify-center py-32 space-y-6 animate-in fade-in duration-500">
          <div className="w-12 h-12 border-t-2 border-primary animate-spin rounded-full"></div>
          <div className="text-center space-y-2">
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-bold">
              Sécurisation de l&apos;accès
            </p>
            <p className="text-xs text-muted-foreground italic">Vérification de vos accréditations...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Si on est sur une page publique ou autorisé, on affiche le contenu
  return <>{(isAuthorized || isSpecialPage) ? children : null}</>;
}
