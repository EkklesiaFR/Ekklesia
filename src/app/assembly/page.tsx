'use client';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { useAuthStatus } from '@/components/auth/AuthStatusProvider';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import Link from 'next/link';
import { 
  Activity, 
  LayoutGrid, 
  Settings
} from 'lucide-react';
import { Vote, Assembly } from '@/types';
import { LastVoteResultCard } from '@/components/voting/LastVoteResultCard';
import { DEFAULT_ASSEMBLY_ID } from '@/config/assembly';
import { doc } from 'firebase/firestore';

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

  if (isAssemblyLoading) return <div className="py-24 text-center font-mono text-[10px] uppercase tracking-widest">Chargement de l'assemblée...</div>;

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

export default function AssemblyDashboard() {
  return (
    <RequireActiveMember>
      <MainLayout statusText="Dashboard">
        <AssemblyDashboardContent />
      </MainLayout>
    </RequireActiveMember>
  );
}