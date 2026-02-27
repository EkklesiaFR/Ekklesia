'use client';

import { useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser, useAuth } from '@/firebase';
import { useAuthStatus } from './AuthStatusProvider';
import { MainLayout } from '@/components/layout/MainLayout';
import { ShieldAlert, LogOut, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { signOut } from 'firebase/auth';

function RestrictedUI({ title, description }: { title: string; description: string }) {
  const auth = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.replace('/login');
  };

  return (
    <MainLayout statusText="Accès Restreint">
      <div className="flex flex-col items-center justify-center py-24 space-y-8 text-center animate-in fade-in duration-700">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        <header className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground max-w-md mx-auto">{description}</p>
        </header>
        <div className="pt-8 space-y-4 w-full max-w-sm">
          <Button variant="outline" onClick={() => router.push('/')} className="w-full h-14 rounded-none font-bold uppercase tracking-widest text-xs gap-3"><ArrowLeft className="h-4 w-4" /> Accueil</Button>
          <Button variant="ghost" onClick={handleLogout} className="w-full h-14 rounded-none text-muted-foreground font-bold uppercase tracking-widest text-xs gap-3"><LogOut className="h-4 w-4" /> Déconnexion</Button>
        </div>
      </div>
    </MainLayout>
  );
}

export function RequireActiveMember({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isUserLoading } = useUser();
  const { isMemberLoading, isActiveMember, isAdmin, member } = useAuthStatus();
  
  const isPublicPage = ['/login', '/signup', '/forgot-password', '/access-denied'].includes(pathname);

  useEffect(() => {
    if (isUserLoading || isMemberLoading || isPublicPage) return;

    // Si pas de user du tout, on renvoie vers login
    if (!user) {
      console.log('[GUARD] No user -> redirecting to /login');
      router.replace('/login');
      return;
    }

    console.log('[GUARD] User detected, path:', pathname, 'status:', member?.status);
  }, [user, isUserLoading, isMemberLoading, router, isPublicPage, pathname, member]);

  // Écran de chargement global pendant la résolution de l'auth ou du profil
  if ((isUserLoading || (user && isMemberLoading)) && !isPublicPage) {
    return (
      <MainLayout statusText="Vérification">
        <div className="flex flex-col items-center justify-center py-32 space-y-6">
          <div className="w-12 h-12 border-t-2 border-primary animate-spin rounded-full"></div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Chargement de votre session sécurisée...</p>
        </div>
      </MainLayout>
    );
  }

  // Empêcher le rendu si on redirige vers /login
  if (!user && !isPublicPage) return null;

  // Gestion du cas "Compte en attente" ou "Bloqué"
  // On ne redirige pas vers /login, on affiche une UI restreinte
  if (user && !isPublicPage && !isActiveMember && !isAdmin) {
    return <RestrictedUI title="Compte en attente" description="Votre demande d'adhésion est en cours de validation par l'assemblée." />;
  }

  // Protection des routes admin
  if (pathname.startsWith('/admin') && !isAdmin && !isPublicPage) {
    return <RestrictedUI title="Accès réservé" description="Droits d'administration requis pour accéder à cette console." />;
  }

  return <>{children}</>;
}
