
'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { useAuth, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { ShieldAlert, LogOut } from 'lucide-react';

export default function AccessDeniedPage() {
  const auth = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  return (
    <MainLayout statusText="Accès Refusé">
      <div className="flex flex-col items-center justify-center py-24 space-y-8 animate-in fade-in duration-700 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        
        <header className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Accès restreint</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Désolé, votre compte (<strong>{user?.email}</strong>) n'est pas encore activé dans notre base de membres ou votre accès a été révoqué.
          </p>
        </header>

        <div className="pt-8 space-y-4 w-full max-w-sm">
          <p className="text-sm text-muted-foreground italic">
            Veuillez contacter un administrateur pour activer votre accès.
          </p>
          
          <Button 
            variant="outline" 
            onClick={handleLogout}
            className="w-full h-14 rounded-none border-border hover:bg-black hover:text-white transition-all flex items-center justify-center gap-3 font-bold uppercase tracking-widest text-xs"
          >
            <LogOut className="h-4 w-4" />
            Se déconnecter
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
