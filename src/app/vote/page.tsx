'use client';

import { useState } from 'react';
import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Bug } from 'lucide-react';
import Link from 'next/link';
import { Project, Vote, Assembly, Ballot } from '@/types';
import { VoteModule } from '@/components/vote/VoteModule';

// FLAG DEBUG - Mettre à true pour voir le panneau de diagnostic en bas de page
const DEBUG_VOTE = true;

function VoteGate() {
  const { user } = useUser();
  const db = useFirestore();

  // 1. Trouver l'assemblée ouverte (Source de vérité)
  const activeAssemblyQuery = useMemoFirebase(() => {
    return query(collection(db, 'assemblies'), where('state', '==', 'open'), limit(1));
  }, [db]);
  const { data: assemblies, isLoading: isAssemblyLoading, error: assemblyError } = useCollection<Assembly>(activeAssemblyQuery);
  const activeAssembly = assemblies?.[0];

  // 2. Charger le vote spécifique via activeVoteId
  const voteRef = useMemoFirebase(() => {
    if (!activeAssembly?.activeVoteId) return null;
    return doc(db, 'assemblies', activeAssembly.id, 'votes', activeAssembly.activeVoteId);
  }, [db, activeAssembly]);
  const { data: activeVote, isLoading: isVoteLoading, error: voteError } = useDoc<Vote>(voteRef);

  // 3. Charger les projets associés
  const projectsQuery = useMemoFirebase(() => {
    return collection(db, 'projects');
  }, [db]);
  const { data: allProjects, isLoading: isProjectsLoading } = useCollection<Project>(projectsQuery);

  const voteProjects = allProjects?.filter(p => activeVote?.projectIds?.includes(p.id)) || [];

  // 4. Charger le bulletin de l'utilisateur
  const userBallotRef = useMemoFirebase(() => {
    if (!activeAssembly || !activeVote || !user) return null;
    return doc(db, 'assemblies', activeAssembly.id, 'votes', activeVote.id, 'ballots', user.uid);
  }, [db, activeAssembly, activeVote, user]);
  const { data: userBallot, isLoading: isBallotLoading } = useDoc<Ballot>(userBallotRef);

  const isLoading = isAssemblyLoading || isVoteLoading || isProjectsLoading || isBallotLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-6">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted-foreground">
          Chargement du scrutin...
        </p>
      </div>
    );
  }

  // --- RENDU DU PANNEAU DEBUG ---
  const debugPanel = DEBUG_VOTE && (
    <div className="fixed bottom-20 left-4 right-4 z-[100] bg-black text-white p-6 text-[10px] font-mono border-t-4 border-primary shadow-2xl space-y-2 opacity-90 hover:opacity-100 transition-opacity">
      <div className="flex items-center gap-2 text-primary font-bold mb-2">
        <Bug className="h-3 w-3" /> DIAGNOSTIC VOTE
      </div>
      <p>Assembly ID: {activeAssembly?.id || 'null'}</p>
      <p>Assembly State: {activeAssembly?.state || 'null'}</p>
      <p>activeVoteId: {activeAssembly?.activeVoteId || 'null'}</p>
      <p>Vote Path: {activeAssembly && activeAssembly.activeVoteId ? `assemblies/${activeAssembly.id}/votes/${activeAssembly.activeVoteId}` : 'N/A'}</p>
      <p>Vote State: {activeVote?.state || 'null'}</p>
      <p>Project IDs in Vote: {activeVote?.projectIds?.length || 0}</p>
      <p>Resolved Projects: {voteProjects.length}</p>
      <p>Errors: {assemblyError?.message || voteError?.message || 'Aucune'}</p>
    </div>
  );

  // --- LOGIQUE D'AFFICHAGE DES ÉTATS ---

  if (!activeAssembly) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-32 text-center space-y-8 animate-in fade-in duration-700">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">Aucun vote ouvert</h1>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Il n'y a pas d'assemblée active pour le moment.
            </p>
          </div>
          <Link href="/assembly">
            <Button variant="outline" className="rounded-none h-14 px-8 uppercase font-bold text-xs tracking-widest gap-2">
              <ArrowLeft className="h-4 w-4" />
              Retour au Dashboard
            </Button>
          </Link>
        </div>
        {debugPanel}
      </>
    );
  }

  if (!activeAssembly.activeVoteId) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-32 text-center space-y-4">
          <h1 className="text-2xl font-bold">Assemblée ouverte mais configuration incomplète</h1>
          <p className="text-muted-foreground">Le document de vote n'est pas encore lié à cette assemblée.</p>
        </div>
        {debugPanel}
      </>
    );
  }

  if (!activeVote) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-32 text-center space-y-4">
          <h1 className="text-2xl font-bold">Vote introuvable</h1>
          <p className="text-muted-foreground">Le scrutin lié (ID: {activeAssembly.activeVoteId}) n'existe pas dans Firestore.</p>
        </div>
        {debugPanel}
      </>
    );
  }

  if (activeVote.state !== 'open') {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-32 text-center space-y-4">
          <h1 className="text-2xl font-bold">Le vote est clos</h1>
          <p className="text-muted-foreground">La session de vote pour cette assemblée est terminée.</p>
        </div>
        {debugPanel}
      </>
    );
  }

  if (voteProjects.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-32 text-center space-y-4">
          <h1 className="text-2xl font-bold">Aucun projet associé</h1>
          <p className="text-muted-foreground">Ce vote ne contient aucun projet à classer.</p>
        </div>
        {debugPanel}
      </>
    );
  }

  return (
    <>
      <VoteModule 
        vote={activeVote} 
        projects={voteProjects} 
        userBallot={userBallot} 
        assemblyId={activeAssembly.id}
      />
      {debugPanel}
    </>
  );
}

export default function VotePage() {
  return (
    <RequireActiveMember>
      <MainLayout statusText="Vote Ouvert">
        <VoteGate />
      </MainLayout>
    </RequireActiveMember>
  );
}
