'use client';

import { doc } from 'firebase/firestore';
import { Activity } from 'lucide-react';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';

import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import type { Vote, Assembly } from '@/types';

import { DEFAULT_ASSEMBLY_ID } from '@/config/assembly';
import { ActiveVotePanel } from '@/components/assembly/ActiveVotePanel';
import { LastVoteResultCard } from '@/components/voting/LastVoteResultCard';
import { CommunityFundCard } from '@/components/assembly/CommunityFundCard';

import { usePresenceHeartbeat } from '@/hooks/usePresenceHeartbeat';
import { useOnlinePresence } from '@/hooks/useOnlinePresence';
import { OnlinePresenceStrip } from '@/components/assembly/OnlinePresenceStrip';

function AssemblyDashboardContent() {
  const db = useFirestore();

  const assemblyRef = useMemoFirebase(() => doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID), [db]);
  const { data: activeAssembly, isLoading: isAssemblyLoading } = useDoc<Assembly>(assemblyRef);

  const voteRef = useMemoFirebase(() => {
    if (!activeAssembly?.activeVoteId || activeAssembly.state !== 'open') return null;
    return doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes', activeAssembly.activeVoteId);
  }, [db, activeAssembly]);

  const { data: activeVote } = useDoc<Vote>(voteRef);

  usePresenceHeartbeat(DEFAULT_ASSEMBLY_ID);

  const {
    users,
    onlineCount,
    deltaLastMinute,
    isLoading: isOnlineLoading,
  } = useOnlinePresence(DEFAULT_ASSEMBLY_ID);

  if (isAssemblyLoading) {
    return (
      <div className="py-24 text-center font-mono text-[10px] uppercase tracking-widest">
        Chargement de l&apos;assemblée...
      </div>
    );
  }

  const isOpen = activeAssembly?.state === 'open' && !!activeVote;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <CommunityFundCard
        amount={12650}
        monthlyDelta={2350}
        distributionLabel="à répartir en fin de mois"
      />

      <OnlinePresenceStrip
        onlineCount={onlineCount}
        deltaLastMinute={deltaLastMinute}
        isLoading={isOnlineLoading}
        onlineMembers={users}
      />

      {!isOpen ? (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <section className="flex min-h-[400px] flex-col justify-center space-y-6 border border-border bg-secondary/5 p-12 text-center">
            <Activity className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="text-2xl font-bold">Aucun scrutin ouvert</h2>
            <p className="mx-auto max-w-xs text-sm text-muted-foreground">
              L&apos;assemblée ne propose pas de vote actif pour le moment.
            </p>
          </section>

          <LastVoteResultCard />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <ActiveVotePanel assembly={activeAssembly as Assembly} vote={activeVote as Vote} />
          <LastVoteResultCard />
        </div>
      )}
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