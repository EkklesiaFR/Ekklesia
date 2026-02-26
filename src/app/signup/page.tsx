'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { signUpEmail } from '@/firebase/non-blocking-login';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { UserPlus, Mail, Lock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { DEFAULT_ASSEMBLY_ID } from '@/config/assembly';

export default function SignupPage() {
  const auth = useAuth();
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isUserLoading && user) {
      router.replace('/assembly');
    }
  }, [user, isUserLoading, router]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (password !== confirmPassword) {
      toast({ variant: "destructive", title: "Erreur", description: "Les mots de passe ne correspondent pas." });
      return;
    }

    setIsLoading(true);
    try {
      await signUpEmail(auth, email, password);
      
      const currentUser = auth.currentUser;
      if (currentUser) {
        const memberRef = doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'members', currentUser.uid);
        await setDoc(memberRef, {
          id: currentUser.uid,
          email: email,
          role: 'member',
          status: 'pending',
          displayName: email.split('@')[0],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      toast({ title: "Compte créé !", description: "Vérifiez vos emails pour valider votre compte." });
      router.push('/login');
    } catch (error: any) {
      toast({ variant: "destructive", title: "Erreur", description: error.message || "Impossible de créer le compte." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout statusText="Inscription">
      <div className="flex flex-col items-center justify-center py-12 space-y-10 animate-in fade-in duration-700">
        <header className="space-y-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-black">Rejoindre l'Assemblée</h1>
          <p className="text-muted-foreground max-w-sm mx-auto">Créez votre compte pour participer.</p>
        </header>

        <div className="w-full max-w-sm space-y-8">
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" placeholder="nom@exemple.com" className="pl-10 rounded-none h-12" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="password" type="password" className="pl-10 rounded-none h-12" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="confirm-password" type="password" className="pl-10 rounded-none h-12" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
              </div>
            </div>
            <Button type="submit" disabled={isLoading || isUserLoading} className="w-full h-12 rounded-none font-bold uppercase tracking-widest text-xs gap-2">
              {isLoading ? "Création..." : <><UserPlus className="h-4 w-4" /> S'inscrire</>}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground">Déjà inscrit ? <Link href="/login" className="font-bold text-black hover:underline">Se connecter</Link></p>
        </div>
      </div>
    </MainLayout>
  );
}