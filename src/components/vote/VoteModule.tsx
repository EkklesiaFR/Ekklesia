'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, serverTimestamp, writeBatch, increment } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Info, Loader2, Lock, BarChart3, Users, PieChart } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Project, Vote, Ballot } from '@/types';
import { RankedList } from '@/components/voting/RankedList';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface VoteModuleProps {
  vote: Vote;
  projects: Project[];
  userBallot: Ballot | null;
  assemblyId: string;
}

export function VoteModule({ vote, projects, userBallot, assemblyId }: VoteModuleProps) {
  const { user } = useUser();
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

  const handleVoteSubmit = async () => {
    if (!user) return;
    setIsSaving(true);

    const voteRef = doc(db, 'assemblies', assemblyId, 'votes', vote.id);
    const userBallotRef = doc(db, 'assemblies', assemblyId, 'votes', vote.id, 'ballots', user.uid);

    try {
      const batch = writeBatch(db);
      const isNewBallot = !userBallot;
      
      batch.set(userBallotRef, {
        ranking: currentRanking,
        castAt: userBallot?.castAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      if (isNewBallot) {
        batch.update(voteRef, {
          ballotCount: increment(1),
          updatedAt: serverTimestamp()
        });
      }
      
      await batch.commit();
      toast({ title: "Vote enregistré", description: "Votre classement a été pris en compte." });
    } catch (e: any) {
      console.error("Vote submission error:", e);
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de sauvegarder votre vote." });
    } finally {
      setIsSaving(false);
    }
  };

  const ballotCount = vote.ballotCount || 0;
  const eligibleCount = vote.eligibleCount || 100;
  const participationRate = Math.round((ballotCount / eligibleCount) * 100);
  const abstentionCount = Math.max(0, eligibleCount - ballotCount);

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
          {vote.state === 'open' ? (
            <RankedList projects={sortedProjects} onOrderChange={setCurrentRanking} />
          ) : (
            <div className="p-12 border border-dashed border-border bg-secondary/5 text-center space-y-4">
              <Lock className="h-8 w-8 text-muted-foreground mx-auto opacity-20" />
              <p className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Les votes ne sont pas ouverts</p>
            </div>
          )}
        </div>

        {vote.state === 'open' && (
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
        )}
      </div>

      <aside className="space-y-12 lg:bg-secondary/5 lg:p-12 border-l border-border">
        {vote.state === 'draft' ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
            <Lock className="h-12 w-12 text-muted-foreground opacity-20" />
            <div className="space-y-2">
              <h3 className="text-xs uppercase tracking-[0.2em] font-bold">Scrutin en attente</h3>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-relaxed">
                Ce vote n&apos;est pas encore ouvert à l&apos;assemblée.
              </p>
            </div>
          </div>
        ) : vote.state === 'open' ? (
          <div className="space-y-12">
            <header className="flex items-center justify-between border-b border-border pb-6">
              <h2 className="text-xs uppercase tracking-[0.2em] font-bold flex items-center gap-3">
                <PieChart className="h-4 w-4 text-primary" />
                Participation
              </h2>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Users className="h-3 w-3" />
                {ballotCount} bulletins
              </div>
            </header>

            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Taux de participation</span>
                  <span className="text-lg font-black">{participationRate}%</span>
                </div>
                <Progress value={participationRate} className="h-2 rounded-none" />
              </div>

              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-border">
                <div className="space-y-1">
                  <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest">Inscrits</p>
                  <p className="text-xl font-bold">{eligibleCount}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] uppercase font-black text-muted-foreground tracking-widest">Abstentions</p>
                  <p className="text-xl font-bold text-muted-foreground">{abstentionCount}</p>
                </div>
              </div>

              <div className="p-6 bg-white border border-border space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-black flex items-center gap-2">
                  <BarChart3 className="h-3 w-3 text-primary" /> Scrutin Secret
                </p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Les tendances de vote sont masquées jusqu&apos;à la clôture officielle du scrutin.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            <header className="flex items-center justify-between border-b border-border pb-6">
              <h2 className="text-xs uppercase tracking-[0.2em] font-bold flex items-center gap-3">
                <BarChart3 className="h-4 w-4 text-primary" />
                Résultat Final
              </h2>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Scrutin Clos
              </div>
            </header>

            <div className="space-y-4">
              {vote.results?.fullRanking ? (
                vote.results.fullRanking.map((rankInfo) => (
                  <div key={rankInfo.id} className={cn(
                    "p-5 flex items-center gap-5 border transition-all", 
                    rankInfo.rank === 1 ? 'bg-white border-primary ring-1 ring-primary shadow-lg' : 'bg-white/50 border-border'
                  )}>
                    <div className={cn(
                      "w-10 h-10 flex items-center justify-center text-xs font-black", 
                      rankInfo.rank === 1 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                    )}>
                      #{rankInfo.rank}
                    </div>
                    <div className="flex-grow">
                      <div className="font-bold text-sm uppercase tracking-tight">
                        {projects.find(p => p.id === rankInfo.id)?.title}
                      </div>
                      <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">
                        Résultat Officiel
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground italic text-center py-12">
                  Résultats en cours de publication...
                </p>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
