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
      toast({ variant: 'destructive', title: 'Erreur', description: "Impossible de copier." });
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 border bg-white px-4 py-3">
      <div className="min-w-0">
        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">{label}</p>
        <p className="font-mono text-xs break-all">{v || '—'}</p>
      </div>

      <Button
        variant="outline"
        size="sm"
        disabled={!canCopy}
        onClick={onCopy}
        className="rounded-none h-9 px-3 gap-2"
        title={canCopy ? `Copier ${label}` : 'Rien à copier'}
      >
        <Copy className="h-4 w-4" /> Copier
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
      ? 'bg-primary/10 ring-1 ring-primary/10'
      : tone === 'good'
        ? 'bg-primary/5 ring-1 ring-primary/10'
        : tone === 'bad'
          ? 'bg-destructive/5 ring-1 ring-destructive/10'
          : 'bg-secondary/10';

  const labelClass =
    tone === 'brand'
      ? 'text-primary'
      : tone === 'bad'
        ? 'text-destructive'
        : 'text-muted-foreground';

  return (
    <div className={cn('p-6 border space-y-1', toneClass)}>
      <p className={cn('text-[10px] uppercase font-bold', labelClass)}>{label}</p>
      <div className="flex items-end justify-between gap-3">
        <p className="text-2xl font-black">{value}</p>
        {sub ? <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">{sub}</p> : null}
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

  const projectsById = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p])), [projects]);

  if (isVoteLoading) {
    return (
      <div className="py-24 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Chargement du PV...
      </div>
    );
  }

  if (!vote) {
    return (
      <div className="py-24 text-center">
        <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground">PV introuvable</p>
        <div className="pt-8">
          <Link href="/results">
            <Button
              variant="outline"
              className="rounded-none uppercase font-bold text-xs tracking-widest h-10 px-6 gap-2"
            >
              <ChevronLeft className="h-4 w-4" /> Retour archives
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
    <div className="space-y-12 animate-in fade-in duration-700">
      <div className="flex items-center justify-between gap-6">
        <Link href="/results">
          <Button variant="outline" className="rounded-none uppercase font-bold text-xs tracking-widest h-10 px-6 gap-2">
            <ChevronLeft className="h-4 w-4" /> Archives
          </Button>
        </Link>

        <div className="flex items-center gap-2">
          <Badge className="bg-black text-white rounded-none uppercase text-[9px]">PV</Badge>

          {isSealed && (
            <Badge className="rounded-none uppercase text-[9px] bg-primary/10 text-primary border border-primary/20 flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              Résultat scellé
            </Badge>
          )}

          <Button
            onClick={onDownloadPdf}
            disabled={!canDownloadPdf}
            className="rounded-none uppercase font-bold text-xs tracking-widest h-10 px-5 gap-2"
            title={canDownloadPdf ? 'Télécharger le PV (PDF)' : 'Résultats manquants : PDF indisponible'}
          >
            <Download className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      <header className="space-y-4">
        <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted-foreground block">
          Procès-verbal
        </span>

        <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-black">{(vote as any).question}</h1>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] uppercase font-bold tracking-widest text-muted-foreground pt-2">
          <span>VoteId : {voteId}</span>
          <span>État : {(vote as any).state}</span>
          <span>PV : {computedAtFormatted}</span>
          <span>Clôture : {lockedAtFormatted}</span>
          <span>Méthode : {method}</span>
        </div>

        {/* Ligne “règlement” courte */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
          <span>Quorum : {quorumPct}%</span>
          <span>Validité : {validityLabel}</span>
        </div>
      </header>

      {/* ✅ 4 cards stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          label="Bulletins"
          value={totalBallots}
          sub={eligible && eligible > 0 ? `${totalBallots} / ${eligible}` : undefined}
        />

        <StatCard
          label="Participation"
          value={participationPct !== null ? `${participationPct}%` : '—'}
          sub={eligible && eligible > 0 && abstentionPct !== null ? `abstention ${abstentionPct}%` : undefined}
        />

        <StatCard label="Quorum" value={`${quorumPct}%`} sub="seuil requis" />

        <StatCard
          label="Validité"
          value={
            <span className={cn(isValid ? 'text-primary' : 'text-destructive')}>
              {validityLabel}
            </span>
          }
          sub={quorumPct > 0 ? `seuil ${quorumPct}%` : 'aucun seuil'}
          tone={isValid ? 'good' : 'bad'}
        />
      </div>

      {/* ✅ Vainqueur en grand */}
      <section className={cn('border p-8', isValid ? 'bg-primary/5 border-primary/20' : 'bg-secondary/10')}>
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-3 min-w-0">
            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Vainqueur</p>

            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-12 h-12 flex items-center justify-center',
                  isValid ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                )}
              >
                <Trophy className="h-6 w-6" />
              </div>

              <div className="min-w-0">
                <h2 className="text-2xl md:text-3xl font-black uppercase leading-tight text-black truncate">
                  {winner?.title ?? (winnerId ? String(winnerId) : '—')}
                </h2>
                <p className="text-[10px] text-muted-foreground font-mono break-all">{winnerId ?? '—'}</p>
              </div>
            </div>
          </div>

          <Badge
            className={cn(
              'rounded-none uppercase text-[9px] h-7 px-3 flex items-center gap-2',
              isValid
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'bg-destructive/10 text-destructive border border-destructive/20'
            )}
          >
            {isValid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
            {validityLabel}
          </Badge>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs uppercase tracking-[0.2em] font-bold">Intégrité</h2>
          <Badge
            className={cn(
              'rounded-none uppercase text-[9px]',
              isSealed ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-secondary text-muted-foreground'
            )}
          >
            {isSealed ? 'Scellé (hash)' : 'Non scellé'}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border bg-white px-4 py-3">
            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">computedBy</p>
            <p className="font-mono text-xs break-all">{computedBy}</p>
          </div>

          <div className="border bg-white px-4 py-3">
            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">lockedAt</p>
            <p className="font-mono text-xs">{lockedAtFormatted}</p>
          </div>

          <div className="border bg-white px-4 py-3">
            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">method</p>
            <p className="font-mono text-xs">{method}</p>
          </div>

          <CopyRow label="resultsHash" value={resultsHash} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs uppercase tracking-[0.2em] font-bold">Classement complet</h2>

        {(vote as any).state !== 'locked' && (
          <div className="border border-dashed border-border bg-secondary/5 p-6">
            <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground">
              Attention : ce vote n’est pas “locked”. Le PV est affiché à titre informatif.
            </p>
          </div>
        )}

        {ranking.length > 0 ? (
          <div className="space-y-2">
            {ranking.map((r: any, idx: number) => (
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
                      idx === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                    )}
                  >
                    #{idx + 1}
                  </div>

                  <div className="min-w-0">
                    <p className="font-bold uppercase truncate">{projectsById.get(r.id)?.title ?? r.id}</p>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">{r.id}</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Score</p>
                  <p className="font-mono text-xs">{r.score ?? r.rank ?? '—'}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 border border-dashed border-border bg-secondary/5">
            <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground">
              Aucun classement disponible
            </p>
          </div>
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