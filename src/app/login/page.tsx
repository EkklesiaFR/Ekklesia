'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  Mail,
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GlassCard } from '@/components/ui/glass-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

import { useAuth } from '@/firebase';
import { signInEmail, signInWithGoogle, linkAccount } from '@/firebase/non-blocking-login';
import { useAuthStatus } from '@/components/auth/AuthStatusProvider';
import { toast } from '@/hooks/use-toast';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        d="M21.805 10.023H12.24v3.955h5.48c-.236 1.273-.958 2.352-2.042 3.073v2.55h3.3c1.93-1.777 3.047-4.396 3.047-7.488 0-.7-.063-1.373-.18-2.09Z"
        fill="#4285F4"
      />
      <path
        d="M12.24 22c2.76 0 5.078-.914 6.77-2.47l-3.3-2.55c-.916.614-2.088.977-3.47.977-2.668 0-4.93-1.8-5.737-4.22H3.09v2.63A10.226 10.226 0 0 0 12.24 22Z"
        fill="#34A853"
      />
      <path
        d="M6.503 13.737a6.148 6.148 0 0 1 0-3.926v-2.63H3.09a10.226 10.226 0 0 0 0 9.186l3.413-2.63Z"
        fill="#FBBC05"
      />
      <path
        d="M12.24 6.043c1.5 0 2.846.516 3.907 1.53l2.93-2.93C17.313 2.98 15 2 12.24 2A10.226 10.226 0 0 0 3.09 7.18l3.413 2.63c.807-2.42 3.07-4.22 5.737-4.22Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function LoginPage() {
  const auth = useAuth();
  const { pendingCred, setPendingCred } = useAuthStatus();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setIsLoading(true);
    setAuthError(null);

    try {
      await signInEmail(auth, email, password);

      if (pendingCred) {
        try {
          await linkAccount(auth, pendingCred);
          toast({
            title: 'Comptes liés',
            description: 'Votre compte Google est désormais associé.',
          });
          setPendingCred(null);
        } catch {
          toast({
            variant: 'destructive',
            title: "Échec de l'association",
            description: 'Session ouverte, mais lien Google échoué.',
          });
        }
      } else {
        toast({ title: 'Connexion réussie' });
      }
    } catch (error: any) {
      let message = 'Identifiants incorrects.';
      if (error.code === 'auth/user-not-found') message = 'Utilisateur introuvable.';
      if (error.code === 'auth/wrong-password') message = 'Mot de passe erroné.';

      setAuthError(message);
      toast({ variant: 'destructive', title: 'Erreur', description: message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setAuthError(null);

    try {
      await signInWithGoogle(auth);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        return;
      }

      setAuthError(`Erreur: ${error.message}`);
      toast({
        variant: 'destructive',
        title: 'Erreur de connexion',
        description: error.message || 'Une erreur inattendue est survenue.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout statusText="Connexion">
      <div className="animate-in fade-in duration-700">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 py-10 md:py-16 lg:grid lg:grid-cols-[minmax(0,0.95fr)_440px] lg:gap-10">
          <section className="space-y-6">
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Connexion
              </p>

              <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-foreground md:text-6xl">
                Rejoindre l&apos;Ekklesia.
              </h1>
            </div>

            <GlassCard intensity="soft" className="p-6 md:p-7">
              <div className="space-y-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Adhésion
                </p>

                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/60">
                      <CheckCircle2 className="h-4 w-4 text-foreground" />
                    </div>
                    <p className="text-base leading-relaxed text-foreground">
                      Sans engagement, vous pouvez vous désabonner à tout moment.
                    </p>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/60">
                      <CheckCircle2 className="h-4 w-4 text-foreground" />
                    </div>
                    <p className="text-base leading-relaxed text-foreground">
                      Des frais supplémentaires peuvent s’appliquer selon votre méthode de paiement.
                    </p>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/60">
                      <CheckCircle2 className="h-4 w-4 text-foreground" />
                    </div>
                    <p className="text-base leading-relaxed text-foreground">
                      1 adhésion = 1 voix.
                    </p>
                  </div>
                </div>
              </div>
            </GlassCard>
          </section>

          <aside className="w-full">
            <GlassCard intensity="medium" className="p-5 md:p-6">
              <div className="space-y-6">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Espace membre
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                    Se connecter
                  </h2>
                </div>

                {pendingCred && (
                  <Alert className="rounded-2xl border-primary/20 bg-primary/5">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    <AlertTitle className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                      Lien requis
                    </AlertTitle>
                    <AlertDescription className="text-sm text-foreground/80">
                      Ce compte Google existe déjà. Connectez-vous par e-mail pour lier vos
                      comptes.
                    </AlertDescription>
                  </Alert>
                )}

                {authError && (
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
                    {authError}
                  </div>
                )}

                <div className="space-y-3">
                  <Button
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    variant="outline"
                    className="h-14 w-full rounded-full border border-black/5 bg-white text-base font-semibold shadow-[0_8px_20px_rgba(0,0,0,0.08)] hover:shadow-[0_12px_30px_rgba(0,0,0,0.12)] transition-all duration-200"
                  >
                    {isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <GoogleIcon />
                        <span className="ml-2">Continuer avec Google</span>
                      </>
                    )}
                  </Button>

                  <p className="text-center text-[12px] text-muted-foreground">
                    Connexion rapide et sécurisée
                  </p>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-white/40" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="rounded-full border border-white/50 bg-white/70 px-3 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur-sm">
                      ou
                    </span>
                  </div>
                </div>

                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="nom@exemple.com"
                        className="h-12 rounded-full border-white/60 bg-white/50 pl-11 pr-4 backdrop-blur-sm"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="password">Mot de passe</Label>
                      <Link
                        href="/forgot-password"
                        title="Mot de passe oublié"
                        className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                      >
                        Oublié ?
                      </Link>
                    </div>

                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        className="h-12 rounded-full border-white/60 bg-white/50 pl-11 pr-4 backdrop-blur-sm"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="h-12 w-full rounded-full text-sm font-semibold"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : pendingCred ? (
                      'Lier et se connecter'
                    ) : (
                      'Se connecter'
                    )}
                  </Button>
                </form>

                <div className="border-t border-white/40 pt-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Pas encore membre ?{' '}
                    <Link href="/signup" className="font-medium text-foreground hover:underline">
                      Créer un compte
                    </Link>
                  </p>
                </div>
              </div>
            </GlassCard>
          </aside>
        </div>
      </div>
    </MainLayout>
  );
}