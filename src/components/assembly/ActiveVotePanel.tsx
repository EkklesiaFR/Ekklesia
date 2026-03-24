'use client';

import Link from 'next/link';
import type { Assembly, Vote } from '@/types';

import { useVoteBallotCount } from '@/hooks/useVoteBallotCount';
import { useCountdown } from '@/hooks/useCountdown';

import { GlassCard } from '@/components/ui/glass-card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Clock, Layers, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActiveVotePanelProps {
  assembly: Assembly;
  vote: Vote;
}

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

  const projectCount =
    (Array.isArray((vote as any)?.projectIds) ? (vote as any).projectIds.length : undefined) ??
    (Array.isArray((vote as any)?.projects) ? (vote as any).projects.length : undefined) ??
    (typeof (vote as any)?.projectCount === 'number' ? (vote as any).projectCount : undefined) ??
    0;

  const eligibleCount = (vote as any)?.eligibleCountAtOpen as number | null | undefined;

  const hasEligible = typeof eligibleCount === 'number' && eligibleCount > 0;

  const participationPercent = hasEligible
    ? clamp(Math.round((100 * ballotCount) / eligibleCount!), 0, 100)
    : 0;

  const quorumReached = hasEligible ? participationPercent >= QUORUM_TARGET_PERCENT : false;

  const isManualClose = closesAt == null;

  return (
    <GlassCard intensity="medium" className="w-full p-4 md:p-5 flex flex-col h-full">
      <div className="flex flex-col gap-5 flex-grow">

        {/* HEADER */}
        <div className="flex items-start justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/70 bg-emerald-50/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Vote ouvert
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full border border-black/5 bg-white/50 px-2.5 py-0.5 text-[11px] text-muted-foreground">
            <Layers className="h-3.5 w-3.5" />
            {projectCount} projet{projectCount > 1 ? 's' : ''}
          </div>
        </div>

        {/* TITLE */}
        <div className="space-y-2">
          <p className="text-2xl md:text-3xl font-bold leading-tight text-foreground line-clamp-2">
            {vote.question}
          </p>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              {isManualClose ? 'Clôture manuelle' : `${timeLeft} restants`}
            </span>
          </div>
        </div>

        {/* PARTICIPATION (MAIN METRIC) */}
        <div className="space-y-3 pt-2">
          <div className="flex items-end gap-3">
            <p className="text-4xl md:text-5xl font-bold leading-none">
              {participationPercent}%
            </p>

            {hasEligible && (
              <span className="pb-1 text-sm text-muted-foreground">
                {ballotCount} / {eligibleCount}
              </span>
            )}
          </div>

          <Progress value={participationPercent} className="h-2 w-full" />
        </div>

        {/* QUORUM STATUS */}
        {!isLoading && hasEligible && (
          <div
            className={cn(
              'text-sm font-medium',
              quorumReached ? 'text-emerald-700' : 'text-rose-600'
            )}
          >
            {quorumReached ? (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Quorum atteint
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Quorum non atteint ({QUORUM_TARGET_PERCENT}% requis)
              </span>
            )}
          </div>
        )}

      </div>

      {/* CTA */}
      <div className="mt-5">
        <Link href="/vote">
          <Button className="w-full h-11 rounded-full text-xs font-semibold uppercase tracking-[0.18em]">
            Je vote
          </Button>
        </Link>
      </div>
    </GlassCard>
  );
}

export default ActiveVotePanel;