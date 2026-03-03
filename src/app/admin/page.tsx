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

function memberKey(member: MemberProfile): string | undefined {
  const m = member as unknown as { id?: string; uid?: string };
  return m.id ?? m.uid;
}

/**
 * v0.4.3: Secure hex digest using Web Crypto.
 * Keys are strictly sorted to match Node.js implementation.
 */
async function sha256HexDeterministic(payload: any): Promise<string> {
  const sortedKeys = Object.keys(payload).sort();
  const sortedPayload: any = {};
  sortedKeys.forEach(k => sortedPayload[k] = payload[k]);
  
  const text = JSON.stringify(sortedPayload);
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

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

  const openedByDisplay = activeVote.openedBy || '—';

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

        <div className="space-y-1 md:col-span-1">
          <p className="text-[10px] uppercase font-bold text-muted-foreground">ID Ouverture</p>
          <p className="font-mono text-xs truncate">{openedByDisplay}</p>
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

  const quorumPct = (vote as any).quorumPct ?? 0;
  const isValid = participation !== null ? participation >= quorumPct : null;

  const stateBadgeClass =
    {
      draft: 'bg-gray-400 text-white',
      open: 'bg-green-600 text-white',
      locked: 'bg-black text-white',
    }[vote.state] ?? 'bg-black text-white';

  const winnerId = vote.state === 'locked' ? vote.results?.winnerId : null;
  const winnerProject = winnerId ? projectsById.get(String(winnerId)) : null;
  const winnerDisplay = winnerProject?.title ?? winnerId;

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
              {isLoading ? '...' : ballotCount}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Participation</p>
            <p className="font-bold text-lg">{participation !== null ? `${participation}%` : '—'}</p>
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

          {winnerId && (
            <div className="space-y-1 col-span-1">
              <p className="text-[10px] uppercase font-bold text-primary">Gagnant</p>
              <p className="font-bold text-primary truncate">{winnerDisplay}</p>
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

  const filteredAndSortedVotes = useMemo(() => {
    if (!votes) return [];
    const stateOrder: Record<Vote['state'], number> = { open: 1, draft: 2, locked: 3 };
    const q = searchQuery.toLowerCase().trim();

    return votes
      .filter((vote) => {
        if (filterState !== 'all' && vote.state !== filterState) return false;
        if (!q) return true;
        return vote.question.toLowerCase().includes(q) || vote.id.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (stateOrder[a.state] !== stateOrder[b.state]) return stateOrder[a.state] - stateOrder[b.state];
        const dateA = a.openedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
        const dateB = b.openedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
        return dateB - dateA;
      });
  }, [votes, filterState, searchQuery]);

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
      toast({ title: 'Scrutin ouvert' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur' });
    } finally {
      setIsProcessing(null);
    }
  };

  const handlePublishResults = async (vote: Vote) => {
    setIsProcessing(vote.id);
    try {
      const ballotsRef = collection(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes', vote.id, 'ballots');
      const ballotsSnap = await getDocs(ballotsRef);
      const ballots = ballotsSnap.docs.map((d) => d.data() as Ballot);

      if (ballots.length === 0) {
        toast({ variant: 'destructive', title: 'Aucun bulletin' });
        return;
      }

      const results = computeSchulzeResults(vote.projectIds, ballots);

      // v0.4.3: Build canonical deterministic hash
      const canonicalForHash = {
        ballotsCount: ballots.length,
        fullRanking: results.ranking,
        method: 'schulze',
        projectIds: [...vote.projectIds].sort(),
        v: 2,
        voteId: vote.id,
        winnerId: results.winnerId,
      };

      const resultsHash = await sha256HexDeterministic(canonicalForHash);

      const resultsData = {
        method: 'schulze',
        computedBy: user?.uid ?? null,
        resultsHash,
        winnerId: results.winnerId,
        fullRanking: results.ranking,
        computedAt: serverTimestamp(),
        total: ballots.length,
      };

      const batch = writeBatch(db);
      batch.update(doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes', vote.id), {
        state: 'locked',
        results: resultsData,
        lockedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID), {
        state: 'locked',
        activeVoteId: null,
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'public', 'lastResult'), {
        ...resultsData,
        voteId: vote.id,
        voteTitle: vote.question,
        closedAt: serverTimestamp(),
        winnerLabel: projectsById.get(String(results.winnerId))?.title || 'Vainqueur',
      }, { merge: true });

      await batch.commit();
      toast({ title: 'Résultats publiés' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur de dépouillement' });
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <div className="flex justify-between items-end">
        <div className="space-y-2">
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted-foreground block">Console</span>
          <h1 className="text-4xl font-bold">Administration</h1>
        </div>
        <Button onClick={() => setIsSessionModalOpen(true)} className="rounded-none font-bold uppercase tracking-widest text-xs gap-2 h-12 px-8">
          <Plus className="h-4 w-4" /> Nouvelle Session
        </Button>
      </div>

      <Tabs defaultValue="sessions">
        <TabsList className="rounded-none bg-transparent border-b h-auto p-0 gap-8 mb-8 w-full justify-start overflow-x-auto no-scrollbar">
          <TabsTrigger value="sessions" className="px-0 py-4 font-bold uppercase tracking-widest text-[11px] data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none flex items-center gap-2">
            <Activity className="h-3 w-3" /> Sessions
          </TabsTrigger>
          <TabsTrigger value="projects" className="px-0 py-4 font-bold uppercase tracking-widest text-[11px] data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none flex items-center gap-2">
            <Settings className="h-3 w-3" /> Projets
          </TabsTrigger>
          <TabsTrigger value="members" className="px-0 py-4 font-bold uppercase tracking-widest text-[11px] data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none flex items-center gap-2">
            <Users className="h-3 w-3" /> Membres
          </TabsTrigger>
          <TabsTrigger value="results" className="px-0 py-4 font-bold uppercase tracking-widest text-[11px] data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none flex items-center gap-2">
            <BarChart3 className="h-3 w-3" /> Résultats
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-6">
          <ActiveVoteCockpit assemblyId={DEFAULT_ASSEMBLY_ID} activeVote={activeVote} members={members || []} />
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher par question..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 rounded-none h-9" />
          </div>
          {filteredAndSortedVotes.map((v) => (
            <VoteRow key={v.id} assemblyId={DEFAULT_ASSEMBLY_ID} vote={v} isProcessing={isProcessing === v.id} onOpen={handleOpenVote} onPublish={handlePublishResults} projectsById={projectsById} members={members || []} />
          ))}
        </TabsContent>

        <TabsContent value="members" className="space-y-6">
          <div className="flex justify-end">
            <Link href="/admin/members">
              <Button variant="outline" className="rounded-none font-bold uppercase tracking-widest text-[10px] h-10 px-6 gap-2">
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
                  <TableRow key={m.id}>
                    <TableCell>{m.email}</TableCell>
                    <TableCell className="capitalize">{m.role}</TableCell>
                    <TableCell>
                      <Badge className={m.status === 'active' ? 'bg-green-600/10 text-green-600 border-none rounded-none' : 'bg-orange-500/10 text-orange-500 border-none rounded-none'}>
                        {m.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <CreateSessionModal isOpen={isSessionModalOpen} onClose={() => setIsSessionModalOpen(false)} availableProjects={(projects ?? []).filter((p) => p.status === 'candidate')} />
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
