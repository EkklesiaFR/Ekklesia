'use client';

import { useState, type FormEvent } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/firebase';
import { signInEmail, signInWithGoogle } from '@/firebase/non-blocking-login';
import Link from 'next/link';
import { Mail, Lock, LogIn, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

function LoginForm() {
  const auth = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleEmailLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setIsLoading(true);
    try {
      await signInEmail(auth, email, password);
      toast({ title: "Connexion réussie" });
      // Redirection is handled globally by AuthStatusProvider
    } catch (error: any) {
      console.error('[AUTH] Email login error', error.code);
      let message = "Identifiants incorrects.";
      if (error.code === 'auth/user-not-found') message = "Utilisateur introuvable.";
      if (error.code === 'auth/wrong-password') message = "Mot de passe erroné.";
      toast({ variant: "destructive", title: "Erreur", description: message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle(auth);
    } catch (error) {
      console.error('[AUTH] Google start error', error);
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
              <Link href="/forgot-password" className="text-[10px] opacity-60 uppercase font-bold text-muted-foreground hover:text-black">Oublié ?</Link>
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
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Se connecter"}
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
