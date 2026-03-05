'use client';

console.log('DEFAULT_ASSEMBLY_ID', process.env.NEXT_PUBLIC_DEFAULT_ASSEMBLY_ID);

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { useFirestore, useMemoFirebase, useUser, useCollection } from '@/firebase';
import { DEFAULT_ASSEMBLY_ID } from '@/config/assembly';
import type { Vote } from '@/types';

import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle } from 'lucide-react';
import { collection, doc, getDoc, limit, orderBy, query, where } from 'firebase/firestore';

function formatDateFR(ts: any) {
  try {
    const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
    if (!d) return null;
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

function AccountVotesContent() {
  const { user } = useUser();
  const uid = user?.uid;

  const db = useFirestore();

  // ✅ Ref memoized (obligatoire avec ton useCollection)
  const votesRef = useMemoFirebase(() => {
    if (!uid) return null;
    return collection(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes');
  }, [db, uid]);

  // ✅ Query memoized via useMemoFirebase (sinon throw)
  const votesQuery = useMemoFirebase(() => {
    if (!votesRef) return null;
    return query(votesRef, where('state', '==', 'locked'), orderBy('lockedAt', 'desc'), limit(30));
  }, [votesRef]);

  // ✅ useCollection retourne isLoading (pas "loading")
  const { data: votesDocs, isLoading: votesLoading, error: votesError } = useCollection<Vote>(votesQuery);

  const [votedMap, setVotedMap] = useState<Record<string, boolean>>({});
  const [ballotsLoading, setBallotsLoading] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');

  // Punchline stable (ne change pas à chaque render)
  const [humorLine, setHumorLine] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!uid || !votesDocs?.length) {
        setVotedMap({});
        setBallotsLoading(false);
        return;
      }

      setBallotsLoading(true);

      const checks = await Promise.all(
        votesDocs.map(async (v: any) => {
          const voteId = v.id;
          try {
            const ballotRef = doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes', voteId, 'ballots', uid);
            const snap = await getDoc(ballotRef);
            return [voteId, snap.exists()] as const;
          } catch {
            return [voteId, false] as const;
          }
        })
      );

      if (cancelled) return;

      const next: Record<string, boolean> = {};
      for (const [voteId, exists] of checks) next[voteId] = exists;

      setVotedMap(next);
      setBallotsLoading(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [db, uid, votesDocs]);

  const stats = useMemo(() => {
    const total = votesDocs?.length || 0;
    const voted = Object.values(votedMap).filter(Boolean).length;
    const missed = Math.max(0, total - voted);
    const rate = total > 0 ? Math.round((voted / total) * 100) : 0;
    return { total, voted, missed, rate };
  }, [votesDocs, votedMap]);

  useEffect(() => {
    // recalcul uniquement quand le taux change (donc quand de nouveaux votes/ballots arrivent)
    setHumorLine(pickHumorLine(stats.rate));
  }, [stats.rate]);

  const filteredVotes = useMemo(() => {
    const list = votesDocs || [];
    if (filter === 'all') return list;
    if (filter === 'voted') return list.filter((v: any) => !!votedMap[v.id]);
    return list.filter((v: any) => !votedMap[v.id]);
  }, [votesDocs, votedMap, filter]);

  const isBusy = votesLoading || ballotsLoading;

  return (
    <div className="space-y-10">
      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold">Mes votes</h1>
          <p className="text-muted-foreground mt-2">Participation et historique des scrutins clôturés.</p>
        </div>

        {isBusy && (
          <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">Chargement…</span>
        )}
      </div>

      {votesError && (
        <div className="border border-border bg-white p-5 text-sm text-muted-foreground">
          Impossible de charger les votes (droits ou réseau). Réessaie dans un instant.
        </div>
      )}

      {/* Stats + filtres + punchline */}
      <section className="border border-border p-8 bg-white space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Participés</p>
            <p className="text-2xl font-bold">{stats.voted}</p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Manqués</p>
            <p className="text-2xl font-bold">{stats.missed}</p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Archives</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Taux</p>
            <p className="text-2xl font-bold text-[#7DC092]">{stats.rate}%</p>
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <p className="text-sm italic text-muted-foreground">“{humorLine}”</p>
          <p className="mt-1 text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
            sur {stats.total || 0} scrutin{stats.total > 1 ? 's' : ''} clôturé{stats.total > 1 ? 's' : ''}.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {(['all', 'voted', 'missed'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={cn(
                'px-3 py-2 border border-border text-xs font-bold uppercase tracking-widest transition-colors',
                filter === k ? 'bg-black text-white border-black' : 'bg-white hover:bg-zinc-50'
              )}
            >
              {k === 'all' ? 'Tous' : k === 'voted' ? 'Votés' : 'Manqués'}
            </button>
          ))}
        </div>
      </section>

      {/* Liste */}
      <section className="space-y-3">
        {!votesLoading && filteredVotes.length === 0 && (
          <div className="text-sm text-muted-foreground">Aucun résultat pour ce filtre.</div>
        )}

        {filteredVotes.map((v: any) => {
          const voted = !!votedMap[v.id];
          const date = formatDateFR(v.lockedAt || v.computedAt);

          return (
            <div key={v.id} className="flex items-center justify-between gap-4 border border-border px-5 py-4 bg-white">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {voted ? (
                    <CheckCircle2 className="h-4 w-4 text-[#7DC092]" />
                  ) : (
                    <XCircle className="h-4 w-4 text-zinc-400" />
                  )}
                  <p className="font-bold truncate">{v.question || 'Scrutin'}</p>
                </div>
                <p className="text-xs text-muted-foreground">{date ? `Clôturé le ${date}` : 'Clôturé'}</p>
              </div>

              <Link
                href={`/results?voteId=${v.id}`}
                className="text-xs font-bold uppercase tracking-widest text-black hover:text-[#7DC092] transition-colors shrink-0"
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