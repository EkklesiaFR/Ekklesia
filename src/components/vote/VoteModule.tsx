'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@/firebase';
import { useAuthStatus } from '@/components/auth/AuthStatusProvider';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { GlassCard } from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

import {
  CheckCircle2,
  Info,
  Loader2,
  Lock,
  BarChart3,
  PieChart,
} from 'lucide-react';

import type { Project, Vote, Ballot } from '@/types';
import { RankedList } from '@/components/voting/RankedList';
import { AdminTrendsPanel } from '@/components/voting/AdminTrendsPanel';

import { useVoteBallotCount } from '@/hooks/useVoteBallotCount';
import { useCountdown } from '@/hooks/useCountdown';

interface VoteModuleProps {
  vote: Vote;
  projects: Project[];
  userBallot: Ballot | null;
  assemblyId: string;
}

function ParticipationPanel({
  ballotCount,
  eligibleCount,
  closesAt,
  isLoading,
}: {
  ballotCount: number;
  eligibleCount?: number;
  closesAt?: any;
  isLoading?: boolean;
}) {
  const timeLeft = useCountdown(closesAt ?? null);
  const isManualClose = closesAt == null;

  if (isLoading) {
    return (
      <GlassCard intensity="soft" className="p-5">
        <p className="text-sm text-muted-foreground">Calcul de la participation…</p>
      </GlassCard>
    );
  }

  if (eligibleCount === undefined || eligibleCount === null) {
    return (
      <GlassCard intensity="soft" className="p-5">
        <div className="space-y-3">
          <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            <PieChart className="h-3.5 w-3.5 text-primary" />
            Participation
          </p>

          <p className="text-sm text-muted-foreground">Calcul du quorum…</p>

          <p className="pt-1 text-[11px] font-medium text-muted-foreground/80">
            {isManualClose ? 'Clôture manuelle' : `Clôture dans ${timeLeft}`}
          </p>
        </div>
      </GlassCard>
    );
  }

  if (eligibleCount === 0) {
    return (
      <GlassCard intensity="soft" className="p-5">
        <div className="space-y-3">
          <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            <PieChart className="h-3.5 w-3.5 text-primary" />
            Participation
          </p>

          <p className="text-sm text-muted-foreground">Aucun membre éligible.</p>

          <p className="pt-1 text-[11px] font-medium text-muted-foreground/80">
            {isManualClose ? 'Clôture manuelle' : `Clôture dans ${timeLeft}`}
          </p>
        </div>
      </GlassCard>
    );
  }

  const voters = ballotCount;
  const participationRate = Math.round((voters / eligibleCount) * 100);
  const abstentionCount = Math.max(0, eligibleCount - voters);

  return (
    <GlassCard intensity="soft" className="p-5 md:p-6">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              <PieChart className="h-3.5 w-3.5 text-primary" />
              Participation
            </p>

            <p className="text-sm text-muted-foreground">
              {voters} / {eligibleCount} membres
            </p>
          </div>

          <p className="text-4xl font-bold leading-none tracking-tight text-foreground">
            {participationRate}%
          </p>
        </div>

        <Progress value={participationRate} className="h-2 w-full bg-black/5" />

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/60 bg-white/40 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Votants
            </p>
            <p className="mt-2 text-2xl font-semibold leading-none text-foreground">{voters}</p>
          </div>

          <div className="rounded-2xl border border-white/60 bg-white/40 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Abstention
            </p>
            <p className="mt-2 text-2xl font-semibold leading-none text-foreground">
              {abstentionCount}
            </p>
          </div>
        </div>

        <div className="border-t border-white/40 pt-3">
          <p className="text-[11px] font-medium text-muted-foreground/80">
            {isManualClose ? 'Clôture manuelle' : `Clôture dans ${timeLeft}`}
          </p>
        </div>
      </div>
    </GlassCard>
  );
}

export function VoteModule({ vote, projects, userBallot, assemblyId }: VoteModuleProps) {
  const { user } = useUser();
  const { isAdmin, isMemberLoading } = useAuthStatus();

  const [currentRanking, setCurrentRanking] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const frozenCount =
    (vote as any)?.results?.totalBallots ?? (vote as any)?.results?.total ?? undefined;

  const { count: ballotCount, isLoading: isBallotCountLoading } = useVoteBallotCount({
    assemblyId,
    voteId: vote.id,
    status: vote.state,
    frozenCount,
    mode: 'realtime',
  });

  const closesAt =
    (vote as any)?.closesAt ?? (vote as any)?.endsAt ?? (vote as any)?.closedAt ?? null;

  useEffect(() => {
    if (userBallot?.ranking) {
      setCurrentRanking(userBallot.ranking);
    } else if (projects.length > 0 && currentRanking.length === 0) {
      setCurrentRanking(projects.map((p) => p.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userBallot, projects]);

  const handleVoteSubmit = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
      const idToken = await user.getIdToken();

      const res = await fetch(`/api/assemblies/${assemblyId}/votes/${vote.id}/ballots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ ranking: currentRanking }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const msg = payload?.error || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      toast({
        title: 'Vote enregistré',
        description: 'Votre classement a été pris en compte.',
      });
    } catch (e: any) {
      console.error('[VOTE] API submit error:', e?.message || e);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: e?.message
          ? `Impossible de sauvegarder votre vote : ${e.message}`
          : 'Impossible de sauvegarder votre vote.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const sortedProjects = useMemo(() => {
    return currentRanking
      .map((id) => projects.find((p) => p.id === id))
      .filter((p): p is Project => !!p);
  }, [currentRanking, projects]);

  const canShowAdminTrends = !isMemberLoading && isAdmin === true && vote.state === 'open';

  return (
    <div className="grid animate-in grid-cols-1 gap-6 fade-in slide-in-from-bottom-4 duration-700 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,420px)]">
      <div className="space-y-6">
        <GlassCard intensity="medium" className="p-5 md:p-6">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                Scrutin direct
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                {vote.question}
              </h1>

              <div className="flex items-start gap-2 rounded-2xl border border-white/60 bg-white/40 p-3 text-sm text-muted-foreground">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Classez les projets par ordre de préférence. Vous pouvez modifier votre vote
                  jusqu&apos;à la clôture.
                </p>
              </div>
            </div>

            <div>
              {vote.state === 'open' ? (
                <RankedList projects={sortedProjects} onOrderChange={setCurrentRanking} />
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-secondary/5 p-10 text-center">
                  <Lock className="mx-auto h-8 w-8 text-muted-foreground/40" />
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Les votes ne sont pas ouverts
                  </p>
                </div>
              )}
            </div>

            {vote.state === 'open' && (
              <div className="space-y-4 pt-2">
                <Button
                  className="h-12 w-full rounded-full text-xs font-semibold uppercase tracking-[0.18em]"
                  onClick={handleVoteSubmit}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enregistrement…
                    </>
                  ) : userBallot ? (
                    'Mettre à jour mon vote'
                  ) : (
                    'Valider mon classement'
                  )}
                </Button>

                {userBallot && (
                  <div className="flex items-center gap-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4 text-sm font-medium text-emerald-700">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>Votre vote est déjà enregistré.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      <aside className="space-y-4">
        {vote.state === 'draft' ? (
          <GlassCard intensity="soft" className="p-6 text-center">
            <Lock className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Scrutin en attente
            </p>
          </GlassCard>
        ) : vote.state === 'open' ? (
          <div className="space-y-4">
            <ParticipationPanel
              ballotCount={ballotCount}
              eligibleCount={vote.eligibleCountAtOpen}
              closesAt={closesAt}
              isLoading={isBallotCountLoading}
            />

            {canShowAdminTrends && (
              <GlassCard intensity="soft" className="p-4">
                <AdminTrendsPanel assemblyId={assemblyId} voteId={vote.id} />
              </GlassCard>
            )}
          </div>
        ) : (
          <GlassCard intensity="soft" className="p-5">
            <div className="space-y-4">
              <p className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                <BarChart3 className="h-3.5 w-3.5 text-primary" />
                Résultat final
              </p>

              <div className="space-y-3">
                {vote.results?.fullRanking ? (
                  vote.results.fullRanking.map((rankInfo) => (
                    <div
                      key={rankInfo.id}
                      className={cn(
                        'flex items-center gap-4 rounded-2xl border p-4',
                        rankInfo.rank === 1
                          ? 'border-primary/30 bg-primary/10'
                          : 'border-white/60 bg-white/40'
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold',
                          rankInfo.rank === 1
                            ? 'bg-primary text-white'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        #{rankInfo.rank}
                      </div>

                      <div className="text-sm font-semibold text-foreground">
                        {projects.find((p) => p.id === rankInfo.id)?.title}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Résultats en cours de publication…
                  </p>
                )}
              </div>
            </div>
          </GlassCard>
        )}
      </aside>
    </div>
  );
}

export default VoteModule;