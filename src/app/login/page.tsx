
'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { useAuth, useUser } from '@/firebase';
import { signInWithGoogle } from '@/firebase/non-blocking-login';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LogIn } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getRedirectResult } from 'firebase/auth';
import { useAuthStatus } from '@/components/auth/AuthStatusProvider';

export default function LoginPage() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const { isActiveMember, isMemberLoading } = useAuthStatus();
  const router = useRouter();

  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        await getRedirectResult(auth);
      } catch (error: any) {
        if (error.code !== 'auth/redirect-cancelled-by-user') {
          toast({
            variant: "destructive",
            title: "Erreur d'identification",
            description: "Impossible de finaliser la connexion Google.",
          });
        }
      }
    };
    handleRedirectResult();
  }, [auth]);

  // Redirection automatique si déjà connecté et actif
  useEffect(() => {
    if (!isUserLoading && !isMemberLoading && user && isActiveMember) {
      router.push('/');
    }
  }, [user, isUserLoading, isMemberLoading, isActiveMember, router]);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle(auth);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "La connexion a échoué.",
      });
    }
  };

  return (
    <MainLayout statusText="Identification">
      <div className="flex flex-col items-center justify-center py-24 space-y-12 animate-in fade-in duration-700">
        <header className="space-y-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-black">Ekklesia Vote</h1>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Accès réservé aux membres de l'assemblée.
          </p>
        </header>

        <div className="w-full max-w-sm space-y-6">
          <Button
            onClick={handleGoogleSignIn}
            disabled={isUserLoading}
            className="w-full h-14 bg-white hover:bg-secondary text-black border border-border rounded-none font-bold flex items-center justify-center gap-3 transition-all"
          >
            <LogIn className="h-5 w-5" />
            Se connecter avec Google
          </Button>

          <p className="text-[10px] uppercase tracking-widest text-center text-muted-foreground leading-relaxed">
            Votre compte doit être activé par un administrateur pour accéder aux votes.
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
