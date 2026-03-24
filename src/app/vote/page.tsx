'use client';

import Link from 'next/link';
import { collection, doc, limit, query, where } from 'firebase/firestore';
import { ArrowLeft, Loader2, Vote as VoteIcon, AlertCircle } from 'lucide-react';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { VoteModule } from '@/components/vote/VoteModule';

import {
  useUser,
  useFirestore,
  useCollection,
  useDoc,
  useMemoFirebase,
} from '@/firebase';

import type { Project, Vote, Assembly, Ballot } from '@/types';

function VoteGate() {
  const { user } = useUser();
  const db = useFirestore();

  const activeAssemblyQuery = useMemoFirebase(() => {
    return query(collection(db, 'assemblies'), where('state', '==', 'open'), limit(1));
  }, [db]);

  const { data: assemblies, isLoading: isAssemblyLoading } =
    useCollection<Assembly>(activeAssemblyQuery);

  const activeAssembly = assemblies?.[0];

  const voteRef = useMemoFirebase(() => {
    if (!activeAssembly?.activeVoteId) return null;
    return doc(db, 'assemblies', activeAssembly.id, 'votes', activeAssembly.activeVoteId);
  }, [db, activeAssembly]);

  const { data: activeVote, isLoading: isVoteLoading } = useDoc<Vote>(voteRef);

  const projectsQuery = useMemoFirebase(() => {
    return collection(db, 'projects');
  }, [db]);

  const { data: allProjects, isLoading: isProjectsLoading } =
    useCollection<Project>(projectsQuery);

  const voteProjects =
    allProjects?.filter((project) => activeVote?.projectIds?.includes(project.id)) || [];

  const userBallotRef = useMemoFirebase(() => {
    if (!activeAssembly || !activeVote || !user) return null;
    return doc(
      db,
      'assemblies',
      activeAssembly.id,
      'votes',
      activeVote.id,
      'ballots',
      user.uid
    );
  }, [db, activeAssembly, activeVote, user]);

  const { data: userBallot, isLoading: isBallotLoading } = useDoc<Ballot>(userBallotRef);

  const isLoading =
    isAssemblyLoading || isVoteLoading || isProjectsLoading || isBallotLoading;

  if (isLoading) {
    return (
      <GlassCard
        intensity="medium"
        className="flex min-h-[280px] w-full flex-col items-center justify-center gap-5 p-8 text-center"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-200/70 bg-emerald-50/70 text-primary">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Vote
          </p>
          <p className="text-lg font-semibold text-foreground">Chargement du scrutin…</p>
        </div>
      </GlassCard>
    );
  }

  if (!activeAssembly) {
    return (
      <GlassCard
        intensity="medium"
        className="flex min-h-[320px] w-full flex-col items-center justify-center gap-6 p-8 text-center"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-black/5 bg-white/40 text-muted-foreground">
          <VoteIcon className="h-6 w-6" />
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Vote
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Aucun vote ouvert
          </h1>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            Il n&apos;y a pas d&apos;assemblée active pour le moment.
          </p>
        </div>

        <Link href="/assembly">
          <Button
            variant="outline"
            className="h-11 rounded-full px-5 text-xs font-semibold uppercase tracking-[0.18em]"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour au dashboard
          </Button>
        </Link>
      </GlassCard>
    );
  }

  if (!activeAssembly.activeVoteId || !activeVote) {
    return (
      <GlassCard
        intensity="medium"
        className="flex min-h-[320px] w-full flex-col items-center justify-center gap-6 p-8 text-center"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-amber-200/70 bg-amber-50/70 text-amber-700">
          <AlertCircle className="h-6 w-6" />
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Vote
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Scrutin non configuré
          </h1>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            L&apos;assemblée est ouverte mais le scrutin n&apos;est pas encore prêt.
            Veuillez contacter un administrateur.
          </p>
        </div>

        <Link href="/assembly">
          <Button
            variant="outline"
            className="h-11 rounded-full px-5 text-xs font-semibold uppercase tracking-[0.18em]"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
        </Link>
      </GlassCard>
    );
  }

  return (
    <VoteModule
      vote={activeVote}
      projects={voteProjects}
      userBallot={userBallot}
      assemblyId={activeAssembly.id}
    />
  );
}

export default function VotePage() {
  return (
    <RequireActiveMember>
      <MainLayout statusText="Vote">
        <VoteGate />
      </MainLayout>
    </RequireActiveMember>
  );
}