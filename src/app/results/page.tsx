'use client';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { DEFAULT_ASSEMBLY_ID } from '@/config/assembly';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import { Vote, Project } from '@/types';
import { Badge } from '@/components/ui/badge';
import { FileText, PieChart, Trophy, Calendar, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useState } from 'react';

function ResultsContent() {
  const db = useFirestore();
  const [selectedVoteId, setSelectedVoteId] = useState<string | null>(null);

  const votesQuery = useMemoFirebase(() => 
    query(
      collection(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes'), 
      where('state', '==', 'locked'),
      orderBy('updatedAt', 'desc'), 
      limit(50)
    ), 
  [db]);
  const { data: votes, isLoading: isVotesLoading } = useCollection<Vote>(votesQuery);

  const projectsQuery = useMemoFirebase(() => query(collection(db, 'projects'), limit(100)), [db]);
  const { data: projects } = useCollection<Project>(projectsQuery);

  if (isVotesLoading) return <div className="py-24 text-center">Chargement...</div>;

  return (
    <div className="space-y-16 animate-in fade-in duration-700">
      <header className="space-y-8">
        <div className="space-y-2">
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted-foreground block">Archives</span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-black">Décisions de l'Assemblée</h1>
        </div>
      </header>

      {votes && votes.length > 0 ? (
        <div className="grid gap-8">
          {votes.map((vote) => {
            const isSelected = selectedVoteId === vote.id;
            const winner = projects?.find(p => p.id === vote.results?.winnerId);
            
            return (
              <div key={vote.id} className={cn("border border-border bg-white transition-all overflow-hidden", isSelected && "border-black shadow-lg")}>
                <div 
                  className="p-8 cursor-pointer flex justify-between items-center"
                  onClick={() => setSelectedVoteId(isSelected ? null : vote.id)}
                >
                  <div className="space-y-2">
                    <Badge className="bg-black text-white rounded-none uppercase text-[9px]">Scrutin Archivé</Badge>
                    <h3 className="text-2xl font-bold">{vote.question}</h3>
                  </div>
                  <ChevronRight className={cn("h-5 w-5 text-muted-foreground transition-transform", isSelected && "rotate-90")} />
                </div>

                {isSelected && vote.results && (
                  <div className="px-8 pb-12 pt-4 border-t border-border animate-in slide-in-from-top-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 py-8">
                      <div className="space-y-2">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Participation</p>
                        <p className="text-xl font-black">{vote.ballotCount || 0}</p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Vainqueur</p>
                        <p className="text-xl font-black uppercase text-primary">{winner?.title || '—'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-32 border border-dashed">Aucun résultat.</div>
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
