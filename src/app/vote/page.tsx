'use client';

import { useState, useEffect } from 'react';
import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collectionGroup, query, where, limit, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, CheckCircle2, Trophy, Users, ChevronRight } from 'lucide-react';
import { computeSchulzeResults } from '@/lib/tally';
import Link from 'next/link';
import { toast } from '@/hooks/use-toast';
import { Project, Vote, Ballot } from '@/types';

export default function VotePage() {
  const { user } = useUser();
  const db = useFirestore();

  // 1. Trouver le vote ouvert
  const activeVoteQuery = useMemoFirebase(() => {
    return query(collectionGroup(db, 'votes'), where('state', '==', 'open'), limit(1));
  }, [db]);
  const { data: votes, isLoading: isVotesLoading } = useCollection<Vote>(activeVoteQuery);
  const activeVote = votes?.[0];

  // 2. Charger les projets si un vote est ouvert
  const projectsQuery = useMemoFirebase(() => {
    if (!activeVote) return null;
    return collection(db, 'projects');
  }, [db, activeVote]);
  const { data: allProjects, isLoading: isProjectsLoading } = useCollection<Project>(projectsQuery);

  // Filtrer uniquement les projets concernés par ce vote
  const activeProjects = allProjects?.filter(p => activeVote?.projectIds.includes(p.id)) || [];

  // 3. Charger le bulletin de l'utilisateur
  const userBallotRef = useMemoFirebase(() => {
    if (!activeVote || !user) return null;
    return doc(db, 'assemblies', activeVote.assemblyId, 'votes', activeVote.id, 'ballots', user.uid);
  }, [db, activeVote, user]);
  const { data: userBallot, isLoading: isBallotLoading } = useDoc<Ballot>(userBallotRef);

  // 4. Charger tous les bulletins pour les résultats en temps réel
  const allBallotsQuery = useMemoFirebase(() => {
    if (!activeVote) return null;
    return collection(db, 'assemblies', activeVote.assemblyId, 'votes', activeVote.id, 'ballots');
  }, [db, activeVote]);
  const { data: allBallots } = useCollection<Ballot>(allBallotsQuery);

  // État local pour le classement en cours de modification
  const [currentRanking, setCurrentRanking] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (userBallot?.ranking) {
      setCurrentRanking(userBallot.ranking);
    } else if (activeProjects.length > 0 && currentRanking.length === 0) {
      setCurrentRanking(activeProjects.map(p => p.id));
    }
  }, [userBallot, activeProjects]);

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const newRanking = [...currentRanking];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newRanking.length) return;

    [newRanking[index], newRanking[targetIndex]] = [newRanking[targetIndex], newRanking[index]];
    setCurrentRanking(newRanking);
  };

  const handleVoteSubmit = async () => {
    if (!userBallotRef || !user) return;
    setIsSaving(true);
    try {
      await setDoc(userBallotRef, {
        ranking: currentRanking,
        castAt: userBallot?.castAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      toast({ title: "Vote enregistré", description: "Votre classement a été mis à jour avec succès." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'enregistrer le vote." });
    } finally {
      setIsSaving(false);
    }
  };

  // Calcul Schulze
  const results = allBallots && activeProjects.length > 0 
    ? computeSchulzeResults(activeProjects.map(p => p.id), allBallots)
    : null;

  if (isVotesLoading || isProjectsLoading) {
    return (
      <MainLayout statusText="Vote">
        <div className="flex justify-center items-center py-20">Chargement de la session...</div>
      </MainLayout>
    );
  }

  if (!activeVote) {
    return (
      <MainLayout statusText="Aucun vote">
        <div className="text-center py-20 space-y-6">
          <h1 className="text-3xl font-bold">Aucun vote en cours</h1>
          <p className="text-muted-foreground">Revenez plus tard pour participer aux prochaines décisions.</p>
          <Link href="/assembly">
            <Button variant="outline">Retour au Dashboard</Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <RequireActiveMember>
      <MainLayout statusText="Vote ouvert">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Section Vote */}
          <div className="space-y-8">
            <header className="space-y-2">
              <h1 className="text-4xl font-bold">{activeVote.question}</h1>
              <p className="text-muted-foreground">Classez les projets par ordre de préférence (le premier est votre favori).</p>
            </header>

            <div className="space-y-3">
              {currentRanking.map((id, index) => {
                const project = activeProjects.find(p => p.id === id);
                if (!project) return null;
                return (
                  <div key={id} className="flex items-center gap-4 p-4 bg-white border border-border hover:border-primary transition-colors">
                    <div className="w-8 h-8 flex items-center justify-center bg-secondary font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-grow">
                      <h3 className="font-bold">{project.title}</h3>
                      <p className="text-xs text-muted-foreground">{project.budget}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8" 
                        onClick={() => moveItem(index, 'up')}
                        disabled={index === 0}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-8 w-8" 
                        onClick={() => moveItem(index, 'down')}
                        disabled={index === currentRanking.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button className="w-full h-14 text-lg font-bold" onClick={handleVoteSubmit} disabled={isSaving}>
              {isSaving ? "Enregistrement..." : userBallot ? "Mettre à jour mon vote" : "Valider mon classement"}
            </Button>

            {userBallot && (
              <div className="flex items-center gap-2 p-4 bg-green-50 text-green-700 text-sm font-medium border border-green-200">
                <CheckCircle2 className="h-4 w-4" />
                Votre classement actuel est enregistré.
              </div>
            )}
          </div>

          {/* Section Résultats en temps réel */}
          <div className="space-y-8 bg-secondary/5 p-8 border border-border">
            <header className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Résultats (Temps Réel)
              </h2>
              <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Users className="h-3 w-3" />
                {results?.total || 0} bulletins
              </div>
            </header>

            <div className="space-y-4">
              {results?.ranking.map((rankInfo) => {
                const project = activeProjects.find(p => p.id === rankInfo.id);
                const isWinner = rankInfo.rank === 1;
                return (
                  <div key={rankInfo.id} className={`p-4 flex items-center gap-4 ${isWinner ? 'bg-primary/10 border-primary' : 'bg-white border-border'} border transition-all`}>
                    <div className={`w-6 h-6 flex items-center justify-center text-[10px] font-black ${isWinner ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                      #{rankInfo.rank}
                    </div>
                    <div className="flex-grow">
                      <div className="font-bold text-sm">{project?.title}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Schulze Score</div>
                    </div>
                    {isWinner && <ChevronRight className="h-4 w-4 text-primary" />}
                  </div>
                );
              })}
            </div>

            <div className="pt-6 border-t border-border mt-8">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-relaxed">
                Le classement est calculé via la méthode de Schulze (Condorcet), garantissant qu'un projet n'est élu que s'il est préféré par une majorité face à ses concurrents.
              </p>
            </div>
          </div>
        </div>
      </MainLayout>
    </RequireActiveMember>
  );
}
