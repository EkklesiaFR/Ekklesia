'use client';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Assembly, Vote, Project } from '@/types';
import { Badge } from '@/components/ui/badge';
import { FileText, PieChart, Trophy, Calendar, ChevronRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef } from 'react';

/**
 * Composant pour afficher le PV détaillé d'une assemblée.
 * Implémente une logique de cache pour éviter les disparitions de données au refresh.
 */
function AssemblyVotesPV({ assembly, projects }: { assembly: Assembly; projects: Project[] }) {
  const db = useFirestore();
  const [cachedVotes, setCachedVotes] = useState<Vote[]>([]);
  const hasLoadedOnce = useRef(false);
  
  // Requête stable pour les votes de cette assemblée
  const votesQuery = useMemoFirebase(() => {
    return query(
      collection(db, 'assemblies', assembly.id, 'votes'),
      orderBy('updatedAt', 'desc'),
      limit(20)
    );
  }, [db, assembly.id]);
  
  const { data: fetchedVotes, isLoading } = useCollection<Vote>(votesQuery);

  // Mise à jour du cache uniquement quand on reçoit des données valides
  useEffect(() => {
    if (fetchedVotes && fetchedVotes.length > 0) {
      setCachedVotes(fetchedVotes);
      hasLoadedOnce.current = true;
      console.log(`[ARCHIVES] [PV] Cached ${fetchedVotes.length} votes for ${assembly.id}`);
    }
  }, [fetchedVotes, assembly.id]);

  // Détermination des votes à afficher (priorité au fetch, fallback au cache)
  const allVotes = fetchedVotes || cachedVotes;
  const closedVotes = allVotes
    ?.filter(v => v.results || v.state === 'locked' || v.state === 'closed')
    .sort((a, b) => {
      const dateA = a.results?.computedAt?.seconds || a.updatedAt?.seconds || 0;
      const dateB = b.results?.computedAt?.seconds || b.updatedAt?.seconds || 0;
      return dateB - dateA;
    }) || [];

  if (isLoading && !hasLoadedOnce.current) {
    return (
      <div className="h-32 flex flex-col items-center justify-center border border-dashed border-border mt-4 space-y-2">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Récupération des scrutins...</p>
      </div>
    );
  }

  if (!isLoading && closedVotes.length === 0) {
    return (
      <div className="p-12 text-center border border-dashed border-border mt-4 bg-secondary/5">
        <p className="text-xs text-muted-foreground italic">Aucun procès-verbal publié pour cette session.</p>
      </div>
    );
  }

  return (
    <div className="px-8 pb-12 pt-4 border-t border-border animate-in slide-in-from-top-2 duration-300 space-y-12 bg-white">
      {closedVotes.map((vote) => {
        const results = vote.results;
        if (!results) return null;
        const winner = projects.find(p => p.id === results.winnerId);

        return (
          <div key={vote.id} className="space-y-8 first:mt-4">
            <h4 className="text-sm font-bold uppercase tracking-widest border-l-4 border-primary pl-4 py-1">
              {vote.question || "Scrutin sans titre"}
            </h4>

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

            <div className="space-y-6 bg-secondary/5 p-8 border border-dashed border-border">
              <h5 className="text-[9px] uppercase font-black tracking-[0.2em] text-center mb-6">Classement Schulze Certifié</h5>
              <div className="max-w-md mx-auto space-y-2">
                {results.fullRanking?.map((rankItem) => {
                  const project = projects.find(p => p.id === rankItem.id);
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
              <p className="text-[9px] text-center text-muted-foreground italic leading-relaxed pt-6 border-t border-border/50 mt-6">
                Le procès-verbal de ce scrutin ({vote.id}) a été validé par le conseil.
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ResultsContent() {
  const db = useFirestore();
  const [selectedAssemblyId, setSelectedAssemblyId] = useState<string | null>(null);
  const assembliesLoaded = useRef(false);

  // Requête stable pour toutes les assemblées
  const assembliesQuery = useMemoFirebase(() => 
    query(collection(db, 'assemblies'), orderBy('updatedAt', 'desc'), limit(50)), 
  [db]);
  const { data: assemblies, isLoading: isAsmLoading } = useCollection<Assembly>(assembliesQuery);

  // Charger les projets pour les libellés (global pour éviter N requêtes)
  const projectsQuery = useMemoFirebase(() => query(collection(db, 'projects'), limit(100)), [db]);
  const { data: projects } = useCollection<Project>(projectsQuery);

  // Sélection automatique de la dernière assemblée au premier chargement
  useEffect(() => {
    if (!isAsmLoading && assemblies && assemblies.length > 0 && !assembliesLoaded.current) {
      setSelectedAssemblyId(assemblies[0].id);
      assembliesLoaded.current = true;
      console.log(`[ARCHIVES] Auto-selected latest assembly: ${assemblies[0].id}`);
    }
  }, [assemblies, isAsmLoading]);

  if (isAsmLoading && !assemblies) {
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
          Consultez les procès-verbaux officiels et les résultats certifiés des sessions de vote.
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
                  <div className="space-y-2 text-left">
                    <div className="flex items-center gap-3">
                      <Badge className={cn(
                        "rounded-none uppercase font-bold text-[9px] tracking-widest",
                        assembly.state === 'locked' ? "bg-black text-white" : "bg-[#7DC092] text-white"
                      )}>
                        {assembly.state === 'locked' ? 'Archives' : 'Session Active'}
                      </Badge>
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
                  <AssemblyVotesPV assembly={assembly} projects={projects || []} />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-32 border border-dashed border-border bg-secondary/5 space-y-4">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto opacity-20" />
          <p className="text-muted-foreground italic font-medium">Aucune archive n'a pu être récupérée.</p>
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
