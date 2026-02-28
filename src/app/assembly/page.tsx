'use client';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuthStatus } from '@/components/auth/AuthStatusProvider';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import Link from 'next/link';
import { Activity, LayoutGrid, Settings } from 'lucide-react';
import type { Vote, Assembly } from '@/types';
import { LastVoteResultCard } from '@/components/voting/LastVoteResultCard';
import { DEFAULT_ASSEMBLY_ID } from '@/config/assembly';
import { doc } from 'firebase/firestore';
import { ActiveVotePanel } from '@/components/assembly/ActiveVotePanel';

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

  if (isAssemblyLoading) {
    return (
      <div className="py-24 text-center font-mono text-[10px] uppercase tracking-widest">
        Chargement de l&apos;assemblée...
      </div>
    );
  }

  const isOpen = activeAssembly?.state === 'open' && !!activeVote;

  return (
    <div className="space-y-16 animate-in fade-in duration-700">
      <header className="space-y-2">
        <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted-foreground block">
          Espace Membre
        </span>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-black">
          Une voix, une communauté.
        </h1>
      </header>

      {!isOpen ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section className="border border-border p-12 bg-secondary/5 text-center flex flex-col justify-center space-y-6 min-h-[400px]">
            <Activity className="h-8 w-8 text-muted-foreground mx-auto" />
            <h2 className="text-2xl font-bold">Aucun scrutin ouvert</h2>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              L&apos;assemblée ne propose pas de vote actif pour le moment.
            </p>
          </section>

          <LastVoteResultCard />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* ✅ Panel vote enrichi */}
          <ActiveVotePanel assembly={activeAssembly as Assembly} vote={activeVote as Vote} />

          <LastVoteResultCard />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16 border-t">
        <Link href="/projects" className="group border p-8 bg-white hover:border-black transition-all space-y-6">
          <LayoutGrid className="h-6 w-6" />
          <h3 className="text-xl font-bold">Les Projets</h3>
        </Link>

        {isAdmin && (
          <Link
            href="/admin"
            className="group border border-dashed border-primary p-8 bg-primary/5 hover:bg-primary/10 transition-all space-y-6"
          >
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