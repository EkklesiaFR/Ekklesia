'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { signInWithGoogle } from '@/firebase/non-blocking-login';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogIn } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { doc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

export default function LoginPage() {
  const auth = useAuth();
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // We only redirect if the user is authenticated AND we've verified they are allowed
  // For the redirect check, we'll rely on the fact that if they logged in via this page, 
  // we already did the check. If they are already logged in, we verify one last time.
  useEffect(() => {
    if (!isUserLoading && user) {
      const checkAllowlist = async () => {
        const email = user.email?.toLowerCase();
        if (!email) {
          await signOut(auth);
          return;
        }
        
        const allowlistRef = doc(db, 'emailAllowlist', email);
        const allowlistSnap = await getDoc(allowlistRef);
        
        if (allowlistSnap.exists()) {
          router.push('/');
        } else {
          await signOut(auth);
          toast({
            variant: "destructive",
            title: "Accès refusé",
            description: "Accès réservé aux membres invités (bêta).",
          });
        }
      };
      
      checkAllowlist();
    }
  }, [user, isUserLoading, router, auth, db]);

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    try {
      await signInWithGoogle(auth);
      // The useEffect above will handle the allowlist check and redirection
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur de connexion",
        description: "Une erreur est survenue lors de l'identification avec Google.",
      });
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
              "Vérification..."
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
