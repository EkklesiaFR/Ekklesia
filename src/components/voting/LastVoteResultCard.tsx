
'use client';

import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Trophy, Users, BarChart3, ChevronRight, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/skeleton';
import Link from 'next/link';
import { useEffect } from 'react';

interface PublicResultDoc {
  voteId: string;
  voteTitle: string;
  closedAt: any;
  winnerId: string;
  winnerLabel: string;
  totalBallots: number;
  ranking: {
    optionId: string;
    label: string;
    rank: number;
  }[];
}

interface LastVoteResultCardProps {
  assemblyId: string;
}

export function LastVoteResultCard({ assemblyId }: LastVoteResultCardProps) {
  const db = useFirestore();
  const resultRef = useMemoFirebase(() => doc(db, 'assemblies', assemblyId, 'public', 'lastResult'), [db, assemblyId]);
  const { data: result, isLoading, error } = useDoc<PublicResultDoc>(resultRef);

  useEffect(() => {
    if (assemblyId) {
      console.log("[DASH] reading lastResult", { 
        assemblyId, 
        path: `assemblies/${assemblyId}/public/lastResult`,
        exists: !!result,
        isLoading
      });
    }
  }, [assemblyId, result, isLoading]);

  if (isLoading) {
    return (
      <Card className="rounded-none border-border overflow-hidden bg-white">
        <CardHeader className="p-8 pb-4">
          <Skeleton className="h-4 w-24 mb-4" />
          <Skeleton className="h-8 w-3/4" />
        </CardHeader>
        <CardContent className="p-8 pt-0 space-y-6">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!result) {
    return (
      <div className="p-8 border border-dashed border-border bg-secondary/5 text-center space-y-4">
        <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto opacity-20" />
        <p className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Aucun résultat publié</p>
        {error && <p className="text-[8px] text-destructive">Erreur : {error.message}</p>}
      </div>
    );
  }

  return (
    <Card className="rounded-none border-border overflow-hidden bg-white hover:border-black transition-all group flex flex-col justify-between h-full">
      <div>
        <CardHeader className="p-8 pb-6 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <Badge className="bg-[#7DC092] rounded-none uppercase font-bold text-[9px] tracking-widest">Résultats Officiels</Badge>
            {result.closedAt?.seconds && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(result.closedAt.seconds * 1000), 'dd MMM yyyy', { locale: fr })}
              </span>
            )}
          </div>
          <h3 className="text-2xl font-bold tracking-tight">{result.voteTitle}</h3>
        </CardHeader>

        <CardContent className="p-8 space-y-10">
          <div className="space-y-4">
            <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-primary flex items-center gap-2">
              <Trophy className="h-3 w-3" /> Projet Élu
            </p>
            <div className="p-6 bg-primary/5 border border-primary/20">
              <p className="text-xl font-black uppercase leading-tight">{result.winnerLabel}</p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Users className="h-3 w-3" /> Participation
            </p>
            <p className="text-lg font-black">{result.totalBallots} membres ont voté</p>
          </div>

          <div className="space-y-4 pt-4">
            <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground">Top Classement</p>
            <div className="space-y-2">
              {result.ranking.slice(0, 3).map((item) => (
                <div key={item.optionId} className="flex items-center gap-4 text-sm py-1">
                  <span className="w-6 h-6 flex items-center justify-center bg-secondary font-black text-[10px]">{item.rank}</span>
                  <span className={item.rank === 1 ? "font-bold" : "text-muted-foreground"}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
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
