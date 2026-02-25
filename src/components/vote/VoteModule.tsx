'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, serverTimestamp, setDoc, collection, updateDoc, increment } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Trophy, Users, ChevronRight, Loader2, Info, Lock, BarChart3 } from 'lucide-react';
import { computeSchulzeResults } from '@/lib/tally';
import { toast } from '@/hooks/use-toast';
import { Project, Vote, Ballot } from '@/types';
import { RankedList } from '@/components/voting/RankedList';
import { useAuthStatus } from '@/components/auth/AuthStatusProvider';
import { Progress } from '@/components/ui/progress';

interface VoteModuleProps {
  vote: Vote;
  projects: Project[];
  userBallot: Ballot | null;
  assemblyId: string;
}

export function VoteModule({ vote, projects, userBallot, assemblyId }: VoteModuleProps) {
  const { user } = useUser();
  const { isAdmin } = useAuthStatus();
  const db = useFirestore();
  const [currentRanking, setCurrentRanking] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (userBallot?.ranking) {
      setCurrentRanking(userBallot.ranking);
    } else if (projects.length > 0 && currentRanking.length === 0) {
      setCurrentRanking(projects.map(p => p.id));
    }
  }, [userBallot, projects]);

  /**
   * PREUVE DE SÉCURITÉ :
   * La requête LIST sur 'ballots' est STRICTEMENT conditionnée par isAdmin.
   * On définit explicitement canListBallots.
   * Si canListBallots est false, allBallotsQuery est null.
   * Firestore n'est pas interrogé en mode LIST pour les membres standards.
   */
  const canListBallots = isAdmin === true;
  const allBallotsQuery = useMemoFirebase(() => {
    if (!canListBallots) return null;
    return collection(db, 'assemblies', assemblyId, 'votes', vote.id, 'ballots');
  }, [db, assemblyId, vote.id, canListBallots]);
  
  const { data: allBallots } = useCollection<Ballot>(allBallotsQuery);

  const handleVoteSubmit = async () => {
    if (!user) return;
    setIsSaving(true);

    const voteRef = doc(db, 'assemblies', assemblyId, 'votes', vote.id);
    const userBallotRef = doc(db, 'assemblies', assemblyId, 'votes', vote.id, 'ballots', user.uid);

    try {
      const isNewBallot = !userBallot;
      
      await setDoc(userBallotRef, {
        ranking: currentRanking,
        castAt: userBallot?.castAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      if (isNewBallot) {
        await updateDoc(voteRef, {
          ballotCount: increment(1)
        });
      }
      
      toast({ title: "Vote enregistré", description: "Votre classement a été pris en compte." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de sauvegarder votre vote." });
    } finally {
      setIsSaving(false);
    }
  };

  const results = (canListBallots && allBallots && projects.length > 0) 
    ? computeSchulzeResults(projects.map(p => p.id), allBallots)
    : vote.results;

  const participationRate = (vote.eligibleCount && vote.eligibleCount > 0) 
    ? Math.round(((vote.ballotCount || 0) / vote.eligibleCount) * 100) 
    : 0;

  const sortedProjects = currentRanking
    .map(id => projects.find(p => p.id === id))
    .filter((p): p is Project => !!p);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="space-y-12">
        <header className="space-y-6">
          <div className="space-y-2">
            <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-primary block">Scrutin Direct</span>
            <h1 className="text-4xl font-bold tracking-tight text-black">{vote.question}</h1>
          </div>
          <div className="flex items-start gap-3 p-4 bg-secondary/30 border border-border">
            <span className="shrink-0"><Info className="h-4 w-4 text-muted-foreground mt-0.5" /></span>
            <p className="text-xs text-muted-foreground leading-relaxed italic">
              Classez les projets par préférence (1 = favori). Glissez les cartes pour réorganiser.
            </p>
          </div>
        </header>

        <div className="space-y-6">
          <RankedList projects={sortedProjects} onOrderChange={setCurrentRanking} />
        </div>

        <div className="pt-8 space-y-6">
          <Button className="w-full h-16 text-xs uppercase tracking-[0.2em] font-bold rounded-none" onClick={handleVoteSubmit} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : userBallot ? "Mettre à jour mon vote" : "Valider mon classement"}
          </Button>
          {userBallot && (
            <div className="flex items-center gap-3 p-5 bg-green-50 text-green-700 text-sm font-bold border border-green-100">
              <CheckCircle2 className="h-5 w-5" />
              <span>Vote enregistré.</span>
            </div>
          )}
        </div>
      </div>

      <aside className="space-y-12 lg:bg-secondary/5 lg:p-12 border-l border-border">
        <header className="flex items-center justify-between border-b border-border pb-6">
          <h2 className="text-xs uppercase tracking-[0.2em] font-bold flex items-center gap-3">
            <BarChart3 className="h-4 w-4 text-primary" />
            {canListBallots && vote.state === 'open' ? "Tendance Live (Admin)" : "Participation"}
          </h2>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Users className="h-3 w-3" />
            {vote.ballotCount || 0} bulletins
          </div>
        </header>

        <div className="space-y-8">
          {canListBallots && results && vote.state === 'open' ? (
            results.ranking.map((rankInfo) => (
              <div key={rankInfo.id} className={cn("p-5 flex items-center gap-5 border transition-all", rankInfo.rank === 1 ? 'bg-white border-black ring-1 ring-black shadow-lg translate-x-2' : 'bg-white/50 border-border')}>
                <div className={cn("w-10 h-10 flex items-center justify-center text-xs font-black", rankInfo.rank === 1 ? 'bg-black text-white' : 'bg-muted text-muted-foreground')}>
                  #{rankInfo.rank}
                </div>
                <div className="flex-grow">
                  <div className="font-bold text-sm uppercase tracking-tight">{projects.find(p => p.id === rankInfo.id)?.title}</div>
                  <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">Méthode Schulze</div>
                </div>
              </div>
            ))
          ) : vote.state === 'closed' && vote.results ? (
            vote.results.fullRanking.map((rankInfo) => (
              <div key={rankInfo.id} className={cn("p-5 flex items-center gap-5 border", rankInfo.rank === 1 ? 'bg-white border-primary ring-1 ring-primary shadow-lg' : 'bg-white/50 border-border')}>
                <div className={cn("w-10 h-10 flex items-center justify-center text-xs font-black", rankInfo.rank === 1 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground')}>
                  #{rankInfo.rank}
                </div>
                <div className="flex-grow">
                  <div className="font-bold text-sm uppercase tracking-tight">{projects.find(p => p.id === rankInfo.id)?.title}</div>
                  <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">Résultat Final</div>
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-8">
              <div className="p-8 border border-dashed border-border bg-white text-center space-y-4">
                <Lock className="h-8 w-8 text-muted-foreground mx-auto opacity-20" />
                <p className="text-[10px] uppercase font-bold tracking-widest text-black">Scrutin Secret</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-relaxed">Les tendances sont confidentielles.</p>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Taux de participation</span>
                  <span className="text-lg font-black">{participationRate}%</span>
                </div>
                <Progress value={participationRate} className="h-2 rounded-none" />
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
