'use client';

import { useState } from 'react';
import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useAuthStatus } from '@/components/auth/AuthStatusProvider';
import { DEFAULT_ASSEMBLY_ID } from '@/config/assembly';
import { 
  collection, 
  query, 
  orderBy,
  doc,
  serverTimestamp,
  updateDoc,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, BarChart3, Settings, Users, Activity, Lock, Play } from 'lucide-react';
import { Project, MemberProfile, Vote, Ballot } from '@/types';
import { CreateSessionModal } from '@/components/admin/CreateSessionModal';
import { toast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { computeSchulzeResults } from '@/lib/tally';
import Link from 'next/link';

function AdminContent() {
  const db = useFirestore();
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const votesQuery = useMemoFirebase(() => query(collection(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes'), orderBy('createdAt', 'desc')), [db]);
  const { data: votes } = useCollection<Vote>(votesQuery);

  const projectsQuery = useMemoFirebase(() => query(collection(db, 'projects'), orderBy('createdAt', 'desc')), [db]);
  const { data: projects } = useCollection<Project>(projectsQuery);

  const membersQuery = useMemoFirebase(() => collection(db, 'members'), [db]);
  const { data: members } = useCollection<MemberProfile>(membersQuery);

  const handleOpenVote = async (voteId: string) => {
    setIsProcessing(voteId);
    try {
      const voteRef = doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes', voteId);
      const assemblyRef = doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID);
      
      const batch = writeBatch(db);
      batch.update(voteRef, { state: 'open', updatedAt: serverTimestamp() });
      batch.update(assemblyRef, { state: 'open', activeVoteId: voteId, updatedAt: serverTimestamp() });
      
      await batch.commit();
      toast({ title: "Scrutin ouvert", description: "Les membres peuvent maintenant voter." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible d'ouvrir le vote." });
    } finally {
      setIsProcessing(null);
    }
  };

  const handlePublishResults = async (vote: Vote) => {
    setIsProcessing(vote.id);
    try {
      const ballotsRef = collection(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes', vote.id, 'ballots');
      const ballotsSnap = await getDocs(ballotsRef);
      const ballots = ballotsSnap.docs.map(d => d.data() as Ballot);

      if (ballots.length === 0) {
        toast({ variant: "destructive", title: "Aucun bulletin", description: "Impossible de clore un scrutin sans votes." });
        return;
      }

      const results = computeSchulzeResults(vote.projectIds, ballots);
      const voteRef = doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes', vote.id);
      const assemblyRef = doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID);
      const publicResultRef = doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'public', 'lastResult');

      const batch = writeBatch(db);
      
      const resultsData = {
        winnerId: results.winnerId,
        fullRanking: results.ranking,
        computedAt: serverTimestamp(),
        total: ballots.length
      };

      batch.update(voteRef, { 
        state: 'locked', 
        results: resultsData,
        updatedAt: serverTimestamp() 
      });

      batch.update(assemblyRef, { 
        state: 'locked', 
        activeVoteId: null,
        updatedAt: serverTimestamp() 
      });

      batch.set(publicResultRef, {
        ...resultsData,
        voteId: vote.id,
        voteTitle: vote.question,
        closedAt: serverTimestamp(),
        totalBallots: ballots.length,
        winnerLabel: projects?.find(p => p.id === results.winnerId)?.title || "Vainqueur"
      });

      await batch.commit();
      toast({ title: "Résultats publiés", description: "Le vainqueur a été déterminé." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur", description: "Échec du dépouillement." });
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
          <TabsTrigger value="sessions" className="px-0 py-4 font-bold uppercase tracking-widest text-[11px] data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none flex items-center gap-2"><Activity className="h-3 w-3" /> Sessions</TabsTrigger>
          <TabsTrigger value="projects" className="px-0 py-4 font-bold uppercase tracking-widest text-[11px] data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none flex items-center gap-2"><Settings className="h-3 w-3" /> Projets</TabsTrigger>
          <TabsTrigger value="members" className="px-0 py-4 font-bold uppercase tracking-widest text-[11px] data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none flex items-center gap-2"><Users className="h-3 w-3" /> Membres</TabsTrigger>
          <TabsTrigger value="results" className="px-0 py-4 font-bold uppercase tracking-widest text-[11px] data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none flex items-center gap-2"><BarChart3 className="h-3 w-3" /> Résultats</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-6">
          {votes?.map(v => (
            <div key={v.id} className="p-8 border bg-white flex justify-between items-center group hover:border-black transition-all">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Badge className={v.state === 'open' ? "bg-green-600" : "bg-black"}>{v.state}</Badge>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">{v.ballotCount || 0} bulletins</span>
                </div>
                <h3 className="text-xl font-bold">{v.question}</h3>
              </div>
              <div className="flex gap-4">
                {v.state === 'draft' && (
                  <Button onClick={() => handleOpenVote(v.id)} disabled={isProcessing === v.id} className="rounded-none font-bold uppercase tracking-widest text-[10px] gap-2 h-12 px-6">
                    <Play className="h-3.5 w-3.5" /> Ouvrir
                  </Button>
                )}
                {v.state === 'open' && (
                  <Button variant="outline" onClick={() => handlePublishResults(v)} disabled={isProcessing === v.id} className="rounded-none border-2 border-black font-bold uppercase tracking-widest text-[10px] gap-2 h-12 px-6">
                    <Lock className="h-3.5 w-3.5" /> Clôturer & Publier
                  </Button>
                )}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="results" className="space-y-8">
          {votes?.filter(v => v.state === 'locked').map(v => (
            <div key={v.id} className="p-8 border bg-white space-y-8">
              <div className="flex justify-between items-start border-b pb-6">
                <div>
                  <Badge className="bg-black text-white rounded-none uppercase text-[9px]">PV Certifié</Badge>
                  <h3 className="text-2xl font-bold">{v.question}</h3>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Participation</p>
                  <p className="text-2xl font-black">{v.results?.total || 0}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-4">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-primary">Vainqueur</p>
                  <p className="text-2xl font-black uppercase text-primary">
                    {projects?.find(p => p.id === v.results?.winnerId)?.title || '—'}
                  </p>
                </div>
                <div className="space-y-4">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Classement complet</p>
                  <div className="space-y-2">
                    {v.results?.fullRanking?.map((r: any, idx) => (
                      <div key={r.id} className="flex justify-between items-center text-sm border-b border-secondary pb-2">
                        <span className="font-bold flex items-center gap-3">
                          <span className="w-5 h-5 flex items-center justify-center bg-secondary text-[10px]">{idx + 1}</span>
                          {projects?.find(p => p.id === r.id)?.title}
                        </span>
                        <span className="text-muted-foreground font-mono text-xs">{r.score} victoires</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="projects" className="space-y-4">
          {projects?.map(p => (
            <div key={p.id} className="p-6 border bg-white flex justify-between items-center">
              <div>
                <Badge variant="outline" className="mb-2 uppercase text-[9px]">{p.status}</Badge>
                <h3 className="text-lg font-bold">{p.title}</h3>
                <p className="text-xs text-muted-foreground">{p.budget}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => updateDoc(doc(db, 'projects', p.id), { status: 'candidate' })} className="rounded-none font-bold uppercase text-[9px]">Candidat</Button>
                <Button size="sm" variant="outline" onClick={() => updateDoc(doc(db, 'projects', p.id), { status: 'rejected' })} className="rounded-none font-bold text-destructive uppercase text-[9px]">Rejeter</Button>
              </div>
            </div>
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
              <TableHeader><TableRow className="bg-secondary/20"><TableHead className="uppercase text-[10px] font-bold">Email</TableHead><TableHead className="uppercase text-[10px] font-bold">Rôle</TableHead><TableHead className="uppercase text-[10px] font-bold">Statut</TableHead></TableRow></TableHeader>
              <TableBody>
                {members?.map(m => (
                  <TableRow key={m.id}><TableCell>{m.email}</TableCell><TableCell className="capitalize">{m.role}</TableCell><TableCell><Badge className={m.status === 'active' ? "bg-green-600/10 text-green-600 border-none rounded-none" : "bg-orange-500/10 text-orange-500 border-none rounded-none"}>{m.status}</Badge></TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <CreateSessionModal 
        isOpen={isSessionModalOpen} 
        onClose={() => setIsSessionModalOpen(false)} 
        availableProjects={projects?.filter(p => p.status === 'candidate') || []}
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
