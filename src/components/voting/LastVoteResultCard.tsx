'use client';

import { useFirestore, useMemoFirebase, useCollection, useDoc } from '@/firebase';
import { collection, query, orderBy, limit, doc } from 'firebase/firestore';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Trophy, Users, BarChart3, ChevronRight, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Assembly, Project } from '@/types';
import { cn } from '@/lib/utils';
import { DEFAULT_ASSEMBLY_ID } from '@/config/assembly';

export function LastVoteResultCard() {
  const db = useFirestore();

  const publicResultRef = useMemoFirebase(() => {
    return doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'public', 'lastResult');
  }, [db]);
  
  const { data: results, isLoading: isPubLoading } = useDoc<any>(publicResultRef);

  const projectsQuery = useMemoFirebase(() => collection(db, 'projects'), [db]);
  const { data: projects } = useCollection<Project>(projectsQuery);

  if (isPubLoading) {
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

  if (!results) {
    return (
      <div className="p-8 border border-dashed border-border bg-secondary/5 text-center space-y-4 h-full flex flex-col justify-center">
        <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto opacity-20" />
        <p className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Aucun résultat publié</p>
      </div>
    );
  }

  const voteTitle = results.voteTitle || "Scrutin";
  const winnerLabel = results.winnerLabel || projects?.find(p => p.id === results.winnerId)?.title || "Projet retenu";
  const topRanking = results.fullRanking?.slice(0, 3) || [];
  const closedDate = results.closedAt?.seconds;

  return (
    <Card className="rounded-none border-border overflow-hidden bg-white hover:border-black transition-all group flex flex-col justify-between h-full min-h-[400px]">
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
            <p className="text-lg font-black">{results.totalBallots || 0} membres ont participé</p>
          </div>

          {topRanking.length > 0 && (
            <div className="space-y-4 pt-4">
              <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground">Top 3 classement</p>
              <div className="space-y-2">
                {topRanking.map((item: any, idx: number) => (
                  <div key={item.id} className="flex items-center justify-between text-sm py-1">
                    <span className="flex items-center gap-3">
                      <span className={cn(
                        "w-5 h-5 flex items-center justify-center font-black text-[9px]",
                        idx === 0 ? "bg-primary text-white" : "bg-secondary text-muted-foreground"
                      )}>
                        {idx + 1}
                      </span>
                      {projects?.find(p => p.id === item.id)?.title}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">{item.score} pts</span>
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