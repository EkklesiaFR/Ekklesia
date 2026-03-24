'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { DEFAULT_ASSEMBLY_ID } from '@/config/assembly';

import { collection, query, limit, where, doc } from 'firebase/firestore';
import type { Vote, Project } from '@/types';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/glass-card';
import { ChevronRight, Trophy, Copy, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

function formatFr(ts: any): string {
  if (!ts) return '—';
  try {
    const d = ts?.toDate ? ts.toDate() : null;
    if (!d) return '—';
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function CopyRow({ label, value }: { label: string; value?: string | null }) {
  const v = (value ?? '').trim();
  const canCopy = !!v && typeof navigator !== 'undefined' && !!navigator.clipboard;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(v);
      toast({ title: 'Copié', description: `${label} copié dans le presse-papier.` });
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de copier.',
      });
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/40 px-4 py-3 backdrop-blur-sm">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        <p className="break-all font-mono text-xs text-foreground">{v || '—'}</p>
      </div>

      <Button
        variant="outline"
        size="sm"
        disabled={!canCopy}
        onClick={onCopy}
        className="h-9 rounded-full border-white/60 bg-white/50 px-3 backdrop-blur-sm"
        title={canCopy ? `Copier ${label}` : 'Rien à copier'}
      >
        <Copy className="mr-2 h-4 w-4" />
        Copier
      </Button>
    </div>
  );
}

function ResultsContent() {
  const db = useFirestore();
  const [selectedVoteId, setSelectedVoteId] = useState<string | null>(null);

  const lastResultRef = useMemoFirebase(
    () => doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'public', 'lastResult'),
    [db]
  );
  const { data: lastResult } = useDoc<any>(lastResultRef);

  const votesQuery = useMemoFirebase(
    () =>
      query(
        collection(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes'),
        where('state', '==', 'locked'),
        limit(50)
      ),
    [db]
  );
  const { data: votes, isLoading: isVotesLoading } = useCollection<Vote>(votesQuery);

  const projectsQuery = useMemoFirebase(() => query(collection(db, 'projects'), limit(200)), [db]);
  const { data: projects } = useCollection<Project>(projectsQuery);

  const projectsById = useMemo(
    () => new Map((projects ?? []).map((p) => [p.id, p])),
    [projects]
  );

  const sortedVotes = useMemo(() => {
    const list = votes ?? [];
    return [...list].sort((a, b) => {
      const da =
        (a.results as any)?.computedAt?.toMillis?.() ??
        (a as any)?.lockedAt?.toMillis?.() ??
        (a as any)?.updatedAt?.toMillis?.() ??
        0;

      const dbb =
        (b.results as any)?.computedAt?.toMillis?.() ??
        (b as any)?.lockedAt?.toMillis?.() ??
        (b as any)?.updatedAt?.toMillis?.() ??
        0;

      return dbb - da;
    });
  }, [votes]);

  if (isVotesLoading) {
    return (
      <div className="py-24 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        Chargement des archives…
      </div>
    );
  }

  const latestVote = sortedVotes[0] ?? null;
  const lastVoteId = lastResult?.voteId ? String(lastResult.voteId) : latestVote?.id ?? null;
  const lastWinnerLabel =
    lastResult?.winnerLabel ??
    (latestVote?.results?.winnerId
      ? projectsById.get(String(latestVote.results.winnerId))?.title ??
        String(latestVote.results.winnerId)
      : null);
  const lastVoteTitle = lastResult?.voteTitle ?? latestVote?.question ?? null;
  const lastClosedAt =
    formatFr(lastResult?.closedAt) !== '—'
      ? formatFr(lastResult?.closedAt)
      : formatFr((latestVote as any)?.lockedAt);
  const lastTotal = lastResult?.total ?? ((latestVote?.results as any)?.total ?? '—');

  return (
    <div className="animate-in fade-in space-y-10 duration-700 md:space-y-12">
      <header className="space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Archives
        </p>

        <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
          Les décisions de l’assemblée
        </h1>

        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
          Retrouvez les scrutins clôturés, leurs résultats, et les procès-verbaux associés.
        </p>
      </header>

      <GlassCard intensity="medium" className="p-6 md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground">
                Dernière décision
              </Badge>

              {lastVoteId ? (
                <Badge className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                  PV disponible
                </Badge>
              ) : null}
            </div>

            <div className="space-y-2">
              <h2 className="max-w-3xl text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                {lastVoteTitle ?? '—'}
              </h2>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-medium text-muted-foreground">
                <span>Clôture : {lastClosedAt}</span>
                <span>Bulletins : {lastTotal}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Trophy className="h-5 w-5" />
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Vainqueur
                </p>
                <p className="text-base font-semibold text-foreground">
                  {lastWinnerLabel ?? '—'}
                </p>
              </div>
            </div>
          </div>

          <div className="md:self-center">
            {lastVoteId ? (
              <Link href={`/results/${lastVoteId}`}>
                <Button className="h-11 rounded-full px-6 text-sm font-semibold">
                  Voir le procès-verbal
                </Button>
              </Link>
            ) : (
              <Button disabled className="h-11 rounded-full px-6 text-sm font-semibold">
                Voir le procès-verbal
              </Button>
            )}
          </div>
        </div>
      </GlassCard>

      {sortedVotes.length > 0 ? (
        <div className="space-y-4">
          {sortedVotes.map((vote) => {
            const isSelected = selectedVoteId === vote.id;

            const totalBallots =
              (vote.results as any)?.total ?? (vote.results as any)?.totalBallots ?? 0;
            const eligible = vote.eligibleCountAtOpen ?? null;
            const participationPct =
              eligible && eligible > 0 ? Math.round((100 * totalBallots) / eligible) : null;

            const winnerId = vote.results?.winnerId ?? null;
            const winner = winnerId ? projectsById.get(String(winnerId)) : null;

            const computedAtFormatted = formatFr((vote.results as any)?.computedAt);
            const lockedAtFormatted = formatFr((vote as any)?.lockedAt);

            const method = (vote.results as any)?.method ?? '—';
            const computedBy = (vote.results as any)?.computedBy ?? '—';
            const resultsHash = (vote.results as any)?.resultsHash ?? null;
            const isSealed = !!resultsHash;

            const top5 = (vote.results?.fullRanking ?? []).slice(0, 5);

            return (
              <GlassCard
                key={vote.id}
                intensity="soft"
                className={cn(
                  'overflow-hidden transition-all duration-300',
                  isSelected && 'ring-1 ring-primary/20'
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelectedVoteId(isSelected ? null : vote.id)}
                  className="w-full p-6 text-left md:p-8"
                >
                  <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground">
                          Scrutin archivé
                        </Badge>

                        {isSealed && (
                          <Badge className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Résultat scellé
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-2xl font-bold leading-tight tracking-tight text-foreground">
                          {vote.question}
                        </h3>

                        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-medium text-muted-foreground">
                          <span>PV : {computedAtFormatted}</span>
                          <span>Clôture : {lockedAtFormatted}</span>
                          <span>Bulletins : {totalBallots}</span>
                          <span>
                            Participation :{' '}
                            {participationPct !== null ? `${participationPct}%` : '—'}
                          </span>
                          <span>Méthode : {method}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-6 md:justify-end">
                      <div className="text-right">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          Vainqueur
                        </p>
                        <p className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
                          <Trophy className="h-4 w-4" />
                          {winner?.title ?? (winnerId ? String(winnerId) : '—')}
                        </p>
                      </div>

                      <ChevronRight
                        className={cn(
                          'h-5 w-5 text-muted-foreground transition-transform duration-300',
                          isSelected && 'rotate-90'
                        )}
                      />
                    </div>
                  </div>
                </button>

                {isSelected && vote.results && (
                  <div className="border-t border-white/40 px-6 pb-8 pt-6 md:px-8">
                    <div className="space-y-8">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="rounded-[24px] border border-white/60 bg-white/40 p-5 backdrop-blur-sm">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Bulletins
                          </p>
                          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                            {totalBallots}
                          </p>
                        </div>

                        <div className="rounded-[24px] border border-white/60 bg-white/40 p-5 backdrop-blur-sm">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Participation
                          </p>
                          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                            {participationPct !== null ? `${participationPct}%` : '—'}
                          </p>
                        </div>

                        <div className="rounded-[24px] border border-primary/20 bg-primary/10 p-5 backdrop-blur-sm">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                            Résultat
                          </p>
                          <p className="mt-2 text-lg font-semibold leading-tight text-primary">
                            {winner?.title ?? (winnerId ? String(winnerId) : '—')}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <h4 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground">
                            Intégrité
                          </h4>

                          <Badge
                            className={cn(
                              'rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]',
                              isSealed
                                ? 'border border-primary/20 bg-primary/10 text-primary'
                                : 'border border-white/60 bg-white/60 text-muted-foreground'
                            )}
                          >
                            {isSealed ? 'Scellé (hash)' : 'Non scellé'}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <div className="rounded-2xl border border-white/60 bg-white/40 px-4 py-3 backdrop-blur-sm">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                              computedBy
                            </p>
                            <p className="break-all font-mono text-xs text-foreground">
                              {computedBy}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-white/60 bg-white/40 px-4 py-3 backdrop-blur-sm">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                              lockedAt
                            </p>
                            <p className="font-mono text-xs text-foreground">
                              {lockedAtFormatted}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-white/60 bg-white/40 px-4 py-3 backdrop-blur-sm">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                              method
                            </p>
                            <p className="font-mono text-xs text-foreground">{method}</p>
                          </div>

                          <CopyRow label="resultsHash" value={resultsHash} />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                          <h4 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground">
                            Classement (top 5)
                          </h4>

                          <Link href={`/results/${vote.id}`}>
                            <Button
                              variant="outline"
                              className="h-10 rounded-full border-white/60 bg-white/50 px-5 text-sm font-semibold backdrop-blur-sm"
                            >
                              Voir le PV
                            </Button>
                          </Link>
                        </div>

                        <div className="space-y-3">
                          {top5.map((r: any, idx: number) => (
                            <div
                              key={r.id}
                              className={cn(
                                'flex items-center justify-between gap-4 rounded-[24px] border p-4 backdrop-blur-sm',
                                idx === 0
                                  ? 'border-primary/20 bg-primary/5'
                                  : 'border-white/60 bg-white/40'
                              )}
                            >
                              <div className="flex min-w-0 items-center gap-4">
                                <div
                                  className={cn(
                                    'flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-bold',
                                    idx === 0
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-secondary text-muted-foreground'
                                  )}
                                >
                                  #{idx + 1}
                                </div>

                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-foreground">
                                    {projectsById.get(r.id)?.title ?? r.id}
                                  </p>
                                  <p className="truncate font-mono text-[11px] text-muted-foreground">
                                    {r.id}
                                  </p>
                                </div>
                              </div>

                              <div className="shrink-0 text-right">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                  Score
                                </p>
                                <p className="font-mono text-xs text-foreground">
                                  {r.score ?? r.rank ?? '—'}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>

                        {((vote.results?.fullRanking ?? []).length ?? 0) > 5 && (
                          <p className="text-sm text-muted-foreground">
                            Voir le procès-verbal pour le classement complet.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      ) : (
        <GlassCard intensity="soft" className="p-12 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Aucun résultat publié
          </p>
        </GlassCard>
      )}
    </div>
  );
}

export default function ResultsPage() {
  return (
    <RequireActiveMember>
      <MainLayout statusText="Archives">
        <ResultsContent />
      </MainLayout>
    </RequireActiveMember>
  );
}