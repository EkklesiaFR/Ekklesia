'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';

import { CreateSessionModal } from '@/components/admin/CreateSessionModal';
import { toast } from '@/hooks/use-toast';

import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { DEFAULT_ASSEMBLY_ID } from '@/config/assembly';

import {
  collection,
  doc,
  getDocs,
  getCountFromServer,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  onSnapshot,
} from 'firebase/firestore';

import { Plus, BarChart3, Settings, Users, Activity, Lock, Play, Search } from 'lucide-react';

import { computeSchulzeResults } from '@/lib/tally';
import type { Project, MemberProfile, Vote, Ballot } from '@/types';

/** Helper: supports members shaped as {id} or {uid} */
function memberKey(member: MemberProfile): string | undefined {
  const m = member as unknown as { id?: string; uid?: string };
  return m.id ?? m.uid;
}

/**
 * v0.3.0 helper: SHA-256 stable hash (hex) using Web Crypto API.
 * Used to "seal" results for auditability.
 */
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Custom hook to count ballots for a vote.
 * - Realtime only when vote is open
 * - One-time count when draft/locked
 */
function useVoteMetrics(assemblyId: string, vote: Vote | undefined) {
  const db = useFirestore();
  const [ballotCount, setBallotCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!db || !assemblyId || !vote) {
      setBallotCount(0);
      setIsLoading(false);
      return;
    }

    const ballotsRef = collection(db, 'assemblies', assemblyId, 'votes', vote.id, 'ballots');

    if (vote.state === 'open') {
      setIsLoading(true);
      const unsubscribe = onSnapshot(
        ballotsRef,
        (snapshot) => {
          setBallotCount(snapshot.size);
          setIsLoading(false);
        },
        (error) => {
          console.error('[VOTE_METRICS] onSnapshot error:', error);
          setIsLoading(false);
        }
      );
      return () => unsubscribe();
    }

    setIsLoading(true);
    getCountFromServer(ballotsRef)
      .then((snapshot) => {
        setBallotCount(snapshot.data().count);
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('[VOTE_METRICS] getCountFromServer error:', error);
        setIsLoading(false);
      });
  }, [db, assemblyId, vote?.id, vote?.state]);

  return { ballotCount, isLoading };
}

function ActiveVoteCockpit({
  assemblyId,
  activeVote,
  members,
}: {
  assemblyId: string;
  activeVote: Vote | undefined;
  members: MemberProfile[];
}) {
  const { ballotCount, isLoading } = useVoteMetrics(assemblyId, activeVote);

  if (!activeVote) {
    return (
      <div className="p-4 border text-center bg-secondary/30">
        <p className="text-sm text-muted-foreground">Aucun vote en cours.</p>
      </div>
    );
  }

  const eligibleCount = activeVote.eligibleCountAtOpen;
  const participation =
    eligibleCount && eligibleCount > 0 ? Math.round((100 * ballotCount) / eligibleCount) : null;
  const abstention = participation !== null ? 100 - participation : null;

  const quorumPct = (activeVote as any).quorumPct ?? 0;
  const isValid = participation !== null ? participation >= quorumPct : null;

  const openedAtFormatted = activeVote.openedAt?.toDate
    ? activeVote.openedAt.toDate().toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  const openedByUser = activeVote.openedBy
    ? members.find((m) => memberKey(m) === activeVote.openedBy)
    : null;

  const openedByDisplay = openedByUser
    ? openedByUser.displayName || openedByUser.email
    : activeVote.openedBy || '—';

  return (
    <div className="p-6 border bg-secondary/30 space-y-4">
      <h4 className="font-bold text-lg">
        Vote en cours : <span className="font-normal">{activeVote.question}</span>
      </h4>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-x-6 gap-y-4 text-sm">
        <div className="space-y-1">
          <p className="text-[10px] uppercase font-bold text-muted-foreground">Bulletins</p>
          <p className="font-bold text-base">
            {isLoading ? '...' : eligibleCount ? `${ballotCount} / ${eligibleCount}` : ballotCount}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] uppercase font-bold text-muted-foreground">Participation</p>
          <p className="font-bold text-base">{participation !== null ? `${participation}%` : '—'}</p>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] uppercase font-bold text-muted-foreground">Abstention</p>
          <p className="font-bold text-base">{abstention !== null ? `${abstention}%` : '—'}</p>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] uppercase font-bold text-muted-foreground">Quorum</p>
          <p className="font-bold text-base">{quorumPct}%</p>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] uppercase font-bold text-muted-foreground">Validité</p>
          <p className="font-bold text-base">
            {isValid === null ? '—' : isValid ? (
              <span className="text-green-700">Valide</span>
            ) : (
              <span className="text-red-700">Invalide</span>
            )}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] uppercase font-bold text-muted-foreground">Ouvert le</p>
          <p className="font-mono text-xs">{openedAtFormatted}</p>
        </div>

        <div className="space-y-1 md:col-span-2">
          <p className="text-[10px] uppercase font-bold text-muted-foreground">Ouvert par</p>
          <p className="font-mono text-xs truncate" title={openedByDisplay}>
            {openedByDisplay}
          </p>
        </div>
      </div>
    </div>
  );
}

function VoteRow({
  assemblyId,
  vote,
  isProcessing,
  onOpen,
  onPublish,
  projectsById,
  members,
}: {
  assemblyId: string;
  vote: Vote;
  isProcessing: boolean;
  onOpen: (voteId: string) => void;
  onPublish: (vote: Vote) => void;
  projectsById: Map<string, Project>;
  members: MemberProfile[];
}) {
  const { ballotCount, isLoading } = useVoteMetrics(assemblyId, vote);

  const eligibleCount = vote.eligibleCountAtOpen;
  const participation =
    eligibleCount && eligibleCount > 0 ? Math.round((100 * ballotCount) / eligibleCount) : null;
  const abstention = participation !== null ? 100 - participation : null;

  const quorumPct = (vote as any).quorumPct ?? 0;
  const isValid = participation !== null ? participation >= quorumPct : null;

  const stateBadgeClass =
    {
      draft: 'bg-gray-400 text-white',
      open: 'bg-green-600 text-white',
      locked: 'bg-black text-white',
    }[vote.state] ?? 'bg-black text-white';

  const openedAtFormatted = vote.openedAt?.toDate
    ? vote.openedAt.toDate().toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  const openedByUser = vote.openedBy ? members.find((m) => memberKey(m) === vote.openedBy) : null;
  const openedByDisplay = openedByUser
    ? openedByUser.displayName || openedByUser.email
    : vote.openedBy || '—';

  const winnerId = vote.state === 'locked' ? vote.results?.winnerId : null;
  const winnerProject = winnerId ? projectsById.get(String(winnerId)) : null;
  const winnerDisplay = winnerProject
    ? (winnerProject.title ??
        (winnerProject as any).name ??
        (winnerProject as any).label ??
        winnerProject.id)
    : winnerId;

  return (
    <div className="p-8 border bg-white flex justify-between items-start group hover:border-black transition-all">
      <div className="space-y-4 flex-grow">
        <div className="flex items-center gap-3">
          <Badge className={stateBadgeClass}>{vote.state}</Badge>
          <h3 className="text-xl font-bold">{vote.question}</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-x-6 gap-y-3 text-sm pr-8">
          <div className="space-y-1">
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Éligibles</p>
            <p className="font-bold text-lg">{eligibleCount ?? '—'}</p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Bulletins</p>
            <p className="font-bold text-lg">
              {isLoading ? '...' : eligibleCount ? `${ballotCount} / ${eligibleCount}` : ballotCount}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Participation</p>
            <p className="font-bold text-lg">{participation !== null ? `${participation}%` : '—'}</p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Abstention</p>
            <p className="font-bold text-lg">{abstention !== null ? `${abstention}%` : '—'}</p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Quorum</p>
            <p className="font-bold text-lg">{quorumPct}%</p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Validité</p>
            <p className="font-bold text-lg">
              {isValid === null ? '—' : isValid ? (
                <span className="text-green-700">Valide</span>
              ) : (
                <span className="text-red-700">Invalide</span>
              )}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Ouvert le</p>
            <p className="font-mono text-xs">{openedAtFormatted}</p>
          </div>

          <div className="space-y-1 md:col-span-2">
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Ouvert par</p>
            <p className="font-mono text-xs truncate" title={openedByDisplay}>
              {openedByDisplay}
            </p>
          </div>

          {winnerId && (
            <div className="space-y-1 col-span-2">
              <p className="text-[10px] uppercase font-bold text-primary">Gagnant</p>
              <p className="font-bold text-primary truncate" title={winnerDisplay ?? undefined}>
                {winnerDisplay}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 flex flex-col gap-3">
        {vote.state === 'draft' && (
          <Button
            onClick={() => onOpen(vote.id)}
            disabled={isProcessing}
            className="rounded-none font-bold uppercase tracking-widest text-[10px] gap-2 h-12 px-6"
          >
            <Play className="h-3.5 w-3.5" /> Ouvrir
          </Button>
        )}

        {vote.state === 'open' && (
          <Button
            variant="outline"
            onClick={() => onPublish(vote)}
            disabled={isProcessing}
            className="rounded-none border-2 border-black font-bold uppercase tracking-widest text-[10px] gap-2 h-12 px-6"
          >
            <Lock className="h-3.5 w-3.5" /> Clôturer &amp; Publier
          </Button>
        )}

        {vote.state === 'locked' && (
          <Link href={`/results/${vote.id}`}>
            <Button
              variant="outline"
              disabled={isProcessing}
              className="rounded-none font-bold uppercase tracking-widest text-[10px] h-12 px-6"
            >
              PV
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

function AdminContent() {
  const db = useFirestore();
  const { user } = useUser();

  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  // Filters + Search
  const [filterState, setFilterState] = useState<Vote['state'] | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const votesQuery = useMemoFirebase(
    () => collection(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes'),
    [db]
  );
  const { data: votes } = useCollection<Vote>(votesQuery);

  const projectsQuery = useMemoFirebase(
    () => query(collection(db, 'projects'), orderBy('createdAt', 'desc')),
    [db]
  );
  const { data: projects } = useCollection<Project>(projectsQuery);

  const membersQuery = useMemoFirebase(() => collection(db, 'members'), [db]);
  const { data: members } = useCollection<MemberProfile>(membersQuery);

  const activeVote = useMemo(() => (votes || []).find((v) => v.state === 'open'), [votes]);

  const projectsById = useMemo(() => new Map((projects || []).map((p) => [p.id, p])), [projects]);

  const filterLabels: Record<Vote['state'] | 'all', string> = {
    all: 'Tous',
    open: 'Open',
    draft: 'Draft',
    locked: 'Locked',
  };

  const filteredAndSortedVotes = useMemo(() => {
    if (!votes) return [];

    const stateOrder: Record<Vote['state'], number> = { open: 1, draft: 2, locked: 3 };
    const q = searchQuery.toLowerCase().trim();

    return votes
      .filter((vote) => {
        if (filterState !== 'all' && vote.state !== filterState) return false;
        if (!q) return true;

        const winnerProject = vote.results?.winnerId ? projectsById.get(vote.results.winnerId) : null;
        const winnerTitle = winnerProject?.title ?? '';

        const searchCorpus = [
          vote.question,
          vote.id,
          vote.state === 'locked' ? winnerTitle : '',
          vote.state === 'locked' ? vote.results?.winnerId : '',
        ]
          .join(' ')
          .toLowerCase();

        return searchCorpus.includes(q);
      })
      .sort((a, b) => {
        if (stateOrder[a.state] !== stateOrder[b.state]) return stateOrder[a.state] - stateOrder[b.state];

        const dateA = a.openedAt ?? a.createdAt;
        const dateB = b.openedAt ?? b.createdAt;

        if (dateA?.toMillis && dateB?.toMillis) return dateB.toMillis() - dateA.toMillis();
        if (dateA) return -1;
        if (dateB) return 1;

        return a.id.localeCompare(b.id);
      });
  }, [votes, filterState, searchQuery, projectsById]);

  const handleOpenVote = async (voteId: string) => {
    setIsProcessing(voteId);
    try {
      const membersRef = collection(db, 'members');
      const eligibleQuery = query(membersRef, where('status', '==', 'active'));
      const eligibleSnap = await getCountFromServer(eligibleQuery);
      const eligibleCountAtOpen = eligibleSnap.data().count ?? 0;

      const voteRef = doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes', voteId);
      const assemblyRef = doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID);

      const batch = writeBatch(db);

      batch.update(voteRef, {
        state: 'open',
        eligibleCountAtOpen,
        openedAt: serverTimestamp(),
        openedBy: user?.uid ?? null,
        updatedAt: serverTimestamp(),
      });

      batch.update(assemblyRef, {
        state: 'open',
        activeVoteId: voteId,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
      toast({ title: 'Scrutin ouvert', description: 'Les membres peuvent maintenant voter.' });
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: "Impossible d'ouvrir le vote.",
      });
    } finally {
      setIsProcessing(null);
    }
  };

  /**
   * v0.3.0: publish results + seal with resultsHash + lockedAt + computedBy/method.
   * Hash is computed from a canonical payload that excludes serverTimestamp() fields.
   */
  const handlePublishResults = async (vote: Vote) => {
    setIsProcessing(vote.id);
    try {
      const ballotsRef = collection(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes', vote.id, 'ballots');
      const ballotsSnap = await getDocs(ballotsRef);
      const ballots = ballotsSnap.docs.map((d) => d.data() as Ballot);

      if (ballots.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Aucun bulletin',
          description: "Impossible de clore un scrutin sans votes.",
        });
        return;
      }

      const results = computeSchulzeResults(vote.projectIds, ballots);

      const voteRef = doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes', vote.id);
      const assemblyRef = doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID);
      const publicResultRef = doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'public', 'lastResult');

      // Hash stable: exclude server timestamps from canonical data
      const canonicalForHash = {
        method: 'schulze',
        voteId: vote.id,
        projectIds: vote.projectIds,
        total: ballots.length,
        winnerId: results.winnerId,
        fullRanking: results.ranking,
      };

      const resultsHash = await sha256Hex(JSON.stringify(canonicalForHash));

      const resultsData = {
        method: 'schulze' as const,
        computedBy: user?.uid ?? null,
        resultsHash,
        winnerId: results.winnerId,
        fullRanking: results.ranking,
        computedAt: serverTimestamp(),
        total: ballots.length,
      };

      const batch = writeBatch(db);

      batch.update(voteRef, {
        state: 'locked',
        results: resultsData,
        lockedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.update(assemblyRef, {
        state: 'locked',
        activeVoteId: null,
        updatedAt: serverTimestamp(),
      });

      batch.set(
        publicResultRef,
        {
          ...resultsData,
          voteId: vote.id,
          voteTitle: vote.question,
          closedAt: serverTimestamp(),
          lockedAt: serverTimestamp(),
          winnerLabel: projectsById.get(String(results.winnerId))?.title || 'Vainqueur',
        },
        { merge: true }
      );

      await batch.commit();
      toast({ title: 'Résultats publiés', description: 'Le vainqueur a été déterminé.' });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Erreur', description: 'Échec du dépouillement.' });
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <div className="flex justify-between items-end">
        <div className="space-y-2">
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted-foreground block">
            Console
          </span>
          <h1 className="text-4xl font-bold">Administration</h1>
        </div>

        <Button
          onClick={() => setIsSessionModalOpen(true)}
          className="rounded-none font-bold uppercase tracking-widest text-xs gap-2 h-12 px-8"
        >
          <Plus className="h-4 w-4" /> Nouvelle Session
        </Button>
      </div>

      <Tabs defaultValue="sessions">
        <TabsList className="rounded-none bg-transparent border-b h-auto p-0 gap-8 mb-8 w-full justify-start overflow-x-auto no-scrollbar">
          <TabsTrigger
            value="sessions"
            className="px-0 py-4 font-bold uppercase tracking-widest text-[11px] data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none flex items-center gap-2"
          >
            <Activity className="h-3 w-3" /> Sessions
          </TabsTrigger>

          <TabsTrigger
            value="projects"
            className="px-0 py-4 font-bold uppercase tracking-widest text-[11px] data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none flex items-center gap-2"
          >
            <Settings className="h-3 w-3" /> Projets
          </TabsTrigger>

          <TabsTrigger
            value="members"
            className="px-0 py-4 font-bold uppercase tracking-widest text-[11px] data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none flex items-center gap-2"
          >
            <Users className="h-3 w-3" /> Membres
          </TabsTrigger>

          <TabsTrigger
            value="results"
            className="px-0 py-4 font-bold uppercase tracking-widest text-[11px] data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none flex items-center gap-2"
          >
            <BarChart3 className="h-3 w-3" /> Résultats
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-6">
          <ActiveVoteCockpit assemblyId={DEFAULT_ASSEMBLY_ID} activeVote={activeVote} members={members || []} />

          <div className="space-y-4 p-4 border bg-secondary/30">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                {(Object.keys(filterLabels) as Array<keyof typeof filterLabels>).map((state) => (
                  <Button
                    key={state}
                    variant={filterState === state ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterState(state)}
                    className="capitalize rounded-none h-9 px-4"
                  >
                    {filterLabels[state]}
                  </Button>
                ))}
              </div>

              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par question, id, gagnant..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 rounded-none h-9"
                />
              </div>
            </div>
          </div>

          {filteredAndSortedVotes.map((v) => (
            <VoteRow
              key={v.id}
              assemblyId={DEFAULT_ASSEMBLY_ID}
              vote={v}
              isProcessing={isProcessing === v.id}
              onOpen={handleOpenVote}
              onPublish={handlePublishResults}
              projectsById={projectsById}
              members={members || []}
            />
          ))}
        </TabsContent>

        <TabsContent value="results" className="space-y-8">
          {(votes ?? [])
            .filter((v) => v.state === 'locked' && !!v.results?.computedAt)
            .sort((a, b) => {
              const da = (a.results?.computedAt as any)?.toMillis?.() ?? 0;
              const dbb = (b.results?.computedAt as any)?.toMillis?.() ?? 0;
              return dbb - da;
            })
            .map((v) => {
              const totalBallots = (v.results as any)?.total ?? (v.results as any)?.totalBallots ?? 0;
              const eligible = v.eligibleCountAtOpen ?? null;
              const participationPct =
                eligible && eligible > 0 ? Math.round((100 * totalBallots) / eligible) : null;

              const quorumPct = (v as any).quorumPct ?? 0;
              const isValid = participationPct !== null ? participationPct >= quorumPct : null;

              const winnerTitle =
                projectsById.get(v.results?.winnerId ?? '')?.title ||
                (v.results?.winnerId ? String(v.results?.winnerId) : '—');

              const computedAtFormatted =
                (v.results as any)?.computedAt?.toDate
                  ? (v.results as any).computedAt.toDate().toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—';

              return (
                <div key={v.id} className="p-8 border bg-white space-y-8">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 border-b pb-6">
                    <div className="space-y-2">
                      <Badge className="bg-black text-white rounded-none uppercase text-[9px]">Scrutin clôturé</Badge>
                      <h3 className="text-2xl font-bold leading-tight">{v.question}</h3>

                      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[10px] uppercase font-bold tracking-widest text-muted-foreground pt-2">
                        <span>PV : {computedAtFormatted}</span>
                        <span>Éligibles : {eligible ?? '—'}</span>
                        <span>Bulletins : {totalBallots}</span>
                        <span>Participation : {participationPct !== null ? `${participationPct}%` : '—'}</span>
                        <span>Quorum : {quorumPct}%</span>
                        <span>
                          Validité :{' '}
                          {isValid === null ? (
                            '—'
                          ) : isValid ? (
                            <span className="text-green-700">Valide</span>
                          ) : (
                            <span className="text-red-700">Invalide</span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Link href={`/results/${v.id}`}>
                        <Button
                          variant="outline"
                          className="rounded-none font-bold uppercase tracking-widest text-[10px] h-10 px-6"
                        >
                          Voir PV
                        </Button>
                      </Link>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-4">
                      <p className="text-[10px] uppercase font-bold tracking-widest text-primary">Vainqueur</p>
                      <p className="text-2xl font-black uppercase text-primary">{winnerTitle}</p>
                    </div>

                    <div className="space-y-4">
                      <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                        Classement (top 5)
                      </p>

                      <div className="space-y-2">
                        {(v.results?.fullRanking ?? []).slice(0, 5).map((r: any, idx: number) => (
                          <div
                            key={r.id}
                            className="flex justify-between items-center text-sm border-b border-secondary pb-2"
                          >
                            <span className="font-bold flex items-center gap-3">
                              <span className="w-6 h-6 flex items-center justify-center bg-secondary text-[10px] font-black">
                                {idx + 1}
                              </span>
                              {projectsById.get(r.id)?.title ?? r.id}
                            </span>
                            <span className="text-muted-foreground font-mono text-xs">{r.score ?? r.rank ?? '—'}</span>
                          </div>
                        ))}
                      </div>

                      {((v.results?.fullRanking ?? []).length ?? 0) > 5 && (
                        <p className="text-[10px] text-muted-foreground italic pt-2">
                          Voir le PV pour le classement complet.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
        </TabsContent>

        <TabsContent value="projects" className="space-y-4">
          {(projects ?? []).map((p) => (
            <div key={p.id} className="p-6 border bg-white flex justify-between items-center">
              <div>
                <Badge variant="outline" className="mb-2 uppercase text-[9px]">
                  {p.status}
                </Badge>
                <h3 className="text-lg font-bold">{p.title}</h3>
                <p className="text-xs text-muted-foreground">{p.budget}</p>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateDoc(doc(db, 'projects', p.id), { status: 'candidate' })}
                  className="rounded-none font-bold uppercase text-[9px]"
                >
                  Candidat
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateDoc(doc(db, 'projects', p.id), { status: 'rejected' })}
                  className="rounded-none font-bold text-destructive uppercase text-[9px]"
                >
                  Rejeter
                </Button>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="members" className="space-y-6">
          <div className="flex justify-end">
            <Link href="/admin/members">
              <Button
                variant="outline"
                className="rounded-none font-bold uppercase tracking-widest text-[10px] h-10 px-6 gap-2"
              >
                <Users className="h-3.5 w-3.5" /> Ouvrir le gestionnaire des membres
              </Button>
            </Link>
          </div>

          <div className="bg-white border">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/20">
                  <TableHead className="uppercase text-[10px] font-bold">Email</TableHead>
                  <TableHead className="uppercase text-[10px] font-bold">Rôle</TableHead>
                  <TableHead className="uppercase text-[10px] font-bold">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(members ?? []).map((m) => (
                  <TableRow key={(m as any).id ?? (m as any).uid ?? m.email}>
                    <TableCell>{m.email}</TableCell>
                    <TableCell className="capitalize">{(m as any).role}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          (m as any).status === 'active'
                            ? 'bg-green-600/10 text-green-600 border-none rounded-none'
                            : 'bg-orange-500/10 text-orange-500 border-none rounded-none'
                        }
                      >
                        {(m as any).status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <CreateSessionModal
        isOpen={isSessionModalOpen}
        onClose={() => setIsSessionModalOpen(false)}
        availableProjects={(projects ?? []).filter((p) => p.status === 'candidate')}
      />
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequireActiveMember>
      <MainLayout statusText="Admin">
        <AdminContent />
      </MainLayout>
    </RequireActiveMember>
  );
}