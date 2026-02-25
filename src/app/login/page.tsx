'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useUser } from '@/firebase';
import { signInWithGoogle, signInEmail } from '@/firebase/non-blocking-login';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogIn, Mail, Lock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getRedirectResult } from 'firebase/auth';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';

export default function LoginPage() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

  useEffect(() => {
    if (!isUserLoading && user) {
      router.replace('/assembly');
    }
  }, [user, isUserLoading, router]);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle(auth);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "La connexion Google a échoué.",
      });
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoading(true);
    try {
      await signInEmail(auth, email, password);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur de connexion",
        description: "Email ou mot de passe incorrect.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout statusText="Identification">
      <div className="flex flex-col items-center justify-center py-12 space-y-10 animate-in fade-in duration-700">
        <header className="space-y-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-black">Ekklesia Vote</h1>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Connectez-vous pour participer aux décisions de l'assemblée.
          </p>
        </header>

        <div className="w-full max-w-sm space-y-8">
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="nom@exemple.com" 
                  className="pl-10 rounded-none h-12" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password">Mot de passe</Label>
                <Link href="/forgot-password" size="sm" className="text-xs text-muted-foreground hover:text-black">
                  Oublié ?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="password" 
                  type="password" 
                  className="pl-10 rounded-none h-12" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={isLoading || isUserLoading}
              className="w-full h-12 rounded-none font-bold uppercase tracking-widest text-xs"
            >
              {isLoading ? "Connexion..." : "Se connecter"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground font-bold">ou</span>
            </div>
          </div>

          <Button
            onClick={handleGoogleSignIn}
            disabled={isUserLoading}
            variant="outline"
            className="w-full h-12 bg-white hover:bg-secondary text-black border border-border rounded-none font-bold flex items-center justify-center gap-3 transition-all text-xs uppercase tracking-widest"
          >
            <LogIn className="h-4 w-4" />
            Continuer avec Google
          </Button>

          <p className="text-center text-sm text-muted-foreground pt-4">
            Pas encore membre ?{" "}
            <Link href="/signup" className="font-bold text-black hover:underline">
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </MainLayout>
  );
}