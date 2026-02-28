'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { DEFAULT_ASSEMBLY_ID } from '@/config/assembly';

import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import type { Vote, Project } from '@/types';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

function ResultsContent() {
  const db = useFirestore();
  const [selectedVoteId, setSelectedVoteId] = useState<string | null>(null);

  const votesQuery = useMemoFirebase(
    () =>
      query(
        collection(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes'),
        where('state', '==', 'locked'),
        orderBy('updatedAt', 'desc'),
        limit(50)
      ),
    [db]
  );
  const { data: votes, isLoading: isVotesLoading } = useCollection<Vote>(votesQuery);

  const projectsQuery = useMemoFirebase(
    () => query(collection(db, 'projects'), limit(200)),
    [db]
  );
  const { data: projects } = useCollection<Project>(projectsQuery);

  const projectsById = useMemo(
    () => new Map((projects ?? []).map((p) => [p.id, p])),
    [projects]
  );

  if (isVotesLoading) {
    return (
      <div className="py-24 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Chargement des archives...
      </div>
    );
  }

  return (
    <div className="space-y-16 animate-in fade-in duration-700">
      <header className="space-y-8">
        <div className="space-y-2">
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted-foreground block">
            Archives
          </span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-black">
            Décisions de l&apos;Assemblée
          </h1>
        </div>
      </header>

      {votes && votes.length > 0 ? (
        <div className="grid gap-8">
          {votes.map((vote) => {
            const isSelected = selectedVoteId === vote.id;

            const totalBallots =
              (vote.results as any)?.total ?? (vote.results as any)?.totalBallots ?? 0;
            const eligible = vote.eligibleCountAtOpen ?? null;
            const participationPct =
              eligible && eligible > 0 ? Math.round((100 * totalBallots) / eligible) : null;

            const winnerId = vote.results?.winnerId ?? null;
            const winner = winnerId ? projectsById.get(String(winnerId)) : null;

            const computedAtFormatted =
              (vote.results as any)?.computedAt?.toDate
                ? (vote.results as any).computedAt.toDate().toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—';

            const top5 = (vote.results?.fullRanking ?? []).slice(0, 5);

            return (
              <div
                key={vote.id}
                className={cn(
                  'border border-border bg-white transition-all overflow-hidden',
                  isSelected && 'border-black shadow-lg'
                )}
              >
                <div
                  className={cn(
                    'p-8 cursor-pointer flex flex-col md:flex-row md:items-center md:justify-between gap-6',
                    'bg-white'
                  )}
                  onClick={() => setSelectedVoteId(isSelected ? null : vote.id)}
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge className="bg-black text-white rounded-none uppercase text-[9px]">
                        Scrutin archivé
                      </Badge>
                      <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                        PV : {computedAtFormatted}
                      </span>
                    </div>

                    <h3 className="text-2xl font-bold leading-tight">{vote.question}</h3>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] uppercase font-bold tracking-widest text-muted-foreground pt-1">
                      <span>Bulletins : {totalBallots}</span>
                      <span>Éligibles : {eligible ?? '—'}</span>
                      <span>Participation : {participationPct !== null ? `${participationPct}%` : '—'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto">
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                        Vainqueur
                      </p>
                      <p className="text-sm font-black uppercase text-primary flex items-center justify-end gap-2">
                        <Trophy className="h-4 w-4" />
                        {winner?.title ?? (winnerId ? String(winnerId) : '—')}
                      </p>
                    </div>

                    <ChevronRight
                      className={cn(
                        'h-5 w-5 text-muted-foreground transition-transform',
                        isSelected && 'rotate-90'
                      )}
                    />
                  </div>
                </div>

                {isSelected && vote.results && (
                  <div className="px-8 pb-12 pt-6 border-t border-border animate-in slide-in-from-top-2 space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="p-6 border bg-secondary/10 space-y-1">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">
                          Bulletins
                        </p>
                        <p className="text-2xl font-black">{totalBallots}</p>
                      </div>

                      <div className="p-6 border bg-secondary/10 space-y-1">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">
                          Participation
                        </p>
                        <p className="text-2xl font-black">
                          {participationPct !== null ? `${participationPct}%` : '—'}
                        </p>
                      </div>

                      <div className="p-6 border bg-primary/10 ring-1 ring-primary/10 space-y-1">
                        <p className="text-[10px] uppercase font-bold text-primary">Vainqueur</p>
                        <p className="text-lg font-black uppercase text-primary leading-tight">
                          {winner?.title ?? (winnerId ? String(winnerId) : '—')}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <h4 className="text-xs uppercase tracking-[0.2em] font-bold">
                          Classement (top 5)
                        </h4>

                        <Link href={`/admin/results/${vote.id}`}>
                          <Button
                            variant="outline"
                            className="rounded-none uppercase font-bold text-xs tracking-widest h-10 px-6"
                          >
                            Voir PV
                          </Button>
                        </Link>
                      </div>

                      <div className="space-y-2">
                        {top5.map((r: any, idx: number) => (
                          <div
                            key={r.id}
                            className={cn(
                              'p-4 border flex items-center justify-between gap-4',
                              idx === 0 ? 'bg-primary/5 border-primary' : 'bg-white'
                            )}
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              <div
                                className={cn(
                                  'w-10 h-10 flex items-center justify-center font-black',
                                  idx === 0
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-secondary text-muted-foreground'
                                )}
                              >
                                #{idx + 1}
                              </div>

                              <div className="min-w-0">
                                <p className="font-bold uppercase truncate">
                                  {projectsById.get(r.id)?.title ?? r.id}
                                </p>
                                <p className="text-[10px] text-muted-foreground font-mono truncate">
                                  {r.id}
                                </p>
                              </div>
                            </div>

                            <div className="text-right">
                              <p className="text-[10px] uppercase font-bold text-muted-foreground">
                                Score
                              </p>
                              <p className="font-mono text-xs">{r.score ?? r.rank ?? '—'}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {((vote.results?.fullRanking ?? []).length ?? 0) > 5 && (
                        <p className="text-[10px] text-muted-foreground italic">
                          Voir le PV pour le classement complet.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-32 border border-dashed border-border bg-secondary/5">
          <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground">
            Aucun résultat publié
          </p>
        </div>
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