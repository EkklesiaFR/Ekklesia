'use client';

import { useState, type FormEvent } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/firebase';
import { signInEmail, signInWithGoogle, linkAccount } from '@/firebase/non-blocking-login';
import Link from 'next/link';
import { Mail, Lock, LogIn, Loader2, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuthStatus } from '@/components/auth/AuthStatusProvider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function LoginForm() {
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
      console.log('[AUTH] Starting Email login attempt');
      const userCredential = await signInEmail(auth, email, password);
      
      // If we have a pending Google credential, link it now
      if (pendingCred) {
        console.log('[AUTH] Attempting to link Google account to existing email session');
        try {
          await linkAccount(auth, pendingCred);
          toast({ title: "Comptes liés", description: "Votre compte Google est désormais associé à votre e-mail." });
          setPendingCred(null);
        } catch (linkErr: any) {
          console.error('[AUTH] Linking error', linkErr.code);
          // Don't block login if linking fails, just inform the user
          toast({ 
            variant: "destructive", 
            title: "Échec de l'association", 
            description: "Votre session est ouverte, mais le lien Google a échoué." 
          });
        }
      } else {
        toast({ title: "Connexion réussie" });
      }
    } catch (error: any) {
      console.error('[AUTH] Email login error', error.code);
      let message = "Identifiants incorrects.";
      if (error.code === 'auth/user-not-found') message = "Utilisateur introuvable.";
      if (error.code === 'auth/wrong-password') message = "Mot de passe erroné.";
      if (error.code === 'auth/too-many-requests') message = "Trop de tentatives. Veuillez patienter.";
      
      setAuthError(message);
      toast({ variant: "destructive", title: "Erreur", description: message });
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
      console.error('[AUTH] Google start error', error.code);
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de lancer la connexion Google." });
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-10 animate-in fade-in duration-700">
      <header className="space-y-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-black font-headline">Ekklesia Vote</h1>
        <p className="text-muted-foreground max-w-sm mx-auto">Connectez-vous pour participer aux décisions de l'assemblée.</p>
      </header>

      <div className="w-full max-w-sm space-y-8">
        {pendingCred && (
          <Alert variant="default" className="border-primary bg-primary/5 rounded-none">
            <AlertCircle className="h-4 w-4 text-primary" />
            <AlertTitle className="text-[10px] font-black uppercase tracking-widest text-primary">Lien requis</AlertTitle>
            <AlertDescription className="text-xs">
              Ce compte Google existe déjà avec une méthode différente. Connectez-vous par e-mail pour lier vos comptes.
            </AlertDescription>
          </Alert>
        )}

        {authError && (
          <div className="p-4 bg-destructive/5 border border-destructive/20 text-destructive text-xs font-bold uppercase tracking-widest text-center">
            {authError}
          </div>
        )}

        <form onSubmit={handleEmailLogin} className="space-y-4">
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
                disabled={isLoading}
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Mot de passe</Label>
              <Link href="/forgot-password" size="sm" className="text-[10px] opacity-60 uppercase font-bold text-muted-foreground hover:text-black">Oublié ?</Link>
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
                disabled={isLoading}
              />
            </div>
          </div>
          <Button type="submit" disabled={isLoading} className="w-full h-12 bg-primary hover:bg-primary/90 rounded-none font-bold uppercase tracking-widest text-xs">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (pendingCred ? "Lier et se connecter" : "Se connecter")}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-muted-foreground">Ou</span></div>
        </div>

        <Button 
          onClick={handleGoogleLogin} 
          disabled={isLoading}
          variant="outline" 
          className="w-full h-12 border-2 border-black rounded-none font-bold flex items-center justify-center gap-3 text-[10px] uppercase tracking-widest"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LogIn className="h-4 w-4" /> Continuer avec Google</>}
        </Button>

        <div className="flex flex-col items-center gap-4 pt-4 text-[10px] font-bold uppercase tracking-widest">
          <p className="text-muted-foreground">Pas encore membre ? <Link href="/signup" className="text-black hover:underline">Créer un compte</Link></p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <MainLayout statusText="Connexion">
      <LoginForm />
    </MainLayout>
  );
}
