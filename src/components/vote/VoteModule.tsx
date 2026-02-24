'use client';

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, serverTimestamp, setDoc, collection } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Trophy, Users, ChevronRight, Loader2, Info } from 'lucide-react';
import { computeSchulzeResults } from '@/lib/tally';
import { toast } from '@/hooks/use-toast';
import { Project, Vote, Ballot } from '@/types';
import { RankedList } from '@/components/voting/RankedList';

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

  // Initialiser le classement à partir du bulletin existant ou de l'ordre par défaut
  useEffect(() => {
    if (userBallot?.ranking) {
      setCurrentRanking(userBallot.ranking);
    } else if (projects.length > 0 && currentRanking.length === 0) {
      setCurrentRanking(projects.map(p => p.id));
    }
  }, [userBallot, projects]);

  // Charger tous les bulletins pour les résultats Schulze en temps réel
  const allBallotsQuery = useMemoFirebase(() => {
    return collection(db, 'assemblies', assemblyId, 'votes', vote.id, 'ballots');
  }, [db, assemblyId, vote.id]);
  const { data: allBallots } = useCollection<Ballot>(allBallotsQuery);

  const handleVoteSubmit = async () => {
    if (!user) return;
    setIsSaving(true);

    const userBallotRef = doc(db, 'assemblies', assemblyId, 'votes', vote.id, 'ballots', user.uid);

    try {
      await setDoc(userBallotRef, {
        ranking: currentRanking,
        castAt: userBallot?.castAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      
      toast({ 
        title: "Vote enregistré", 
        description: "Votre classement préférentiel a été mis à jour." 
      });
    } catch (e: any) {
      toast({ 
        variant: "destructive", 
        title: "Erreur", 
        description: "Impossible de sauvegarder votre vote." 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const results = allBallots && projects.length > 0 
    ? computeSchulzeResults(projects.map(p => p.id), allBallots)
    : null;

  // Mapper les IDs du classement vers les objets Projets complets
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
            <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed italic">
              Classez les projets par ordre de préférence. Le projet en position n°1 est votre favori. 
              <strong> Faites glisser les cartes</strong> pour réorganiser la liste.
            </p>
          </div>
        </header>

        <div className="space-y-6">
          <RankedList 
            projects={sortedProjects} 
            onOrderChange={setCurrentRanking} 
          />
        </div>

        <div className="pt-8 space-y-6">
          <Button 
            className="w-full h-16 text-xs uppercase tracking-[0.2em] font-bold rounded-none shadow-sm hover:shadow-md transition-all" 
            onClick={handleVoteSubmit} 
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Enregistrement...
              </>
            ) : userBallot ? "Mettre à jour mon vote" : "Valider mon classement"}
          </Button>

          {userBallot && (
            <div className="flex items-center gap-3 p-5 bg-green-50 text-green-700 text-sm font-bold border border-green-100 animate-in zoom-in-95 duration-300">
              <CheckCircle2 className="h-5 w-5" />
              <span>Votre participation a été prise en compte.</span>
            </div>
          )}
        </div>
      </div>

      <aside className="space-y-12 lg:bg-secondary/5 lg:p-12 border-l border-border">
        <header className="flex items-center justify-between border-b border-border pb-6">
          <h2 className="text-xs uppercase tracking-[0.2em] font-bold flex items-center gap-3">
            <Trophy className="h-4 w-4 text-primary" />
            Tendance en direct
          </h2>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Users className="h-3 w-3" />
            {results?.total || 0} bulletins
          </div>
        </header>

        <div className="space-y-4">
          {results?.ranking.map((rankInfo) => {
            const project = projects.find(p => p.id === rankInfo.id);
            const isWinner = rankInfo.rank === 1;
            return (
              <div key={rankInfo.id} className={`p-5 flex items-center gap-5 transition-all ${isWinner ? 'bg-white border-black ring-1 ring-black shadow-lg translate-x-2' : 'bg-white/50 border-border'} border`}>
                <div className={`w-10 h-10 flex items-center justify-center text-xs font-black ${isWinner ? 'bg-black text-white' : 'bg-muted text-muted-foreground'}`}>
                  #{rankInfo.rank}
                </div>
                <div className="flex-grow">
                  <div className="font-bold text-sm uppercase tracking-tight line-clamp-1">{project?.title}</div>
                  <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">Méthode Schulze</div>
                </div>
                {isWinner && <ChevronRight className="h-4 w-4 text-primary" />}
              </div>
            );
          })}
        </div>

        <div className="pt-12 border-t border-border mt-8 space-y-4">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-black">À propos du mode de scrutin</h4>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-relaxed">
            Ekklesia utilise la méthode de Schulze (Condorcet). Ce système garantit que le projet élu est celui qui l'emporte dans des duels face à chaque autre projet, assurant une légitimité maximale à la décision collective.
          </p>
        </div>
      </aside>
    </div>
  );
}
