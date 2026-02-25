'use client';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Vote, Project } from '@/types';
import { Badge } from '@/components/ui/badge';
import { FileText, PieChart, Trophy, Calendar, ChevronRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { DEFAULT_ASSEMBLY_ID } from '@/components/auth/AuthStatusProvider';

function ResultsContent() {
  const db = useFirestore();
  const [selectedVoteId, setSelectedVoteId] = useState<string | null>(null);

  // Charger les votes archivés de l'assemblée par défaut
  const votesQuery = useMemoFirebase(() => 
    query(
      collection(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes'), 
      where('state', '==', 'locked'),
      orderBy('updatedAt', 'desc'), 
      limit(50)
    ), 
  [db]);
  const { data: votes, isLoading: isVotesLoading } = useCollection<Vote>(votesQuery);

  // Charger les projets pour les libellés
  const projectsQuery = useMemoFirebase(() => query(collection(db, 'projects'), limit(100)), [db]);
  const { data: projects } = useCollection<Project>(projectsQuery);

  if (isVotesLoading && !votes) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-12 h-12 border-t-2 border-primary animate-spin rounded-full"></div>
        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Ouverture des scellés...</p>
      </div>
    );
  }

  return (
    <div className="space-y-16 animate-in fade-in duration-700">
      <header className="space-y-8">
        <div className="space-y-2">
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted-foreground block">
            Archives
          </span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-black">Décisions de l'Assemblée</h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-2xl font-medium leading-relaxed">
          Consultez les procès-verbaux officiels et les résultats certifiés des sessions de vote passées.
        </p>
      </header>

      {votes && votes.length > 0 ? (
        <div className="grid gap-8">
          {votes.map((vote) => {
            const isSelected = selectedVoteId === vote.id;
            const results = vote.results;
            const winner = projects?.find(p => p.id === results?.winnerId);
            
            return (
              <div 
                key={vote.id} 
                className={cn(
                  "border border-border bg-white transition-all overflow-hidden",
                  isSelected ? "border-black shadow-lg" : "hover:border-black/50"
                )}
              >
                <div 
                  className="p-8 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-6"
                  onClick={() => setSelectedVoteId(isSelected ? null : vote.id)}
                >
                  <div className="space-y-2 text-left">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-black text-white rounded-none uppercase font-bold text-[9px] tracking-widest">
                        Scrutin Archivé
                      </Badge>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {vote.updatedAt?.seconds ? format(new Date(vote.updatedAt.seconds * 1000), 'dd MMMM yyyy', { locale: fr }) : 'Date inconnue'}
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold">{vote.question}</h3>
                  </div>
                  <ChevronRight className={cn("h-5 w-5 text-muted-foreground transition-transform", isSelected && "rotate-90")} />
                </div>

                {isSelected && results && (
                  <div className="px-8 pb-12 pt-4 border-t border-border animate-in slide-in-from-top-2 duration-300 space-y-12 bg-white">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 py-8 border-b border-border/50">
                      <div className="space-y-2">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground flex items-center gap-2">
                          <PieChart className="h-3.5 w-3.5" /> Participation
                        </p>
                        <p className="text-xl font-black">{vote.ballotCount || 0} / {vote.eligibleCount || 0}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground flex items-center gap-2">
                          <Trophy className="h-3.5 w-3.5" /> Projet Élu
                        </p>
                        <p className="text-xl font-black uppercase text-primary">
                          {winner?.title || results.winnerId}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5" /> Statut
                        </p>
                        <p className="text-xl font-black uppercase">PV Certifié</p>
                      </div>
                    </div>

                    <div className="space-y-6 bg-secondary/5 p-8 border border-dashed border-border">
                      <h5 className="text-[9px] uppercase font-black tracking-[0.2em] text-center mb-6">Classement Schulze</h5>
                      <div className="max-w-md mx-auto space-y-2">
                        {results.fullRanking?.map((rankItem) => {
                          const project = projects?.find(p => p.id === rankItem.id);
                          return (
                            <div key={rankItem.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                              <div className="flex items-center gap-4">
                                <span className={cn(
                                  "w-5 h-5 flex items-center justify-center text-[9px] font-black",
                                  rankItem.rank === 1 ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                                )}>
                                  {rankItem.rank}
                                </span>
                                <span className={cn("text-xs", rankItem.rank === 1 ? "font-bold" : "text-muted-foreground")}>
                                  {project?.title || rankItem.id}
                                </span>
                              </div>
                              {rankItem.rank === 1 && <Trophy className="h-3 w-3 text-primary" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-32 border border-dashed border-border bg-secondary/5 space-y-4">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto opacity-20" />
          <p className="text-muted-foreground italic font-medium">Aucun procès-verbal archivé.</p>
        </div>
      )}
    </div>
  );
}

export default function ResultsPage() {
  return (
    <RequireActiveMember>
      <MainLayout statusText="Archives">
        <ResultsContent />
      </MainLayout>
    </RequireActiveMember>
  );
}

import { where } from 'firebase/firestore';