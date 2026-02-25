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
          <Button 
            variant="outline" 
            onClick={() => router.push('/')}
            className="w-full h-14 rounded-none border-border font-bold uppercase tracking-widest text-xs gap-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à l'accueil
          </Button>
          <Button 
            variant="ghost" 
            onClick={handleLogout}
            className="w-full h-14 rounded-none text-muted-foreground hover:text-destructive font-bold uppercase tracking-widest text-xs gap-3"
          >
            <LogOut className="h-4 w-4" />
            Changer de compte
          </Button>
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
  
  const isPublicPage = pathname === '/login' || pathname === '/access-denied';

  useEffect(() => {
    if (isUserLoading || isMemberLoading || isPublicPage) return;

    if (!user) {
      router.replace('/login');
    }
  }, [user, isUserLoading, isMemberLoading, router, isPublicPage]);

  // 1. While loading auth or member profile, show institutional loader
  if ((isUserLoading || isMemberLoading) && !isPublicPage) {
    return (
      <MainLayout statusText="Vérification">
        <div className="flex flex-col items-center justify-center py-32 space-y-6">
          <div className="w-12 h-12 border-t-2 border-primary animate-spin rounded-full"></div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-bold">Sécurisation de l&apos;accès</p>
        </div>
      </MainLayout>
    );
  }

  // No user -> handle redirect via useEffect
  if (!user && !isPublicPage) return null;

  // 2. Authenticated but NO member profile found (should not happen with auto-creation, but safe-check)
  if (user && !member && !isPublicPage) {
    return (
      <RestrictedUI 
        title="Profil introuvable" 
        description="Votre compte n'est pas encore enregistré dans l'annuaire de l'assemblée." 
      />
    );
  }

  // 3. Member found but status is NOT 'active'
  if (user && member && !isActiveMember && !isPublicPage) {
    return (
      <RestrictedUI 
        title="Compte non activé" 
        description="Votre accès est en attente de validation ou a été révoqué par un administrateur." 
      />
    );
  }

  // 4. Admin section protection
  if (pathname.startsWith('/admin') && !isAdmin && !isPublicPage) {
    return (
      <RestrictedUI 
        title="Accès réservé" 
        description="Cette section est strictement réservée aux administrateurs certifiés." 
      />
    );
  }

  return <>{children}</>;
}
