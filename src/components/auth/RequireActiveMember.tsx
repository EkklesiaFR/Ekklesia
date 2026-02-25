'use client';

import { useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser, useAuth } from '@/firebase';
import { useAuthStatus } from './AuthStatusProvider';
import { MainLayout } from '@/components/layout/MainLayout';
import { ShieldAlert, LogOut, ArrowLeft, MailWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { signOut } from 'firebase/auth';

function RestrictedUI({ title, description, icon: Icon = ShieldAlert, showEmailWarning = false }: { title: string; description: string, icon?: any, showEmailWarning?: boolean }) {
  const auth = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.replace('/login');
  };

  return (
    <MainLayout statusText="Accès Restreint">
      <div className="flex flex-col items-center justify-center py-24 space-y-8 text-center animate-in fade-in duration-700">
        <Icon className="h-16 w-16 text-destructive" />
        <header className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground max-w-md mx-auto">{description}</p>
          {showEmailWarning && (
            <p className="text-sm font-bold text-primary bg-primary/5 p-4 mt-4 border border-primary/20">
              Veuillez vérifier votre boîte mail avant de continuer.
            </p>
          )}
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
  
  const isPublicPage = pathname === '/login' || pathname === '/signup' || pathname === '/forgot-password' || pathname === '/access-denied';

  useEffect(() => {
    if (isUserLoading || isMemberLoading || isPublicPage) return;

    if (!user) {
      router.replace('/login');
    }
  }, [user, isUserLoading, isMemberLoading, router, isPublicPage]);

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

  if (!user && !isPublicPage) return null;

  if (user && !member && !isPublicPage) {
    return (
      <RestrictedUI 
        title="Profil introuvable" 
        description="Votre compte n'est pas encore enregistré dans l'annuaire de cette assemblée." 
      />
    );
  }

  // Email verification check
  const isEmailVerified = user?.emailVerified || user?.providerData[0]?.providerId === 'google.com';
  if (user && !isEmailVerified && !isPublicPage) {
    return (
      <RestrictedUI 
        title="Email non vérifié" 
        description="Votre adresse email doit être validée pour accéder aux scrutins."
        icon={MailWarning}
        showEmailWarning={true}
      />
    );
  }

  // Active or Admin check
  const hasAccess = isActiveMember || isAdmin;

  if (user && member && !hasAccess && !isPublicPage) {
    return (
      <RestrictedUI 
        title="Compte non activé" 
        description="Votre adhésion est en attente de validation par un administrateur." 
      />
    );
  }

  if (pathname.startsWith('/admin') && !isAdmin && !isPublicPage) {
    return (
      <RestrictedUI 
        title="Accès réservé" 
        description="Cette section nécessite des privilèges d'administration." 
      />
    );
  }

  return <>{children}</>;
}
