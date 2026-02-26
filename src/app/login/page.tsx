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

export default function LoginPage() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
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
            description: "La connexion a échoué.",
          });
        }
      }
    };
    handleRedirectResult();
  }, [auth]);

  useEffect(() => {
    if (!isUserLoading && user) {
      router.replace('/assembly');
    }
  }, [user, isUserLoading, router]);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle(auth);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: "La connexion Google a échoué." });
    }
  };

  return (
    <MainLayout statusText="Identification">
      <div className="flex flex-col items-center justify-center py-24 space-y-10 animate-in fade-in duration-700">
        <header className="space-y-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-black">Ekklesia Vote</h1>
          <p className="text-muted-foreground max-w-sm mx-auto">Connectez-vous avec votre compte Google institutionnel pour accéder à l'assemblée.</p>
        </header>

        <div className="w-full max-w-sm">
          <Button 
            onClick={handleGoogleSignIn} 
            disabled={isUserLoading}
            variant="outline" 
            className="w-full h-16 bg-white hover:bg-secondary text-black border-2 border-black rounded-none font-bold flex items-center justify-center gap-4 transition-all text-xs uppercase tracking-widest"
          >
            <LogIn className="h-5 w-5" /> Continuer avec Google
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}