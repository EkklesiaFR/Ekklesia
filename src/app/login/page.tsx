'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { useAuth, useUser } from '@/firebase';
import { signInWithGoogle } from '@/firebase/non-blocking-login';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogIn } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function LoginPage() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isUserLoading && user) {
      router.push('/');
    }
  }, [user, isUserLoading, router]);

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    try {
      await signInWithGoogle(auth);
      toast({
        title: "Connexion réussie",
        description: "Bienvenue sur la plateforme Ekklesia.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur de connexion",
        description: "Une erreur est survenue lors de l'identification avec Google.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MainLayout statusText="Identification">
      <div className="flex flex-col items-center justify-center py-24 space-y-12 animate-in fade-in duration-700">
        <header className="space-y-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Accès à l'assemblée</h1>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Identifiez-vous pour participer aux débats et exprimer votre vote.
          </p>
        </header>

        <div className="w-full max-w-sm space-y-6">
          <Button
            onClick={handleGoogleSignIn}
            disabled={isSubmitting || isUserLoading}
            className="w-full h-14 bg-white hover:bg-secondary text-black border border-border rounded-none font-bold flex items-center justify-center gap-3 transition-all"
          >
            {isSubmitting ? (
              "Authentification..."
            ) : (
              <>
                <LogIn className="h-5 w-5" />
                Continuer avec Google
              </>
            )}
          </Button>

          <p className="text-[10px] uppercase tracking-widest text-center text-muted-foreground leading-relaxed">
            Seuls les membres figurant sur la liste d'émargement officielle peuvent accéder aux sessions de vote.
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
