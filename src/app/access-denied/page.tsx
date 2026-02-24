'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { useAuth, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShieldAlert, LogOut, ArrowLeft } from 'lucide-react';
import { Suspense } from 'react';

function AccessDeniedContent() {
  const auth = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const getContent = () => {
    switch (reason) {
      case 'member':
        return {
          title: "Accès à l’assemblée refusé",
          description: "Seuls les membres figurant sur la liste d’émargement peuvent accéder aux sessions de vote."
        };
      case 'admin':
        return {
          title: "Accès admin refusé",
          description: "Cette page est réservée aux administrateurs de l’assemblée."
        };
      default:
        return {
          title: "Accès refusé",
          description: "Vous n’avez pas les droits nécessaires."
        };
    }
  };

  const { title, description } = getContent();

  return (
    <div className="flex flex-col items-center justify-center py-24 space-y-8 animate-in fade-in duration-700 text-center">
      <ShieldAlert className="h-16 w-16 text-destructive" />
      
      <header className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          {description}
        </p>
        {user?.email && (
          <p className="text-sm font-medium">Compte : {user.email}</p>
        )}
      </header>

      <div className="pt-8 space-y-4 w-full max-w-sm">
        <Button 
          variant="outline" 
          onClick={() => router.push('/')}
          className="w-full h-14 rounded-none border-border hover:bg-black hover:text-white transition-all flex items-center justify-center gap-3 font-bold uppercase tracking-widest text-xs"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à l'accueil
        </Button>
        
        <Button 
          variant="ghost" 
          onClick={handleLogout}
          className="w-full h-14 rounded-none text-muted-foreground hover:text-destructive transition-all flex items-center justify-center gap-3 font-bold uppercase tracking-widest text-xs"
        >
          <LogOut className="h-4 w-4" />
          Se déconnecter
        </Button>
      </div>
    </div>
  );
}

export default function AccessDeniedPage() {
  return (
    <MainLayout statusText="Accès Refusé">
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <div className="w-12 h-12 border-t-2 border-primary animate-spin rounded-full"></div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Chargement...</p>
        </div>
      }>
        <AccessDeniedContent />
      </Suspense>
    </MainLayout>
  );
}
