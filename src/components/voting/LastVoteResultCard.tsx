'use client';

import Link from 'next/link';
import Image from 'next/image';
import { doc, collection } from 'firebase/firestore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, Trophy } from 'lucide-react';

import { useFirestore, useMemoFirebase, useCollection, useDoc } from '@/firebase';
import { GlassCard } from '@/components/ui/glass-card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
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

  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }

  if (typeof value === 'number') {
    return value < 2_000_000_000 ? new Date(value * 1000) : new Date(value);
  }

  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

export function LastVoteResultCard() {
  const db = useFirestore();

  const publicResultRef = useMemoFirebase(() => {
    return doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'public', 'lastResult');
  }, [db]);

  const { data: results, isLoading: isPubLoading } = useDoc<PublicLastResult>(publicResultRef);

  const voteRef = useMemoFirebase(() => {
    const voteId = results?.voteId;
    if (!voteId) return null as any;
    return doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes', voteId);
  }, [db, results?.voteId]);

  const { data: voteDoc } = useDoc<VoteDoc>(voteRef);

  const projectsRef = useMemoFirebase(() => collection(db, 'projects'), [db]);
  const { data: projects } = useCollection<Project>(projectsRef);

  if (isPubLoading) {
    return (
      <GlassCard intensity="medium" className="h-full w-full p-4 md:p-5">
        <div className="space-y-4">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-10 w-full" />
        </div>
      </GlassCard>
    );
  }

  if (!results) {
    return (
      <GlassCard
        intensity="medium"
        className="flex h-full min-h-[260px] w-full items-center justify-center p-4 md:p-5"
      >
        <div className="space-y-3 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Dernier résultat
          </p>
          <p className="text-sm text-muted-foreground">Aucun résultat publié pour le moment.</p>
        </div>
      </GlassCard>
    );
  }

  const voteTitle = results.voteTitle || 'Scrutin';

  const winnerProject = projects?.find((p) => p.id === results.winnerId);

  const winnerLabel =
    results.winnerLabel ||
    winnerProject?.title ||
    'Projet retenu';

  const winnerImageUrl = winnerProject?.imageUrl;

  const closedDate =
    toDateMaybe(results.closedAt) ||
    toDateMaybe(voteDoc?.lockedAt) ||
    toDateMaybe(voteDoc?.closedAt) ||
    toDateMaybe(voteDoc?.updatedAt);

  const frozenTotal =
    (typeof results.totalBallots === 'number' ? results.totalBallots : null) ??
    (typeof voteDoc?.results?.totalBallots === 'number' ? voteDoc.results?.totalBallots : null) ??
    null;

  const ballotCount =
    frozenTotal ??
    (typeof voteDoc?.ballotCount === 'number' ? voteDoc.ballotCount : null) ??
    0;

  const eligibleCount =
    typeof voteDoc?.eligibleCountAtOpen === 'number' ? voteDoc.eligibleCountAtOpen : null;

  const hasRate = eligibleCount !== null && eligibleCount > 0;
  const participationRate = hasRate ? Math.round((100 * ballotCount) / eligibleCount) : null;

  return (
    <GlassCard intensity="medium" className="flex h-full min-h-[340px] w-full flex-col p-4 md:p-5">
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white/50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            <Trophy className="h-3.5 w-3.5" />
            Résultat
          </div>

          {closedDate ? (
            <div className="inline-flex items-center gap-1.5 rounded-full border border-black/5 bg-white/50 px-2.5 py-0.5 text-[11px] text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>{format(closedDate, 'dd MMM yyyy', { locale: fr })}</span>
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <p className="line-clamp-2 text-2xl font-bold leading-tight text-foreground md:text-3xl">
            {voteTitle}
          </p>
        </div>

        {winnerImageUrl ? (
          <div className="relative h-36 overflow-hidden rounded-2xl border border-white/60 bg-white/30">
            <Image
              src={winnerImageUrl}
              alt={winnerLabel}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/5 to-transparent" />
          </div>
        ) : (
          <div className="flex h-36 items-end rounded-2xl border border-white/60 bg-gradient-to-br from-primary/10 via-white/40 to-white/20 p-4">
            <p className="text-sm font-medium text-muted-foreground">Projet retenu</p>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Projet retenu
          </p>
          <p className="text-xl font-bold leading-tight text-foreground md:text-2xl">
            {winnerLabel}
          </p>
        </div>

        <div className="text-sm text-muted-foreground">
          {hasRate && participationRate !== null
            ? `${participationRate}% de participation`
            : `${ballotCount} bulletin${ballotCount > 1 ? 's' : ''} validé${ballotCount > 1 ? 's' : ''}`}
        </div>

        <div className="mt-auto pt-1">
          <Link href="/results">
            <Button
              variant="outline"
              className="h-11 w-full rounded-full text-xs font-semibold uppercase tracking-[0.18em]"
            >
              Voir les détails
            </Button>
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}

export default LastVoteResultCard;