'use client';

import Link from 'next/link';
import { doc, collection } from 'firebase/firestore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Trophy, Users, BarChart3, ChevronRight, Calendar } from 'lucide-react';

import { useFirestore, useMemoFirebase, useCollection, useDoc } from '@/firebase';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { Project } from '@/types';
import { DEFAULT_ASSEMBLY_ID } from '@/config/assembly';

type PublicLastResult = {
  voteId?: string;
  voteTitle?: string;
  winnerId?: string;
  winnerLabel?: string;
  fullRanking?: Array<{ id: string; score?: number }>;
  closedAt?: { seconds?: number } | number | string | null;
  totalBallots?: number | null;
};

type VoteDoc = {
  ballotCount?: number | null;
  eligibleCountAtOpen?: number | null;
  results?: { totalBallots?: number | null } | null;
  lockedAt?: any;
  closedAt?: any;
  updatedAt?: any;
};

function toDateMaybe(value: any): Date | null {
  if (!value) return null;
  // Firestore Timestamp
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
  // number ms
  if (typeof value === 'number') {
    // heuristic: seconds vs ms
    return value < 2_000_000_000 ? new Date(value * 1000) : new Date(value);
  }
  // string
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function LastVoteResultCard() {
  const db = useFirestore();

  // ✅ Source officielle (public)
  const publicResultRef = useMemoFirebase(() => {
    return doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'public', 'lastResult');
  }, [db]);

  const { data: results, isLoading: isPubLoading } = useDoc<PublicLastResult>(publicResultRef);

  // ✅ Fallback “source de vérité technique” : vote doc (ballotCount / eligibleCountAtOpen)
  const voteRef = useMemoFirebase(() => {
    const voteId = results?.voteId;
    if (!voteId) return null as any;
    return doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes', voteId);
  }, [db, results?.voteId]);

  const { data: voteDoc } = useDoc<VoteDoc>(voteRef);

  // ✅ projets (pour labels)
  const projectsRef = useMemoFirebase(() => collection(db, 'projects'), [db]);
  const { data: projects } = useCollection<Project>(projectsRef);

  // ---------- Loading ----------
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

  // ---------- Empty ----------
  if (!results) {
    return (
      <div className="p-8 border border-dashed border-border bg-secondary/5 text-center space-y-4 h-full flex flex-col justify-center">
        <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto opacity-20" />
        <p className="text-xs uppercase font-bold tracking-widest text-muted-foreground">
          Aucun résultat publié
        </p>
      </div>
    );
  }

  // ---------- Derived data ----------
  const voteTitle = results.voteTitle || 'Scrutin';

  const winnerLabel =
    results.winnerLabel ||
    projects?.find((p) => p.id === results.winnerId)?.title ||
    'Projet retenu';

  const topRanking = results.fullRanking?.slice(0, 3) || [];

  // Date : on préfère results.closedAt, sinon voteDoc.*
  const closedDate =
    toDateMaybe(results.closedAt) ||
    toDateMaybe((voteDoc as any)?.lockedAt) ||
    toDateMaybe((voteDoc as any)?.closedAt) ||
    toDateMaybe((voteDoc as any)?.updatedAt);

  // Participation : priorité au PV (figé), sinon voteDoc (ballotCount / results.totalBallots)
  const frozenTotal =
    (typeof results.totalBallots === 'number' ? results.totalBallots : null) ??
    (typeof voteDoc?.results?.totalBallots === 'number' ? voteDoc?.results?.totalBallots : null) ??
    null;

  const ballotCount =
    frozenTotal ??
    (typeof voteDoc?.ballotCount === 'number' ? voteDoc.ballotCount : null) ??
    0;

  const eligibleCount =
    typeof voteDoc?.eligibleCountAtOpen === 'number' ? voteDoc.eligibleCountAtOpen : null;

  const hasRate = eligibleCount !== null && eligibleCount > 0;
  const participationRate = hasRate ? Math.round((100 * ballotCount) / eligibleCount!) : null;

  return (
    <Card className="rounded-none border-border overflow-hidden bg-white hover:border-black transition-all group flex flex-col justify-between h-full min-h-[420px]">
      <div>
        <CardHeader className="p-8 pb-6 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <Badge className="bg-[#7DC092] rounded-none uppercase font-bold text-[9px] tracking-widest">
              Dernier Procès-Verbal
            </Badge>

            {closedDate && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(closedDate, 'dd MMM yyyy', { locale: fr })}
              </span>
            )}
          </div>

          <h3 className="text-2xl font-bold tracking-tight">{voteTitle}</h3>
        </CardHeader>

        <CardContent className="p-8 space-y-10">
          {/* Projet retenu */}
          <div className="space-y-4">
            <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-primary flex items-center gap-2">
              <Trophy className="h-3 w-3" /> Projet retenu
            </p>
            <div className="p-6 bg-primary/5 border border-primary/20">
              <p className="text-xl font-black uppercase leading-tight">{winnerLabel}</p>
            </div>
          </div>

          {/* Participation (cohérente) */}
          <div className="space-y-4">
            <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Users className="h-3 w-3" /> Participation
            </p>

            {hasRate && participationRate !== null ? (
              <div className="flex items-baseline gap-4">
                <p className="text-3xl font-black">{participationRate}%</p>
                <p className="text-sm font-bold text-muted-foreground">
                  {ballotCount} / {eligibleCount} membres
                </p>
              </div>
            ) : (
              <p className="text-lg font-black">{ballotCount} bulletin(s) validé(s)</p>
            )}

            {/* micro-indication “figé vs live” */}
            {typeof results.totalBallots === 'number' ? (
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
                Chiffre figé (PV)
              </p>
            ) : (
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
                Chiffre depuis le vote
              </p>
            )}
          </div>

          {/* Top 3 */}
          {topRanking.length > 0 && (
            <div className="space-y-4 pt-4">
              <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground">
                Top 3 classement
              </p>

              <div className="space-y-2">
                {topRanking.map((item: any, idx: number) => {
                  const title = projects?.find((p) => p.id === item.id)?.title ?? item.id;
                  const score = typeof item.score === 'number' ? item.score : null;

                  return (
                    <div key={item.id} className="flex items-center justify-between text-sm py-1">
                      <span className="flex items-center gap-3">
                        <span
                          className={cn(
                            'w-5 h-5 flex items-center justify-center font-black text-[9px]',
                            idx === 0 ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'
                          )}
                        >
                          {idx + 1}
                        </span>
                        {title}
                      </span>

                      {score !== null ? (
                        <span className="text-[10px] font-mono text-muted-foreground">{score} pts</span>
                      ) : (
                        <span className="text-[10px] font-mono text-muted-foreground">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </div>

      <CardFooter className="p-8 pt-0">
        <Link href="/results" className="w-full">
          <Button
            variant="outline"
            className="w-full rounded-none h-12 text-xs uppercase font-bold tracking-widest gap-2"
          >
            Consulter les détails <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}