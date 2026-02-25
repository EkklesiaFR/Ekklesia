
'use client';

import { useFirestore, useMemoFirebase, useCollection, useDoc } from '@/firebase';
import { collection, query, where, orderBy, limit, doc } from 'firebase/firestore';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Trophy, Users, BarChart3, ChevronRight, Calendar, Info } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useEffect, useMemo } from 'react';
import { Assembly, Project } from '@/types';
import { cn } from '@/lib/utils';

/**
 * LastVoteResultCard - Affiche le dernier résultat officiel (PV) publié.
 * Tente d'abord de lire l'instantané certifié dans /public/lastResult.
 */
export function LastVoteResultCard() {
  const db = useFirestore();

  // 1. Trouver l'assemblée la plus récente (limit 3 pour être sûr de trouver une session close)
  const assembliesQuery = useMemoFirebase(() => 
    query(collection(db, 'assemblies'), orderBy('updatedAt', 'desc'), limit(3)), 
  [db]);
  const { data: assemblies, isLoading: isAsmLoading } = useCollection<Assembly>(assembliesQuery);
  
  // On cherche la dernière qui est verrouillée (PV publié)
  const latestLocked = assemblies?.find(a => a.state === 'locked');

  // 2. Tenter de lire l'instantané public (certifié avec labels et scores)
  const publicResultRef = useMemoFirebase(() => {
    if (!latestLocked) return null;
    return doc(db, 'assemblies', latestLocked.id, 'public', 'lastResult');
  }, [db, latestLocked]);
  const { data: publicSnapshot, isLoading: isPubLoading, error: pubError } = useDoc<any>(publicResultRef);

  // 3. Fallback : Charger les projets si le snapshot public est absent
  const projectsQuery = useMemoFirebase(() => {
    if (publicSnapshot) return null; // Inutile si on a le snapshot complet
    return collection(db, 'projects');
  }, [db, publicSnapshot]);
  const { data: projects } = useCollection<Project>(projectsQuery);

  // LOGS DE DIAGNOSTIC
  useEffect(() => {
    if (latestLocked) {
      console.log("[LASTRESULT] latestLocked assembly:", latestLocked.id);
    }
    if (pubError) {
      console.error("[LASTRESULT] read failed", pubError.message);
    }
    if (publicSnapshot) {
      console.log("[LASTRESULT] public snapshot loaded", {
        voteId: publicSnapshot.voteId,
        hasRanking: !!publicSnapshot.ranking
      });
    }
  }, [latestLocked, publicSnapshot, pubError]);

  const isLoading = isAsmLoading || isPubLoading;

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

  // BLOC DE DEBUG VISUEL (Aide au dev)
  const renderDebug = () => {
    if (process.env.NODE_ENV !== 'development') return null;
    return (
      <div className="mt-4 p-4 bg-muted/50 border border-dashed text-[9px] font-mono space-y-1">
        <p className="font-bold flex items-center gap-1"><Info className="h-2 w-2" /> DIAGNOSTIC</p>
        <p>Latest locked assembly: {latestLocked?.id || 'NONE'}</p>
        <p>Public snapshot: {publicSnapshot ? 'FOUND' : 'MISSING'}</p>
      </div>
    );
  };

  if (!publicSnapshot && !latestLocked) {
    return (
      <div className="p-8 border border-dashed border-border bg-secondary/5 text-center space-y-4 h-full flex flex-col justify-center">
        <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto opacity-20" />
        <p className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Aucun résultat publié</p>
        {renderDebug()}
      </div>
    );
  }

  // Résolution robuste des données (Supporte snapshot ou données brutes de vote)
  const results = publicSnapshot || {};
  const voteTitle = results.voteTitle || latestLocked?.title || "Scrutin";
  const winnerLabel = results.winnerLabel || projects?.find(p => p.id === results.winnerId)?.title || "Projet retenu";
  const fullRanking = results.ranking || [];
  
  const topRanking = fullRanking.slice(0, 5).map((r: any) => ({
    ...r,
    label: r.label || projects?.find(p => p.id === (r.id || r.optionId))?.title || (r.id || r.optionId),
    displayScore: r.score ?? r.rank ?? r.points ?? "-"
  }));

  const closedDate = results.closedAt?.seconds || results.updatedAt?.seconds || latestLocked?.updatedAt?.seconds;

  return (
    <Card className="rounded-none border-border overflow-hidden bg-white hover:border-black transition-all group flex flex-col justify-between h-full">
      <div>
        <CardHeader className="p-8 pb-6 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <Badge className="bg-[#7DC092] rounded-none uppercase font-bold text-[9px] tracking-widest">Dernier Procès-Verbal</Badge>
            {closedDate && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(closedDate * 1000), 'dd MMM yyyy', { locale: fr })}
              </span>
            )}
          </div>
          <h3 className="text-2xl font-bold tracking-tight">{voteTitle}</h3>
        </CardHeader>

        <CardContent className="p-8 space-y-10">
          <div className="space-y-4">
            <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-primary flex items-center gap-2">
              <Trophy className="h-3 w-3" /> Projet Retenu
            </p>
            <div className="p-6 bg-primary/5 border border-primary/20">
              <p className="text-xl font-black uppercase leading-tight">{winnerLabel}</p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Users className="h-3 w-3" /> Participation
            </p>
            <p className="text-lg font-black">{results.totalBallots || results.total || 0} membres ont participé</p>
          </div>

          {topRanking && topRanking.length > 0 && (
            <div className="space-y-4 pt-4">
              <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground">Tête du classement</p>
              <div className="space-y-2">
                {topRanking.map((item: any, idx: number) => (
                  <div key={item.optionId || item.id || idx} className="flex items-center gap-4 text-sm py-1">
                    <span className={cn(
                      "w-6 h-6 flex items-center justify-center font-black text-[10px]",
                      (item.rank === 1 || item.score === 1) ? "bg-primary text-white" : "bg-secondary text-muted-foreground"
                    )}>
                      {item.rank || (idx + 1)}
                    </span>
                    <div className="flex-1 flex justify-between items-center gap-4 min-w-0">
                      <span className={cn("truncate", (item.rank === 1 || item.score === 1) ? "font-bold" : "text-muted-foreground")}>
                        {item.label}
                      </span>
                      {item.score !== undefined && (
                        <span className="text-[9px] font-mono text-muted-foreground/50 shrink-0">
                          {item.score} pts
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {renderDebug()}
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
