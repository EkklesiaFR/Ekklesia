'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { useFirestore, useUser } from '@/firebase';
import { DEFAULT_ASSEMBLY_ID } from '@/config/assembly';
import type { Vote } from '@/types';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle } from 'lucide-react';
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type FirestoreError,
} from 'firebase/firestore';

function formatDateFR(ts: unknown) {
  try {
    const value = ts as
      | { toDate?: () => Date }
      | Date
      | string
      | number
      | null
      | undefined;

    const d =
      value &&
      typeof value === 'object' &&
      'toDate' in value &&
      typeof value.toDate === 'function'
        ? value.toDate()
        : value
          ? new Date(value as string | number | Date)
          : null;

    if (!d || Number.isNaN(d.getTime())) return null;

    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  } catch {
    return null;
  }
}

function pickHumorLine(rate: number) {
  const tiers = [
    {
      min: 80,
      lines: [
        "On vous soupçonne d’avoir les clés de l’assemblée.",
        "Si tout le monde votait comme vous, la démocratie dormirait mieux.",
        "Participation exemplaire. On va finir par vous demander un autographe.",
      ],
    },
    {
      min: 60,
      lines: [
        "Présence solide. Vous êtes là quand ça compte (souvent).",
        "Vous votez sérieusement… et parfois même avec envie.",
        "On vous voit régulièrement. C’est déjà plus que certains élus.",
      ],
    },
    {
      min: 40,
      lines: [
        "Vous suivez… parfois avec un léger décalage, mais vous suivez.",
        "Participation intermittente, mais participation quand même.",
        "Vous êtes dans le game. Pas tous les jours, mais dans le game.",
      ],
    },
    {
      min: 20,
      lines: [
        "Votre siège est réservé. Il vous attend (calmement).",
        "On vous aperçoit de temps en temps. C’est pas mal.",
        "Votre voix existe. Elle hésite juste un peu à sortir.",
      ],
    },
    {
      min: 0,
      lines: [
        "Présence spirituelle détectée. On attend le vote physique.",
        "Vous êtes inscrit. C’est un excellent premier pas.",
        "La démocratie est patiente… mais elle vous regarde.",
      ],
    },
  ];

  const tier = tiers.find((t) => rate >= t.min) ?? tiers[tiers.length - 1];
  const idx = Math.floor(Math.random() * tier.lines.length);
  return tier.lines[idx];
}

type FilterKey = 'all' | 'voted' | 'missed';

type VoteDoc = Partial<Vote> & {
  id: string;
  lockedAt?: unknown;
  computedAt?: unknown;
  question?: string;
};

function AccountVotesContent() {
  const { user, isUserLoading } = useUser();
  const uid = user?.uid ?? null;
  const db = useFirestore();

  const [votesDocs, setVotesDocs] = useState<VoteDoc[]>([]);
  const [votesLoading, setVotesLoading] = useState<boolean>(true);
  const [votesError, setVotesError] = useState<FirestoreError | null>(null);

  const [votedMap, setVotedMap] = useState<Record<string, boolean>>({});
  const [ballotsLoading, setBallotsLoading] = useState<boolean>(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [humorLine, setHumorLine] = useState<string>('');

  useEffect(() => {
    if (isUserLoading) {
      setVotesLoading(true);
      return;
    }

    if (!uid) {
      setVotesDocs([]);
      setVotesError(null);
      setVotesLoading(false);
      return;
    }

    setVotesLoading(true);
    setVotesError(null);

    const q = query(
      collection(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes'),
      where('state', '==', 'locked'),
      orderBy('lockedAt', 'desc'),
      limit(30)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: VoteDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Partial<Vote>),
        }));

        setVotesDocs(list);
        setVotesLoading(false);
        setVotesError(null);
      },
      (err) => {
        console.error('[account/votes] votes query error:', err);
        setVotesDocs([]);
        setVotesError(err);
        setVotesLoading(false);
      }
    );

    return () => unsub();
  }, [db, uid, isUserLoading]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (isUserLoading) {
        setBallotsLoading(true);
        return;
      }

      if (!uid || votesDocs.length === 0) {
        setVotedMap({});
        setBallotsLoading(false);
        return;
      }

      setBallotsLoading(true);

      const checks = await Promise.all(
        votesDocs.map(async (v) => {
          try {
            const ballotRef = doc(
              db,
              'assemblies',
              DEFAULT_ASSEMBLY_ID,
              'votes',
              v.id,
              'ballots',
              uid
            );

            const snap = await getDoc(ballotRef);
            return [v.id, snap.exists()] as const;
          } catch (err) {
            console.error('[account/votes] ballot read error:', v.id, err);
            return [v.id, false] as const;
          }
        })
      );

      if (cancelled) return;

      const next: Record<string, boolean> = {};
      for (const [voteId, exists] of checks) {
        next[voteId] = exists;
      }

      setVotedMap(next);
      setBallotsLoading(false);
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [db, uid, votesDocs, isUserLoading]);

  const stats = useMemo(() => {
    const total = votesDocs.length;
    const voted = Object.values(votedMap).filter(Boolean).length;
    const missed = Math.max(0, total - voted);
    const rate = total > 0 ? Math.round((voted / total) * 100) : 0;
    return { total, voted, missed, rate };
  }, [votesDocs, votedMap]);

  useEffect(() => {
    setHumorLine(pickHumorLine(stats.rate));
  }, [stats.rate]);

  const filteredVotes = useMemo(() => {
    if (filter === 'all') return votesDocs;
    if (filter === 'voted') return votesDocs.filter((v) => !!votedMap[v.id]);
    return votesDocs.filter((v) => !votedMap[v.id]);
  }, [votesDocs, votedMap, filter]);

  const isBusy = isUserLoading || votesLoading || ballotsLoading;

  return (
    <div className="space-y-10">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold">Mes votes</h1>
          <p className="mt-2 text-muted-foreground">
            Participation et historique des scrutins clôturés.
          </p>
        </div>

        {isBusy && (
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Chargement…
          </span>
        )}
      </div>

      {votesError && (
        <div className="border border-border bg-white p-5 text-sm text-muted-foreground">
          Impossible de charger les votes.
          <div className="mt-2 font-mono text-xs">
            {votesError.code} — {votesError.message}
          </div>
        </div>
      )}

      <section className="space-y-8 border border-border bg-white p-8">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Participés
            </p>
            <p className="text-2xl font-bold">{stats.voted}</p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Manqués
            </p>
            <p className="text-2xl font-bold">{stats.missed}</p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Archives
            </p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Taux
            </p>
            <p className="text-2xl font-bold text-[#7DC092]">{stats.rate}%</p>
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <p className="text-sm italic text-muted-foreground">“{humorLine}”</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            sur {stats.total || 0} scrutin{stats.total > 1 ? 's' : ''} clôturé
            {stats.total > 1 ? 's' : ''}.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['all', 'voted', 'missed'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={cn(
                'border border-border px-3 py-2 text-xs font-bold uppercase tracking-widest transition-colors',
                filter === k
                  ? 'border-black bg-black text-white'
                  : 'bg-white hover:bg-zinc-50'
              )}
            >
              {k === 'all' ? 'Tous' : k === 'voted' ? 'Votés' : 'Manqués'}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        {!isBusy && filteredVotes.length === 0 && (
          <div className="text-sm text-muted-foreground">
            Aucun résultat pour ce filtre.
          </div>
        )}

        {filteredVotes.map((v) => {
          const voted = !!votedMap[v.id];
          const date = formatDateFR(v.lockedAt ?? v.computedAt);

          return (
            <div
              key={v.id}
              className="flex items-center justify-between gap-4 border border-border bg-white px-5 py-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {voted ? (
                    <CheckCircle2 className="h-4 w-4 text-[#7DC092]" />
                  ) : (
                    <XCircle className="h-4 w-4 text-zinc-400" />
                  )}
                  <p className="truncate font-bold">{v.question || 'Scrutin'}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {date ? `Clôturé le ${date}` : 'Clôturé'}
                </p>
              </div>

              <Link
                href={`/results?voteId=${v.id}`}
                className="shrink-0 text-xs font-bold uppercase tracking-widest text-black transition-colors hover:text-[#7DC092]"
              >
                Voir
              </Link>
            </div>
          );
        })}
      </section>
    </div>
  );
}

export default function AccountVotesPage() {
  return (
    <RequireActiveMember>
      <MainLayout statusText="Mes votes">
        <AccountVotesContent />
      </MainLayout>
    </RequireActiveMember>
  );
}