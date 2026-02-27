'use client';

import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { ShieldAlert, LogOut, Database, RefreshCw, Layers } from 'lucide-react';

import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { useAuth, useUser } from '@/firebase';
import { useAuthStatus } from '@/components/auth/AuthStatusProvider';

function AccessDeniedContent() {
  const router = useRouter();
  const auth = useAuth();
  const { user } = useUser();
  const { member } = useAuthStatus();

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } finally {
      router.push('/login');
    }
  };

  const status = member?.status; // 'pending' | 'active' | etc.
  const isPending = status === 'pending';

  const title = isPending ? 'Accès en attente' : 'Accès refusé';
  const description = isPending
    ? "Votre demande d'adhésion est en cours de validation par le conseil."
    : "Vous n'avez pas encore les droits nécessaires pour accéder à cette section.";

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-8 animate-in fade-in duration-700 text-center">
      <div className="relative">
        <ShieldAlert className="h-16 w-16 text-destructive" />
      </div>

      <header className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
        <p className="text-muted-foreground max-w-md mx-auto">{description}</p>
      </header>

      <div className="pt-8 space-y-4 w-full max-w-sm flex flex-col items-center">
        <Button
          variant="outline"
          onClick={() => window.location.reload()}
          className="w-full h-14 rounded-none font-bold uppercase tracking-widest text-xs gap-2"
        >
          <RefreshCw className="h-4 w-4" /> Vérifier à nouveau
        </Button>

        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full h-14 rounded-none text-muted-foreground font-bold uppercase tracking-widest text-xs gap-2"
        >
          <LogOut className="h-4 w-4" /> Changer de compte
        </Button>
      </div>

      <div className="mt-16 w-full max-w-2xl mx-auto border border-border bg-secondary/5 overflow-hidden font-mono text-[11px] text-left p-8 space-y-6">
        <h4 className="text-[10px] uppercase font-bold text-muted-foreground border-b border-border pb-2 flex items-center gap-2">
          <Database className="h-3 w-3" /> État du Compte
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <p className="flex items-center gap-2">
              <Layers className="h-3 w-3 text-muted-foreground" />
              Email : <span className="text-primary font-bold">{user?.email || '—'}</span>
            </p>
            <p>
              Statut profil :{' '}
              <span className={member ? 'text-green-600' : 'text-orange-500'}>
                {member ? member.status : 'Non créé'}
              </span>
            </p>
            <p>Rôle détecté : {member?.role || 'Aucun'}</p>
          </div>

          <div className="space-y-2">
            <p className="text-muted-foreground text-[10px]">
              Si vous venez de vous inscrire, un administrateur doit activer votre compte.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AccessDeniedPage() {
  return (
    <MainLayout statusText="Sécurité">
      <Suspense fallback={null}>
        <AccessDeniedContent />
      </Suspense>
    </MainLayout>
  );
}