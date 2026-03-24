'use client';

import { useMemo } from 'react';
import Link from 'next/link';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';

import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { DEFAULT_ASSEMBLY_ID } from '@/config/assembly';

import { doc, collection, query, limit } from 'firebase/firestore';
import type { Vote, Project } from '@/types';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  Copy,
  Download,
  ShieldCheck,
  Trophy,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { GlassCard } from '@/components/ui/glass-card';

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
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de copier.' });
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

function StatCard({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: 'neutral' | 'good' | 'bad' | 'brand';
}) {
  const toneClass =
    tone === 'brand'
      ? 'border-primary/20 bg-primary/10 ring-1 ring-primary/10'
      : tone === 'good'
        ? 'border-primary/20 bg-primary/5 ring-1 ring-primary/10'
        : tone === 'bad'
          ? 'border-destructive/20 bg-destructive/5 ring-1 ring-destructive/10'
          : 'border-white/60 bg-white/40';

  const labelClass =
    tone === 'brand'
      ? 'text-primary'
      : tone === 'bad'
        ? 'text-destructive'
        : 'text-muted-foreground';

  return (
    <div className={cn('rounded-[28px] border p-5 backdrop-blur-sm md:p-6', toneClass)}>
      <div className="space-y-2">
        <p className={cn('text-[10px] font-semibold uppercase tracking-[0.18em]', labelClass)}>
          {label}
        </p>

        <div className="flex items-end justify-between gap-3">
          <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
          {sub ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {sub}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ResultsDetailContent({ voteId }: { voteId: string }) {
  const db = useFirestore();

  const voteRef = useMemoFirebase(
    () => doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes', voteId),
    [db, voteId]
  );
  const { data: vote, isLoading: isVoteLoading } = useDoc<Vote>(voteRef);

  const projectsQuery = useMemoFirebase(() => query(collection(db, 'projects'), limit(300)), [db]);
  const { data: projects } = useCollection<Project>(projectsQuery);

  const projectsById = useMemo(
    () => new Map((projects ?? []).map((p) => [p.id, p])),
    [projects]
  );

  if (isVoteLoading) {
    return (
      <div className="py-24 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        Chargement du procès-verbal…
      </div>
    );
  }

  if (!vote) {
    return (
      <div className="py-24 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          PV introuvable
        </p>

        <div className="pt-8">
          <Link href="/results">
            <Button
              variant="outline"
              className="h-11 rounded-full border-white/60 bg-white/50 px-6 text-sm font-semibold backdrop-blur-sm"
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Retour aux archives
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const totalBallots = (vote.results as any)?.total ?? (vote.results as any)?.totalBallots ?? 0;
  const eligible = (vote as any).eligibleCountAtOpen ?? null;

  const participationPct =
    eligible && eligible > 0 ? Math.round((100 * totalBallots) / eligible) : null;

  const abstentionPct =
    eligible && eligible > 0 && participationPct !== null ? Math.max(0, 100 - participationPct) : null;

  const quorumPct = Number((vote as any).quorumPct ?? 0) || 0;

  const isValid =
    quorumPct <= 0 ? true : participationPct !== null ? participationPct >= quorumPct : false;

  const validityLabel = isValid ? 'Valide' : 'Invalide';

  const computedAtFormatted = formatFr((vote.results as any)?.computedAt);
  const lockedAtFormatted = formatFr((vote as any)?.lockedAt);

  const winnerId = (vote.results as any)?.winnerId ?? null;
  const winner = winnerId ? projectsById.get(String(winnerId)) : null;

  const method = (vote.results as any)?.method ?? '—';
  const computedBy = (vote.results as any)?.computedBy ?? '—';
  const resultsHash = (vote.results as any)?.resultsHash ?? null;
  const isSealed = !!resultsHash;

  const ranking = (vote.results as any)?.fullRanking ?? [];
  const canDownloadPdf = !!winnerId && Array.isArray(ranking) && ranking.length > 0;

  const onDownloadPdf = () => {
    window.open(`/api/pv/${DEFAULT_ASSEMBLY_ID}/${voteId}/pdf`, '_blank');
  };

  return (
    <div className="animate-in fade-in space-y-8 duration-700 md:space-y-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Link href="/results">
          <Button
            variant="outline"
            className="h-11 rounded-full border-white/60 bg-white/50 px-6 text-sm font-semibold backdrop-blur-sm"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Archives
          </Button>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <Badge className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground">
            PV
          </Badge>

          {isSealed && (
            <Badge className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              Résultat scellé
            </Badge>
          )}

          <Button
            onClick={onDownloadPdf}
            disabled={!canDownloadPdf}
            className="h-11 rounded-full px-5 text-sm font-semibold"
            title={canDownloadPdf ? 'Télécharger le PV (PDF)' : 'Résultats manquants : PDF indisponible'}
          >
            <Download className="mr-2 h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      <header className="space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Procès-verbal
        </p>

        <h1 className="max-w-5xl text-3xl font-bold tracking-tight text-foreground md:text-5xl">
          {(vote as any).question}
        </h1>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-medium text-muted-foreground">
          <span>VoteId : {voteId}</span>
          <span>État : {(vote as any).state}</span>
          <span>PV : {computedAtFormatted}</span>
          <span>Clôture : {lockedAtFormatted}</span>
          <span>Méthode : {method}</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-medium text-muted-foreground">
          <span>Quorum : {quorumPct}%</span>
          <span>Validité : {validityLabel}</span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          label="Bulletins"
          value={totalBallots}
          sub={eligible && eligible > 0 ? `${totalBallots} / ${eligible}` : undefined}
        />

        <StatCard
          label="Participation"
          value={participationPct !== null ? `${participationPct}%` : '—'}
          sub={
            eligible && eligible > 0 && abstentionPct !== null
              ? `abstention ${abstentionPct}%`
              : undefined
          }
          tone="brand"
        />

        <StatCard label="Quorum" value={`${quorumPct}%`} sub="seuil requis" />

        <StatCard
          label="Validité"
          value={<span className={cn(isValid ? 'text-primary' : 'text-destructive')}>{validityLabel}</span>}
          sub={quorumPct > 0 ? `seuil ${quorumPct}%` : 'aucun seuil'}
          tone={isValid ? 'good' : 'bad'}
        />
      </div>

      <GlassCard
        intensity="medium"
        className={cn(
          'p-6 md:p-8',
          isValid ? 'border-primary/20 bg-primary/5' : 'border-white/60 bg-white/40'
        )}
      >
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Vainqueur
            </p>

            <div className="flex items-center gap-4">
              <div
                className={cn(
                  'flex h-14 w-14 items-center justify-center rounded-2xl',
                  isValid
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground'
                )}
              >
                <Trophy className="h-7 w-7" />
              </div>

              <div className="min-w-0">
                <h2 className="truncate text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                  {winner?.title ?? (winnerId ? String(winnerId) : '—')}
                </h2>
                <p className="break-all font-mono text-xs text-muted-foreground">
                  {winnerId ?? '—'}
                </p>
              </div>
            </div>
          </div>

          <Badge
            className={cn(
              'flex items-center gap-2 self-start rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]',
              isValid
                ? 'border border-primary/20 bg-primary/10 text-primary'
                : 'border border-destructive/20 bg-destructive/10 text-destructive'
            )}
          >
            {isValid ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <XCircle className="h-3.5 w-3.5" />
            )}
            {validityLabel}
          </Badge>
        </div>
      </GlassCard>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground">
            Intégrité
          </h2>

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
            <p className="break-all font-mono text-xs text-foreground">{computedBy}</p>
          </div>

          <div className="rounded-2xl border border-white/60 bg-white/40 px-4 py-3 backdrop-blur-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              lockedAt
            </p>
            <p className="font-mono text-xs text-foreground">{lockedAtFormatted}</p>
          </div>

          <div className="rounded-2xl border border-white/60 bg-white/40 px-4 py-3 backdrop-blur-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              method
            </p>
            <p className="font-mono text-xs text-foreground">{method}</p>
          </div>

          <CopyRow label="resultsHash" value={resultsHash} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground">
          Classement complet
        </h2>

        {(vote as any).state !== 'locked' && (
          <GlassCard intensity="soft" className="border-dashed p-5">
            <p className="text-sm font-medium text-muted-foreground">
              Attention : ce vote n’est pas verrouillé. Le PV est affiché à titre informatif.
            </p>
          </GlassCard>
        )}

        {ranking.length > 0 ? (
          <div className="space-y-3">
            {ranking.map((r: any, idx: number) => (
              <div
                key={r.id}
                className={cn(
                  'flex items-center justify-between gap-4 rounded-[24px] border p-4 backdrop-blur-sm md:p-5',
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
                    <p className="truncate text-sm font-semibold text-foreground md:text-base">
                      {projectsById.get(r.id)?.title ?? r.id}
                    </p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">{r.id}</p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Score
                  </p>
                  <p className="font-mono text-xs text-foreground">{r.score ?? r.rank ?? '—'}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <GlassCard intensity="soft" className="p-10 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Aucun classement disponible
            </p>
          </GlassCard>
        )}
      </section>
    </div>
  );
}

export default function ResultsVoteDetailClient({ voteId }: { voteId: string }) {
  return (
    <RequireActiveMember>
      <MainLayout statusText="Archives">
        <ResultsDetailContent voteId={voteId} />
      </MainLayout>
    </RequireActiveMember>
  );
}