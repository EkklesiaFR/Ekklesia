'use client';

import Link from 'next/link';
import type { Assembly, Vote } from '@/types';

import { useVoteBallotCount } from '@/hooks/useVoteBallotCount';
import { useCountdown } from '@/hooks/useCountdown';

import { GlassCard } from '@/components/ui/glass-card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Clock3, Users, CheckCircle2, XCircle, Layers3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActiveVotePanelProps {
  assembly: Assembly;
  vote: Vote;
}

/**
 * Quorum target (en %) — on peut le rendre configurable plus tard.
 */
const QUORUM_TARGET_PERCENT = 60;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function ActiveVotePanel({ assembly, vote }: ActiveVotePanelProps) {
  const { count: ballotCount, isLoading } = useVoteBallotCount({
    assemblyId: assembly.id,
    voteId: vote.id,
    status: vote.state,
    mode: 'realtime',
  });

  const closesAt =
    (vote as any)?.closesAt ??
    (vote as any)?.endsAt ??
    (vote as any)?.closedAt ??
    null;

  const timeLeft = useCountdown(closesAt);

  const eligibleCount = (vote as any)?.eligibleCountAtOpen as number | null | undefined;
  const hasEligible = typeof eligibleCount === 'number' && eligibleCount > 0;

  const participationPercent = hasEligible
    ? clamp(Math.round((100 * ballotCount) / eligibleCount), 0, 100)
    : 0;

  const quorumReached = hasEligible ? participationPercent >= QUORUM_TARGET_PERCENT : false;

  const projectCount =
    (Array.isArray((vote as any)?.projectIds) ? (vote as any).projectIds.length : undefined) ??
    (Array.isArray((vote as any)?.projects) ? (vote as any).projects.length : undefined) ??
    (typeof (vote as any)?.projectCount === 'number' ? (vote as any).projectCount : undefined) ??
    0;

  const isManualClose = closesAt == null;

  return (
    <GlassCard intensity="medium" className="h-full w-full p-4 md:p-5">
      <div className="flex h-full flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Vote ouvert
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full border border-black/5 bg-white/50 px-2.5 py-0.5 text-[11px] text-muted-foreground">
            <Layers3 className="h-3.5 w-3.5" />
            <span>
              {projectCount} projet{projectCount > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <p className="line-clamp-3 text-2xl font-bold leading-tight text-foreground md:text-3xl">
            {vote.question}
          </p>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock3 className="h-4 w-4 shrink-0" />
            <span>{isManualClose ? 'Clôture manuelle' : `${timeLeft} restants`}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/60 bg-white/40 p-3 backdrop-blur-md">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Participation
            </p>

            {isLoading ? (
              <p className="mt-2 text-sm text-muted-foreground">Chargement…</p>
            ) : eligibleCount == null ? (
              <p className="mt-2 text-sm text-muted-foreground">En calcul…</p>
            ) : eligibleCount === 0 ? (
              <p className="mt-2 text-sm text-amber-600">Aucun éligible</p>
            ) : (
              <>
                <div className="mt-2 flex items-end gap-2">
                  <p className="text-3xl font-bold leading-none text-foreground">
                    {participationPercent}%
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ballotCount} / {eligibleCount} membres
                </p>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-white/60 bg-white/40 p-3 backdrop-blur-md">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Quorum
              </p>

              {!isLoading && hasEligible ? (
                quorumReached ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-amber-600" />
                )
              ) : null}
            </div>

            {isLoading ? (
              <p className="mt-2 text-sm text-muted-foreground">Chargement…</p>
            ) : !hasEligible ? (
              <p className="mt-2 text-sm text-muted-foreground">En attente</p>
            ) : (
              <>
                <div className="mt-2 flex items-end gap-2">
                  <p
                    className={cn(
                      'text-3xl font-bold leading-none',
                      quorumReached ? 'text-emerald-700' : 'text-foreground'
                    )}
                  >
                    {participationPercent}%
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  seuil requis : {QUORUM_TARGET_PERCENT}%
                </p>
              </>
            )}
          </div>
        </div>

        {!isLoading && hasEligible && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {ballotCount} bulletin{ballotCount > 1 ? 's' : ''}
              </span>
              <span>{participationPercent}%</span>
            </div>

            <Progress value={participationPercent} className="h-2 w-full bg-black/5" />
          </div>
        )}

        <div className="mt-auto pt-1">
          <Link href="/vote">
            <Button className="h-11 w-full rounded-full text-xs font-semibold uppercase tracking-[0.18em]">
              Je vote
            </Button>
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}

export default ActiveVotePanel;