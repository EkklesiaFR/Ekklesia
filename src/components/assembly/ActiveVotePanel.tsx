'use client';

import Link from 'next/link';
import type { Assembly, Vote } from '@/types';

import { useVoteBallotCount } from '@/hooks/useVoteBallotCount';
import { useCountdown } from '@/hooks/useCountdown';

import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';

interface ActiveVotePanelProps {
  assembly: Assembly;
  vote: Vote;
}

export function ActiveVotePanel({ assembly, vote }: ActiveVotePanelProps) {
  const { count: ballotCount, isLoading } = useVoteBallotCount({
    assemblyId: assembly.id,
    voteId: vote.id,
    status: vote.state,
    mode: 'realtime',
  });

  const closesAt =
    (vote as any).closesAt ?? (vote as any).endsAt ?? (vote as any).closedAt ?? null;

  const timeLeft = useCountdown(closesAt);

  const eligibleCount = (vote as any).eligibleCountAtOpen as number | null | undefined;
  const participationRate =
    eligibleCount && eligibleCount > 0 ? Math.round((100 * ballotCount) / eligibleCount) : 0;

  // Assembly label safe (selon ton schéma de données)
  const assemblyLabel =
    (assembly as any).title ?? (assembly as any).name ?? (assembly as any).label ?? 'Assemblée';

  return (
    <div className="p-8 border bg-primary/15 ring-1 ring-primary/10 shadow-sm h-full flex flex-col">
      <div className="flex-grow space-y-8">
        <header className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              Vote en cours
            </p>
          </div>

          {/* Assemblée en contexte (petit) */}
          <p className="text-[11px] uppercase tracking-widest font-bold text-muted-foreground">
            {assemblyLabel}
          </p>

          {/* Titre principal = question du vote */}
          <h3 className="text-3xl font-bold tracking-tight text-black leading-tight">
            {vote.question}
          </h3>

          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
            <Clock className="h-4 w-4" />
            <span>Clôture : {timeLeft}</span>
          </div>
        </header>

        <div className="space-y-4 pt-4 border-t border-border/60">
          <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Participation
          </h4>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : eligibleCount == null ? (
            <p className="text-sm text-muted-foreground">
              Quorum en calcul… ({ballotCount} bulletins)
            </p>
          ) : eligibleCount === 0 ? (
            <p className="text-sm font-semibold text-amber-600">
              Aucun membre éligible pour ce scrutin.
            </p>
          ) : (
            <>
              <div className="flex items-baseline gap-4">
                <p className="text-4xl font-black">{participationRate}%</p>
                <p className="text-sm font-bold text-muted-foreground">
                  {ballotCount} / {eligibleCount} membres
                </p>
              </div>
              <Progress value={participationRate} className="h-2 w-full" />
            </>
          )}
        </div>
      </div>

      <div className="mt-10">
        <Link href="/vote">
          <Button className="w-full h-14 rounded-none uppercase font-bold text-xs tracking-widest">
            Je vote
          </Button>
        </Link>
      </div>
    </div>
  );
}