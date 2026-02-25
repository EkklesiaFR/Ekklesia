
'use client';

import { useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Trophy, Users, BarChart3, ChevronRight, Calendar, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { Assembly, Vote, Project } from '@/types';
import { cn } from '@/lib/utils';

/**
 * LastVoteResultCard - Affiche le dernier résultat officiel (PV) publié.
 * Cherche l'assemblée verrouillée la plus récente et son scrutin final.
 */
export function LastVoteResultCard() {
  const db = useFirestore();

  // 1. Rechercher l'assemblée verrouillée la plus récente
  const latestLockedAssemblyQuery = useMemoFirebase(() => 
    query(
      collection(db, 'assemblies'), 
      where('state', '==', 'locked'), 
      orderBy('updatedAt', 'desc'), 
      limit(1)
    ), 
  [db]);
  const { data: assemblies, isLoading: isAssemblyLoading } = useCollection<Assembly>(latestLockedAssemblyQuery);
  const latestAssembly = assemblies?.[0];

  // 2. Rechercher les scrutins de cette assemblée
  const votesQuery = useMemoFirebase(() => {
    if (!latestAssembly) return null;
    return collection(db, 'assemblies', latestAssembly.id, 'votes');
  }, [db, latestAssembly]);
  const { data: allVotes, isLoading: isVoteLoading } = useCollection<Vote>(votesQuery);

  // 3. Charger les projets pour résoudre les titres dans le classement
  const projectsQuery = useMemoFirebase(() => collection(db, 'projects'), [db]);
  const { data: projects, isLoading: isProjectsLoading } = useCollection<Project>(projectsQuery);

  // Trier les scrutins en mémoire pour trouver le dernier ayant des résultats
  const vote = useMemo(() => {
    if (!allVotes) return null;
    return allVotes
      .filter(v => v.results && v.state === 'locked')
      .sort((a, b) => {
        const tA = a.closedAt?.seconds || 0;
        const tB = b.closedAt?.seconds || 0;
        return tB - tA;
      })[0];
  }, [allVotes]);

  const isLoading = isAssemblyLoading || isVoteLoading || isProjectsLoading;

  useEffect(() => {
    if (vote) {
      console.log("[DASH] Procès-Verbal identifié", { 
        assemblyId: latestAssembly?.id, 
        voteId: vote.id,
        results: !!vote.results
      });
    }
  }, [vote, latestAssembly]);

  if (isLoading) {
    return (
      <Card className="rounded-none border-border overflow-hidden bg-white h-full">
        <CardHeader className="p-8 pb-6 border-b border-border">
          <Skeleton className="h-4 w-24 mb-4" />
          <Skeleton className="h-8 w-3/4" />
        </CardHeader>
        <CardContent className="p-8 space-y-6">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!vote || !vote.results) {
    return (
      <div className="p-8 border border-dashed border-border bg-secondary/5 text-center space-y-4 h-full flex flex-col justify-center">
        <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto opacity-20" />
        <p className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Aucun résultat publié</p>
      </div>
    );
  }

  const results = vote.results;
  const winner = projects?.find(p => p.id === results.winnerId);
  const topRanking = results.fullRanking?.slice(0, 5).map(r => ({
    ...r,
    label: projects?.find(p => p.id === r.id)?.title || r.id
  }));

  return (
    <Card className="rounded-none border-border overflow-hidden bg-white hover:border-black transition-all group flex flex-col justify-between h-full">
      <div>
        <CardHeader className="p-8 pb-6 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <Badge className="bg-[#7DC092] rounded-none uppercase font-bold text-[9px] tracking-widest">Dernier Procès-Verbal</Badge>
            {vote.closedAt?.seconds && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(vote.closedAt.seconds * 1000), 'dd MMM yyyy', { locale: fr })}
              </span>
            )}
          </div>
          <h3 className="text-2xl font-bold tracking-tight">{vote.question || latestAssembly?.title}</h3>
        </CardHeader>

        <CardContent className="p-8 space-y-10">
          <div className="space-y-4">
            <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-primary flex items-center gap-2">
              <Trophy className="h-3 w-3" /> Projet Retenu
            </p>
            <div className="p-6 bg-primary/5 border border-primary/20">
              <p className="text-xl font-black uppercase leading-tight">{winner?.title || results.winnerId}</p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Users className="h-3 w-3" /> Participation
            </p>
            <p className="text-lg font-black">{results.total} membres ont participé</p>
          </div>

          {topRanking && topRanking.length > 0 && (
            <div className="space-y-4 pt-4">
              <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground">Tête du classement</p>
              <div className="space-y-2">
                {topRanking.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 text-sm py-1">
                    <span className={cn(
                      "w-6 h-6 flex items-center justify-center font-black text-[10px]",
                      item.rank === 1 ? "bg-primary text-white" : "bg-secondary text-muted-foreground"
                    )}>
                      {item.rank}
                    </span>
                    <span className={cn("truncate", item.rank === 1 ? "font-bold" : "text-muted-foreground")}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </div>

      <CardFooter className="p-8 pt-0">
        <Link href="/results" className="w-full">
          <Button variant="outline" className="w-full rounded-none h-12 text-xs uppercase font-bold tracking-widest gap-2">
            Consulter les détails <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
