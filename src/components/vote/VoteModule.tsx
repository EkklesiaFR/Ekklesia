'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { useAuthStatus } from '@/components/auth/AuthStatusProvider';
import { doc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Info, Loader2, Lock, BarChart3, PieChart } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Project, Vote, Ballot } from '@/types';
import { RankedList } from '@/components/voting/RankedList';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { AdminTrendsPanel } from '@/components/voting/AdminTrendsPanel';

function ParticipationPanel({ 
  ballotCount, 
  eligibleCount, 
  isLoading 
}: { 
  ballotCount?: number; 
  eligibleCount?: number;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="p-6 border border-dashed border-border bg-white/50 space-y-2 text-center">
        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Calcul du quorum…</p>
      </div>
    );
  }

  if (eligibleCount === undefined || eligibleCount === null) {
    return (
      <div className="p-6 border border-dashed border-border bg-white/50 space-y-2 text-center">
        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Quorum en calcul…</p>
        <p className="text-[9px] text-muted-foreground italic leading-tight">Le quorum doit être calculé par un administrateur à l'ouverture.</p>
        <p className="text-[8px] text-muted-foreground/30 font-mono mt-2 uppercase">Bulletins reçus : {ballotCount ?? 0}</p>
      </div>
    );
  }

  if (eligibleCount === 0) {
    return (
      <div className="p-6 border border-dashed border-border bg-white/50 space-y-2 text-center">
        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Aucun membre éligible</p>
      </div>
    );
  }

  const voters = ballotCount ?? 0;
  const participationRate = Math.round((voters / eligibleCount) * 100);
  const abstentionCount = Math.max(0, eligibleCount - voters);

  return (
    <div className="space-y-12">
      <header className="flex items-center justify-between border-b border-border pb-6">
        <div className="space-y-1">
          <h2 className="text-xs uppercase tracking-[0.2em] font-bold flex items-center gap-3">
            <PieChart className="h-4 w-4 text-primary" /> Participation
          </h2>
          <p className="text-[8px] uppercase font-bold text-muted-foreground">Suffrage défini : {eligibleCount}</p>
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {voters} bulletins reçus
        </div>
      </header>

      <div className="space-y-8">
        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Taux</span>
            <span className="text-lg font-black">{participationRate}%</span>
          </div>
          <Progress value={participationRate} className="h-2 rounded-none" />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-white border border-border space-y-1">
            <p className="text-[9px] uppercase font-bold text-muted-foreground">Abstention</p>
            <p className="text-sm font-black">{abstentionCount}</p>
          </div>
          <div className="p-4 bg-white border border-border flex items-center gap-2">
            <BarChart3 className="h-3 w-3 text-primary" />
            <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest">Scrutin Secret</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VoteModule({ vote, projects, userBallot, assemblyId }: VoteModuleProps) {
  const { user } = useUser();
  const { isAdmin, isMemberLoading } = useAuthStatus();
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

    const userBallotRef = doc(db, 'assemblies', assemblyId, 'votes', vote.id, 'ballots', user.uid);

    try {
      await runTransaction(db, async (transaction) => {
        const ballotSnap = await transaction.get(userBallotRef);
        const isNewBallot = !ballotSnap.exists();
        
        const timestamp = serverTimestamp();

        if (isNewBallot) {
          console.log(`[VOTE] [BALLOT] creating for ${user.uid}`);
          transaction.set(userBallotRef, {
            ranking: currentRanking,
            castAt: timestamp,
            updatedAt: timestamp,
          });
          // Le compteur ballotCount sera désormais mis à jour lors du dépouillement admin
          // pour des raisons de sécurité et d'intégrité des données.
        } else {
          console.log(`[VOTE] [BALLOT] updating for ${user.uid}`);
          transaction.update(userBallotRef, {
            ranking: currentRanking,
            updatedAt: timestamp,
          });
        }
      });
      
      toast({ title: "Vote enregistré", description: "Votre classement a été pris en compte." });
    } catch (e: any) {
      console.error("[VOTE] Submission error:", e.code, e.message);
      toast({ 
        variant: "destructive", 
        title: `Erreur (${e.code || 'UNKNOWN'})`, 
        description: "Impossible de sauvegarder votre vote." 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const sortedProjects = currentRanking
    .map(id => projects.find(p => p.id === id))
    .filter((p): p is Project => !!p);

  const canShowAdminTrends = !isMemberLoading && isAdmin === true && vote.state === 'open';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="space-y-12">
        <header className="space-y-6">
          <div className="space-y-2">
            <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-primary block">Scrutin Direct</span>
            <h1 className="text-4xl font-bold tracking-tight text-black">{vote.question}</h1>
          </div>
          <div className="flex items-start gap-3 p-4 bg-secondary/30 border border-border">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed italic">
              Classez les projets par préférence (1 = favori). Glissez les cartes pour réorganiser.
              Votre vote est secret et peut être modifié jusqu'à la clôture.
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
            <h3 className="text-xs uppercase tracking-[0.2em] font-bold">Scrutin en attente</h3>
          </div>
        ) : vote.state === 'open' ? (
          <div className="space-y-12">
            {canShowAdminTrends ? (
              <AdminTrendsPanel 
                assemblyId={assemblyId} 
                voteId={vote.id} 
                projects={projects} 
              />
            ) : (
              <ParticipationPanel 
                ballotCount={vote.ballotCount} 
                eligibleCount={vote.eligibleCountAtOpen}
              />
            )}
          </div>
        ) : (
          <div className="space-y-12">
            <header className="flex items-center justify-between border-b border-border pb-6">
              <h2 className="text-xs uppercase tracking-[0.2em] font-bold flex items-center gap-3">
                <BarChart3 className="h-4 w-4 text-primary" /> Résultat Final
              </h2>
            </header>

            <div className="space-y-4">
              {vote.results?.fullRanking ? (
                vote.results.fullRanking.map((rankInfo) => (
                  <div key={rankInfo.id} className={cn(
                    "p-5 flex items-center gap-5 border", 
                    rankInfo.rank === 1 ? 'bg-white border-primary ring-1 ring-primary' : 'bg-white/50 border-border'
                  )}>
                    <div className={cn(
                      "w-10 h-10 flex items-center justify-center text-xs font-black", 
                      rankInfo.rank === 1 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                    )}>
                      #{rankInfo.rank}
                    </div>
                    <div className="font-bold text-sm uppercase">
                      {projects.find(p => p.id === rankInfo.id)?.title}
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

interface VoteModuleProps {
  vote: Vote;
  projects: Project[];
  userBallot: Ballot | null;
  assemblyId: string;
}