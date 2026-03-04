'use client';

import Link from 'next/link';
import type { Assembly, Vote } from '@/types';

import { useVoteBallotCount } from '@/hooks/useVoteBallotCount';
import { useCountdown } from '@/hooks/useCountdown';

import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Clock, Users, CheckCircle2, XCircle, Layers } from 'lucide-react';

interface ActiveVotePanelProps {
  assembly: Assembly;
  vote: Vote;
}

/**
 * Quorum target (en %) — on peut le rendre configurable plus tard.
 * (On avait parlé de 60% pour Ekklesia)
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

  // Assembly label safe
  // On privilégie "name" (souvent le bon), puis title/label
  const assemblyLabel =
    (assembly as any)?.name ??
    (assembly as any)?.title ??
    (assembly as any)?.label ??
    'Assemblée';

  // Eligible voters (quorum base)
  const eligibleCount = (vote as any)?.eligibleCountAtOpen as number | null | undefined;

  const hasEligible = typeof eligibleCount === 'number' && eligibleCount > 0;

  const participationPercent = hasEligible
    ? clamp(Math.round((100 * ballotCount) / eligibleCount!), 0, 100)
    : 0;

  const quorumReached = hasEligible ? participationPercent >= QUORUM_TARGET_PERCENT : false;

  // Projects count (best effort)
  const projectCount =
    (Array.isArray((vote as any)?.projectIds) ? (vote as any).projectIds.length : undefined) ??
    (Array.isArray((vote as any)?.projects) ? (vote as any).projects.length : undefined) ??
    (typeof (vote as any)?.projectCount === 'number' ? (vote as any).projectCount : undefined) ??
    0;

  const isManualClose = closesAt == null;

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

          <h3 className="text-3xl font-bold tracking-tight text-black leading-tight">
            {vote.question}
          </h3>

          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
            <Clock className="h-4 w-4" />
            <span>
              {isManualClose ? 'Clôture : manuelle' : `Temps restant : ${timeLeft}`}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Layers className="h-4 w-4" />
            <span>{projectCount} projet{projectCount > 1 ? 's' : ''}</span>
          </div>
        </header>

        {/* PARTICIPATION */}
        <div className="space-y-4 pt-4 border-t border-border/60">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Participation
            </h4>
            {!isLoading && hasEligible && (
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>
                  {ballotCount} / {eligibleCount} membres
                </span>
              </div>
            )}
          </div>

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
                <p className="text-4xl font-black">{participationPercent}%</p>
                <p className="text-sm font-bold text-muted-foreground">
                  {ballotCount} / {eligibleCount} membres
                </p>
              </div>
              <Progress value={participationPercent} className="h-2 w-full" />
            </>
          )}
        </div>

        {/* QUORUM */}
        <div className="space-y-3 pt-4 border-t border-border/60">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Quorum
            </h4>

            {!isLoading && hasEligible && (
              <div
                className={[
                  'flex items-center gap-2 text-xs font-bold uppercase tracking-widest',
                  quorumReached ? 'text-green-700' : 'text-amber-700',
                ].join(' ')}
              >
                {quorumReached ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <span>{quorumReached ? 'validé' : 'non validé'}</span>
              </div>
            )}
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : !hasEligible ? (
            <p className="text-sm text-muted-foreground">
              En attente du suffrage défini.
            </p>
          ) : (
            <div className="flex items-baseline justify-between">
              <p className="text-sm text-muted-foreground">
                Seuil : <span className="font-bold">{QUORUM_TARGET_PERCENT}%</span>
              </p>
              <p className="text-sm font-bold text-muted-foreground">
                Atteint : <span className="text-black">{participationPercent}%</span>
              </p>
            </div>
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