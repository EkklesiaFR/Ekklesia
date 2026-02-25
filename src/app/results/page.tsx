'use client';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import { Assembly, Vote, Project } from '@/types';
import { Badge } from '@/components/ui/badge';
import { FileText, PieChart, Trophy, Calendar, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useState } from 'react';

/**
 * Composant pour afficher le PV détaillé d'une assemblée clôturée.
 */
function AssemblyResultPV({ assembly, projects }: { assembly: Assembly; projects: Project[] }) {
  const db = useFirestore();
  const voteRef = useMemoFirebase(() => {
    if (!assembly.activeVoteId) return null;
    return doc(db, 'assemblies', assembly.id, 'votes', assembly.activeVoteId);
  }, [db, assembly.id, assembly.activeVoteId]);
  
  const { data: vote, isLoading } = useDoc<Vote>(voteRef);

  if (isLoading) return <div className="h-24 bg-secondary/10 animate-pulse border border-dashed border-border" />;
  if (!vote || !vote.results) return null;

  const results = vote.results;
  const winner = projects.find(p => p.id === results.winnerId);

  return (
    <div className="px-8 pb-12 pt-4 border-t border-border animate-in slide-in-from-top-2 duration-300">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12 py-8 border-b border-border mb-12">
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
            {winner?.title || results.winnerId || 'Calculé'}
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" /> Statut
          </p>
          <p className="text-xl font-black uppercase">Archives Scellées</p>
        </div>
      </div>

      <div className="space-y-8 bg-secondary/5 p-8 border border-dashed border-border">
        <h4 className="text-xs uppercase font-black tracking-[0.2em] text-center mb-8">Classement Schulze Certifié</h4>
        <div className="max-w-md mx-auto space-y-3">
          {results.fullRanking?.map((rankItem) => {
            const project = projects.find(p => p.id === rankItem.id);
            return (
              <div key={rankItem.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-4">
                  <span className={cn(
                    "w-6 h-6 flex items-center justify-center text-[10px] font-black",
                    rankItem.rank === 1 ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                  )}>
                    {rankItem.rank}
                  </span>
                  <span className={cn("text-sm", rankItem.rank === 1 ? "font-bold" : "text-muted-foreground")}>
                    {project?.title || rankItem.id}
                  </span>
                </div>
                {rankItem.rank === 1 && <Trophy className="h-3.5 w-3.5 text-primary" />}
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-center text-muted-foreground italic leading-relaxed pt-8 border-t border-border/50 mt-8">
          Les résultats de ce scrutin ont été audités et validés par le conseil de l&apos;Assemblée Ekklesia.
        </p>
      </div>
    </div>
  );
}

function ResultsContent() {
  const db = useFirestore();
  const [selectedAssemblyId, setSelectedAssemblyId] = useState<string | null>(null);

  // 1. Charger les assemblées verrouillées
  const assembliesQuery = useMemoFirebase(() => 
    query(collection(db, 'assemblies'), where('state', '==', 'locked'), orderBy('updatedAt', 'desc')), 
  [db]);
  const { data: assemblies, isLoading: isAssembliesLoading } = useCollection<Assembly>(assembliesQuery);

  // 2. Charger les projets pour les titres
  const projectsQuery = useMemoFirebase(() => collection(db, 'projects'), [db]);
  const { data: projects } = useCollection<Project>(projectsQuery);

  if (isAssembliesLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-12 h-12 border-t-2 border-primary animate-spin rounded-full"></div>
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
          Consultez les procès-verbaux officiels et les résultats des sessions de vote terminées.
        </p>
      </header>

      {assemblies && assemblies.length > 0 ? (
        <div className="grid gap-8">
          {assemblies.map((assembly) => {
            const isSelected = selectedAssemblyId === assembly.id;
            
            return (
              <div 
                key={assembly.id} 
                className={cn(
                  "border border-border bg-white transition-all overflow-hidden",
                  isSelected ? "border-black shadow-lg" : "hover:border-black/50"
                )}
              >
                <div 
                  className="p-8 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-6"
                  onClick={() => setSelectedAssemblyId(isSelected ? null : assembly.id)}
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-[#7DC092] rounded-none uppercase font-bold text-[9px] tracking-widest">Officiel</Badge>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {assembly.updatedAt?.seconds ? format(new Date(assembly.updatedAt.seconds * 1000), 'dd MMMM yyyy', { locale: fr }) : 'Date inconnue'}
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold">{assembly.title}</h3>
                  </div>
                  <ChevronRight className={cn("h-5 w-5 text-muted-foreground transition-transform", isSelected && "rotate-90")} />
                </div>

                {isSelected && (
                  <AssemblyResultPV assembly={assembly} projects={projects || []} />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-32 border border-dashed border-border bg-secondary/5 space-y-4">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto opacity-20" />
          <p className="text-muted-foreground italic font-medium">Aucun résultat n'a encore été publié officiellement.</p>
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