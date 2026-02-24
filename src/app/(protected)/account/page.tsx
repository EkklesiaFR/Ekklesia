
'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { useUser, useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useAuthStatus } from '@/components/auth/AuthStatusProvider';
import { LogOut, User as UserIcon, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AccountPage() {
  const { user } = useUser();
  const { member } = useAuthStatus();
  const auth = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const emailPrefix = user?.email?.split('@')[0] || "Membre";
  const displayName = user?.displayName || emailPrefix;

  return (
    <MainLayout statusText="Compte">
      <div className="space-y-12 animate-in fade-in duration-700">
        <header className="space-y-6">
          <Link href="/" className="text-sm flex items-center gap-2 hover:text-primary transition-colors">
            <ArrowLeft className="h-3 w-3" />
            Retour à l'accueil
          </Link>
          <h1 className="text-4xl font-bold tracking-tight">Mon Compte</h1>
        </header>

        <section className="border border-border p-8 space-y-8 bg-white">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-secondary flex items-center justify-center border border-border">
              <UserIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Identité</p>
              <h2 className="text-2xl font-bold">{displayName}</h2>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-border">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Rôle</p>
              <p className="text-lg font-medium">{member?.role || 'Membre votant'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Statut</p>
              <p className="text-lg font-medium text-[#7DC092]">{member?.status || 'Actif'}</p>
            </div>
          </div>
        </section>

        <section className="pt-8 border-t border-border flex flex-col items-center">
          <Button 
            variant="outline" 
            onClick={handleLogout}
            className="w-full md:w-auto h-14 px-12 rounded-none border-border hover:bg-destructive hover:text-white hover:border-destructive transition-all flex items-center gap-3 font-bold uppercase tracking-widest text-xs"
          >
            <LogOut className="h-4 w-4" />
            Se déconnecter
          </Button>
        </section>
      </div>
    </MainLayout>
  );
}
