
'use client';

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStatus } from '@/components/auth/AuthStatusProvider';
import { useUser, useAuth, useFirestore } from '@/firebase';
import { signInEmail, signInWithGoogle } from '@/firebase/non-blocking-login';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import Link from 'next/link';
import { 
  Activity, 
  LayoutGrid, 
  Settings, 
  Mail, 
  Lock, 
  LogIn, 
  Loader2, 
  ShieldAlert,
  LogOut,
  ArrowLeft
} from 'lucide-react';
import { Vote, Assembly } from '@/types';
import { LastVoteResultCard } from '@/components/voting/LastVoteResultCard';
import { DEFAULT_ASSEMBLY_ID } from '@/config/assembly';
import { useDoc, useMemoFirebase } from '@/firebase';
import { signOut, User } from 'firebase/auth';
import { toast } from '@/hooks/use-toast';

function AssemblyDashboardContent() {
  const { isAdmin } = useAuthStatus();
  const db = useFirestore();

  const assemblyRef = useMemoFirebase(() => doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID), [db]);
  const { data: activeAssembly, isLoading: isAssemblyLoading } = useDoc<Assembly>(assemblyRef);

  const voteRef = useMemoFirebase(() => {
    if (!activeAssembly?.activeVoteId || activeAssembly.state !== 'open') return null;
    return doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes', activeAssembly.activeVoteId);
  }, [db, activeAssembly]);
  const { data: activeVote } = useDoc<Vote>(voteRef);

  if (isAssemblyLoading) return <div className="py-24 text-center">Chargement de l'assemblée...</div>;

  const isOpen = activeAssembly?.state === 'open' && activeVote;

  return (
    <div className="space-y-16 animate-in fade-in duration-700">
      <header className="space-y-2">
        <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted-foreground block">Espace Membre</span>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-black">Une voix, une communauté.</h1>
      </header>

      {!isOpen ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section className="border border-border p-12 bg-secondary/5 text-center flex flex-col justify-center space-y-6 min-h-[400px]">
            <Activity className="h-8 w-8 text-muted-foreground mx-auto" />
            <h2 className="text-2xl font-bold">Aucun scrutin ouvert</h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">L'assemblée ne propose pas de vote actif pour le moment.</p>
          </section>
          <LastVoteResultCard />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="border border-border p-8 bg-white space-y-8 flex flex-col justify-between min-h-[400px]">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-2"><Activity className="h-3 w-3" /> Vote en cours</h3>
                <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              </div>
              <p className="text-2xl font-bold leading-tight">{activeVote?.question}</p>
            </div>
            <Link href="/vote" className="block pt-4">
              <Button className="w-full rounded-none h-14 font-bold uppercase tracking-widest text-xs">Je vote</Button>
            </Link>
          </div>
          <LastVoteResultCard />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16 border-t">
        <Link href="/projects" className="group border p-8 bg-white hover:border-black transition-all space-y-6">
          <LayoutGrid className="h-6 w-6" />
          <h3 className="text-xl font-bold">Les Projets</h3>
        </Link>
        {isAdmin && (
          <Link href="/admin" className="group border border-dashed border-primary p-8 bg-primary/5 hover:bg-primary/10 transition-all space-y-6">
            <Settings className="h-6 w-6" />
            <h3 className="text-xl font-bold">Administration</h3>
          </Link>
        )}
      </div>
    </div>
  );
}

function LoginForm() {
  const auth = useAuth();
  const db = useFirestore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const bootstrapUser = async (user: User) => {
    const memberRef = doc(db, 'members', user.uid);
    const snap = await getDoc(memberRef);
    if (!snap.exists()) {
      await setDoc(memberRef, {
        id: user.uid,
        email: user.email || email,
        displayName: user.displayName || (user.email || email).split('@')[0],
        role: 'member',
        status: 'pending',
        createdAt: serverTimestamp(),
        joinedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(memberRef, {
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const cred = await signInEmail(auth, email, password);
      await bootstrapUser(cred.user);
      toast({ title: "Connexion réussie" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: "Identifiants incorrects." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const cred: any = await signInWithGoogle(auth);
      if (cred?.user) {
        await bootstrapUser(cred.user);
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: "Échec de la connexion Google." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-10 animate-in fade-in duration-700">
      <header className="space-y-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-black">Ekklesia Vote</h1>
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
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Mot de passe</Label>
              <Link href="/forgot-password" opacity-60 className="text-[10px] uppercase font-bold text-muted-foreground hover:text-black">Oublié ?</Link>
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
          <LogIn className="h-4 w-4" /> Continuer avec Google
        </Button>

        <div className="flex flex-col items-center gap-4 pt-4 text-[10px] font-bold uppercase tracking-widest">
          <p className="text-muted-foreground">Pas encore membre ? <Link href="/signup" className="text-black hover:underline">Créer un compte</Link></p>
        </div>
      </div>
    </div>
  );
}

function RestrictedUI({ title, description }: { title: string; description: string }) {
  const auth = useAuth();
  const handleLogout = () => signOut(auth);

  return (
    <div className="flex flex-col items-center justify-center py-24 space-y-8 text-center animate-in fade-in duration-700">
      <ShieldAlert className="h-16 w-16 text-destructive" />
      <header className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground max-w-md mx-auto">{description}</p>
      </header>
      <div className="pt-8 space-y-4 w-full max-w-sm">
        <Link href="/">
          <Button variant="outline" className="w-full h-14 rounded-none font-bold uppercase tracking-widest text-xs gap-3">
            <ArrowLeft className="h-4 w-4" /> Accueil
          </Button>
        </Link>
        <Button variant="ghost" onClick={handleLogout} className="w-full h-14 rounded-none text-muted-foreground font-bold uppercase tracking-widest text-xs gap-3">
          <LogOut className="h-4 w-4" /> Déconnexion
        </Button>
      </div>
    </div>
  );
}

export default function AssemblyDashboard() {
  const { user, isUserLoading } = useUser();
  const { member, isMemberLoading, isActiveMember, isAdmin } = useAuthStatus();

  if (isUserLoading || (user && isMemberLoading)) {
    return (
      <MainLayout statusText="Vérification">
        <div className="flex flex-col items-center justify-center py-32">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!user) {
    return (
      <MainLayout statusText="Connexion">
        <LoginForm />
      </MainLayout>
    );
  }

  if (member && !(isActiveMember || isAdmin)) {
    return (
      <MainLayout statusText="Accès Restreint">
        <RestrictedUI 
          title="Compte en attente" 
          description="Votre adhésion doit être validée par un administrateur." 
        />
      </MainLayout>
    );
  }

  return (
    <MainLayout statusText="Dashboard">
      <AssemblyDashboardContent />
    </MainLayout>
  );
}
