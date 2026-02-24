'use client';

import { useState, useEffect } from 'react';
import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, CheckCircle2, Trophy, Users, ChevronRight, Loader2 } from 'lucide-react';
import { computeSchulzeResults } from '@/lib/tally';
import Link from 'next/link';
import { toast } from '@/hooks/use-toast';
import { Project, Vote, Assembly, Ballot } from '@/types';

function VoteContent() {
  const { user } = useUser();
  const db = useFirestore();

  // 1. Trouver l'assemblée ouverte (Source de vérité)
  const activeAssemblyQuery = useMemoFirebase(() => {
    return query(collection(db, 'assemblies'), where('state', '==', 'open'), limit(1));
  }, [db]);
  const { data: assemblies, isLoading: isAssemblyLoading } = useCollection<Assembly>(activeAssemblyQuery);
  const activeAssembly = assemblies?.[0];

  // 2. Charger le vote spécifique via activeVoteId
  const voteRef = useMemoFirebase(() => {
    if (!activeAssembly?.activeVoteId) return null;
    return doc(db, 'assemblies', activeAssembly.id, 'votes', activeAssembly.activeVoteId);
  }, [db, activeAssembly]);
  const { data: activeVote, isLoading: isVoteLoading } = useDoc<Vote>(voteRef);

  // 3. Charger les projets
  const projectsQuery = useMemoFirebase(() => {
    return collection(db, 'projects');
  }, [db]);
  const { data: allProjects, isLoading: isProjectsLoading } = useCollection<Project>(projectsQuery);

  const activeProjects = allProjects?.filter(p => activeVote?.projectIds.includes(p.id)) || [];

  // 4. Charger le bulletin de l'utilisateur
  const userBallotRef = useMemoFirebase(() => {
    if (!activeAssembly || !activeVote || !user) return null;
    return doc(db, 'assemblies', activeAssembly.id, 'votes', activeVote.id, 'ballots', user.uid);
  }, [db, activeAssembly, activeVote, user]);
  const { data: userBallot, isLoading: isBallotLoading } = useDoc<Ballot>(userBallotRef);

  // 5. Charger tous les bulletins pour les résultats en temps réel
  const allBallotsQuery = useMemoFirebase(() => {
    if (!activeAssembly || !activeVote) return null;
    return collection(db, 'assemblies', activeAssembly.id, 'votes', activeVote.id, 'ballots');
  }, [db, activeAssembly, activeVote]);
  const { data: allBallots } = useCollection<Ballot>(allBallotsQuery);

  const [currentRanking, setCurrentRanking] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Initialiser le classement
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

  const results = allBallots && activeProjects.length > 0 
    ? computeSchulzeResults(activeProjects.map(p => p.id), allBallots)
    : null;

  if (isAssemblyLoading || isVoteLoading || isProjectsLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Chargement de la session...</p>
      </div>
    );
  }

  if (!activeVote || activeVote.state !== 'open') {
    return (
      <div className="text-center py-24 space-y-6">
        <h1 className="text-3xl font-bold">Aucun vote en cours</h1>
        <p className="text-muted-foreground">Revenez plus tard pour participer aux prochaines décisions de l'assemblée.</p>
        <Link href="/assembly">
          <Button variant="outline" className="rounded-none h-12 px-8 uppercase font-bold text-xs">Retour au Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-in fade-in duration-700">
      <div className="space-y-12">
        <header className="space-y-4">
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-primary block">Scrutin Direct</span>
          <h1 className="text-4xl font-bold tracking-tight">{activeVote.question}</h1>
          <p className="text-muted-foreground leading-relaxed">
            Classez les projets par ordre de préférence. Utilisez les flèches pour placer votre projet favori en position n°1.
          </p>
        </header>

        <div className="space-y-3">
          {currentRanking.map((id, index) => {
            const project = activeProjects.find(p => p.id === id);
            if (!project) return null;
            return (
              <div key={id} className="group flex items-center gap-4 p-5 bg-white border border-border hover:border-black transition-all">
                <div className="w-10 h-10 flex items-center justify-center bg-secondary font-bold text-sm">
                  {index + 1}
                </div>
                <div className="flex-grow">
                  <h3 className="font-bold text-lg">{project.title}</h3>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">{project.budget}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-8 w-8 hover:bg-black hover:text-white rounded-none" 
                    onClick={() => moveItem(index, 'up')}
                    disabled={index === 0}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-8 w-8 hover:bg-black hover:text-white rounded-none" 
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

        <div className="pt-6 space-y-6">
          <Button 
            className="w-full h-16 text-xs uppercase tracking-[0.2em] font-bold rounded-none" 
            onClick={handleVoteSubmit} 
            disabled={isSaving}
          >
            {isSaving ? "Enregistrement en cours..." : userBallot ? "Mettre à jour mon vote" : "Valider mon classement"}
          </Button>

          {userBallot && (
            <div className="flex items-center gap-3 p-5 bg-green-50 text-green-700 text-sm font-bold border border-green-100 animate-in zoom-in-95 duration-300">
              <CheckCircle2 className="h-5 w-5" />
              <span>Votre participation a été enregistrée.</span>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-12 bg-secondary/10 p-10 border border-border">
        <header className="flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-[0.2em] font-bold flex items-center gap-3">
            <Trophy className="h-4 w-4 text-primary" />
            Tendance actuelle
          </h2>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Users className="h-3 w-3" />
            {results?.total || 0} bulletins reçus
          </div>
        </header>

        <div className="space-y-4">
          {results?.ranking.map((rankInfo) => {
            const project = activeProjects.find(p => p.id === rankInfo.id);
            const isWinner = rankInfo.rank === 1;
            return (
              <div key={rankInfo.id} className={`p-5 flex items-center gap-5 ${isWinner ? 'bg-white border-black ring-1 ring-black shadow-sm' : 'bg-white/50 border-border'} border transition-all`}>
                <div className={`w-8 h-8 flex items-center justify-center text-xs font-black ${isWinner ? 'bg-black text-white' : 'bg-muted text-muted-foreground'}`}>
                  #{rankInfo.rank}
                </div>
                <div className="flex-grow">
                  <div className="font-bold text-sm uppercase tracking-tight">{project?.title}</div>
                  <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">Algorithme Schulze</div>
                </div>
                {isWinner && <ChevronRight className="h-4 w-4 text-primary" />}
              </div>
            );
          })}
        </div>

        <div className="pt-8 border-t border-border mt-8">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-relaxed">
            Le classement est calculé via la méthode de Schulze (Condorcet), garantissant qu'un projet n'est élu que s'il est préféré par une majorité face à chacun de ses concurrents individuellement.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VotePage() {
  return (
    <RequireActiveMember>
      <MainLayout statusText="Vote Ouvert">
        <VoteContent />
      </MainLayout>
    </RequireActiveMember>
  );
}
