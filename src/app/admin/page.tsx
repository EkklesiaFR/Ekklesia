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
import { Plus, ShieldAlert, Trophy, Settings, Users, Activity, Lock, Play } from 'lucide-react';
import { Project, MemberProfile, Vote, Ballot } from '@/types';
import { CreateSessionModal } from '@/components/admin/CreateSessionModal';
import { toast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { computeSchulzeResults } from '@/lib/tally';

function AdminContent() {
  const db = useFirestore();
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const votesQuery = useMemoFirebase(() => query(collection(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes'), orderBy('createdAt', 'desc')), [db]);
  const { data: votes } = useCollection<Vote>(votesQuery);

  const projectsQuery = useMemoFirebase(() => query(collection(db, 'projects'), orderBy('createdAt', 'desc')), [db]);
  const { data: projects } = useCollection<Project>(projectsQuery);

  const membersQuery = useMemoFirebase(() => collection(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'members'), [db]);
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
        closedAt: serverTimestamp()
      });

      await batch.commit();
      toast({ title: "Résultats publiés", description: "Le vainqueur a été déterminé via la méthode de Schulze." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur", description: "Échec du dépouillement." });
    } finally {
      setIsProcessing(null);
    }
  };

  const handleProjectStatus = async (projectId: string, newStatus: Project['status']) => {
    try {
      await updateDoc(doc(db, 'projects', projectId), { status: newStatus, updatedAt: serverTimestamp() });
      toast({ title: "Statut mis à jour" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur" });
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
          <TabsTrigger value="results" className="px-0 py-4 font-bold uppercase tracking-widest text-[11px] data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none flex items-center gap-2"><Trophy className="h-3 w-3" /> Résultats</TabsTrigger>
          <TabsTrigger value="projects" className="px-0 py-4 font-bold uppercase tracking-widest text-[11px] data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none flex items-center gap-2"><Settings className="h-3 w-3" /> Projets</TabsTrigger>
          <TabsTrigger value="members" className="px-0 py-4 font-bold uppercase tracking-widest text-[11px] data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none flex items-center gap-2"><Users className="h-3 w-3" /> Membres</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-6">
          {votes?.map(v => (
            <div key={v.id} className="p-8 border bg-white flex justify-between items-center group hover:border-black transition-all">
              <div className="space-y-3">
                <Badge className="bg-black text-white rounded-none uppercase text-[9px] tracking-widest px-2 py-0.5">{v.state}</Badge>
                <h3 className="text-xl font-bold">{v.question}</h3>
              </div>
              {v.state === 'draft' && (
                <Button 
                  onClick={() => handleOpenVote(v.id)} 
                  disabled={isProcessing === v.id}
                  className="rounded-none font-bold uppercase tracking-widest text-[10px] gap-2"
                >
                  <Play className="h-3.5 w-3.5" /> Ouvrir le vote
                </Button>
              )}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          {votes?.filter(v => v.state !== 'draft').map(v => (
            <div key={v.id} className="p-8 border bg-white flex justify-between items-center group hover:border-black transition-all">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Badge className={v.state === 'open' ? "bg-green-600" : "bg-black"}>{v.state}</Badge>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">{v.ballotCount || 0} bulletins</span>
                </div>
                <h3 className="text-xl font-bold">{v.question}</h3>
              </div>
              {v.state === 'open' ? (
                <Button 
                  variant="outline" 
                  onClick={() => handlePublishResults(v)} 
                  disabled={isProcessing === v.id}
                  className="rounded-none border-2 border-black font-bold uppercase tracking-widest text-[10px] gap-2 h-12 px-6"
                >
                  <Lock className="h-3.5 w-3.5" /> Clôturer & Publier
                </Button>
              ) : (
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-primary mb-1">Gagnant</p>
                  <p className="font-bold">{projects?.find(p => p.id === v.results?.winnerId)?.title || '—'}</p>
                </div>
              )}
            </div>
          ))}
        </TabsContent>

        <TabsContent value="projects" className="space-y-6">
          {projects?.map(p => (
            <div key={p.id} className="p-8 border bg-white flex justify-between items-center group hover:border-black transition-all">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="rounded-none uppercase text-[9px]">{p.status}</Badge>
                  <span className="text-[10px] font-bold text-muted-foreground">{p.budget}</span>
                </div>
                <h3 className="text-lg font-bold">{p.title}</h3>
              </div>
              <div className="flex gap-4">
                <Button size="sm" variant="outline" onClick={() => handleProjectStatus(p.id, 'candidate')} className="rounded-none font-bold text-green-600 border-green-100 hover:bg-green-50 uppercase text-[9px]">Candidat</Button>
                <Button size="sm" variant="outline" onClick={() => handleProjectStatus(p.id, 'rejected')} className="rounded-none font-bold text-destructive border-destructive/20 hover:bg-destructive/5 uppercase text-[9px]">Rejeter</Button>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="members" className="bg-white border">
          <Table>
            <TableHeader><TableRow className="bg-secondary/20"><TableHead className="uppercase text-[10px] font-bold">Email</TableHead><TableHead className="uppercase text-[10px] font-bold">Rôle</TableHead><TableHead className="uppercase text-[10px] font-bold">Statut</TableHead></TableRow></TableHeader>
            <TableBody>
              {members?.map(m => (
                <TableRow key={m.id} className="hover:bg-secondary/5">
                  <TableCell className="font-medium">{m.email}</TableCell>
                  <TableCell className="capitalize">{m.role}</TableCell>
                  <TableCell><Badge className={m.status === 'active' ? "bg-green-600/10 text-green-600 border-none rounded-none" : "bg-orange-500/10 text-orange-500 border-none rounded-none"}>{m.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
  const { isAdmin, isMemberLoading } = useAuthStatus();
  return (
    <RequireActiveMember>
      <MainLayout statusText="Admin">
        {!isMemberLoading && isAdmin ? <AdminContent /> : <div className="py-24 text-center"><ShieldAlert className="mx-auto h-20 w-20 text-destructive opacity-10" /><p className="font-bold uppercase tracking-widest text-muted-foreground mt-6">Accès Réservé</p></div>}
      </MainLayout>
    </RequireActiveMember>
  );
}