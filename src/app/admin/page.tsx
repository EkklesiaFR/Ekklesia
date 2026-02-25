'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { useAuthStatus } from '@/components/auth/AuthStatusProvider';
import { 
  collection, 
  query, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  collectionGroup,
  getDocs,
  getDoc,
  writeBatch,
  limit,
  where,
  deleteField
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Plus, 
  Play, 
  Loader2, 
  MoreHorizontal,
  Database,
  Wrench,
  Trophy,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  FileText,
  PieChart
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Assembly, Vote, Project, MemberProfile, Ballot } from '@/types';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { computeSchulzeResults } from '@/lib/tally';

/**
 * Composant pour afficher les résultats d'une assemblée spécifique
 * Lit le vote directement depuis Firestore via doc(db, 'assemblies', id, 'votes', voteId)
 */
function AssemblyResultItem({ assembly, projects }: { assembly: Assembly; projects: Project[] }) {
  const db = useFirestore();
  const voteRef = useMemoFirebase(() => {
    if (!assembly.activeVoteId) return null;
    return doc(db, 'assemblies', assembly.id, 'votes', assembly.activeVoteId);
  }, [db, assembly.id, assembly.activeVoteId]);
  
  const { data: vote, isLoading } = useDoc<Vote>(voteRef);

  if (isLoading) return (
    <div className="border border-border p-8 bg-white animate-pulse space-y-4">
      <div className="h-8 bg-secondary w-1/3" />
      <div className="h-24 bg-secondary w-full" />
    </div>
  );

  if (!vote || !vote.results) return null;

  const results = vote.results;
  const winner = projects.find(p => p.id === results.winnerId);

  return (
    <div className="border border-border p-8 bg-white space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-1">
          <h3 className="text-2xl font-bold uppercase tracking-tight">{assembly.title}</h3>
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
            Scrutin clos le {results.computedAt?.seconds ? new Date(results.computedAt.seconds * 1000).toLocaleDateString('fr-FR') : '—'}
          </p>
        </div>
        <Badge className="bg-[#7DC092] hover:bg-[#7DC092] rounded-none px-4 py-1 font-bold uppercase tracking-widest text-[10px]">PV Officiel</Badge>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-2">
            <PieChart className="h-3 w-3" /> Participation
          </p>
          <p className="text-xl font-black">{vote.ballotCount || 0} / {vote.eligibleCount || 0}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Taux</p>
          <p className="text-xl font-black">
            {vote.eligibleCount ? Math.round(((vote.ballotCount || 0) / vote.eligibleCount) * 100) : 0}%
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-widest font-bold text-primary">Projet Retenu</p>
          <p className="text-xl font-black uppercase">{winner?.title || results.winnerId || 'Calculé'}</p>
        </div>
      </div>

      <div className="space-y-4 pt-4">
        <h4 className="text-[10px] uppercase tracking-widest font-black text-muted-foreground border-b border-border pb-2 flex items-center gap-2">
          <FileText className="h-3 w-3" /> Classement Schulze
        </h4>
        <div className="space-y-2">
          {results.fullRanking?.map((rankItem) => {
            const project = projects.find(p => p.id === rankItem.id);
            return (
              <div key={rankItem.id} className="flex items-center gap-4 text-sm py-1">
                <span className="w-8 font-black text-muted-foreground">#{rankItem.rank}</span>
                <span className={rankItem.rank === 1 ? "font-bold text-black" : "text-muted-foreground"}>
                  {project?.title || rankItem.id}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AdminContent() {
  const { user } = useUser();
  const db = useFirestore();
  const { isAdmin, member } = useAuthStatus();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);
  const [isConfirmBulkOpen, setIsConfirmBulkOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  
  const [confirmAdminPromote, setConfirmAdminPromote] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newVoteQuestion, setNewVoteQuestion] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  const assembliesQuery = useMemoFirebase(() => query(collection(db, 'assemblies')), [db]);
  const { data: assemblies } = useCollection<Assembly>(assembliesQuery);

  const votesQuery = useMemoFirebase(() => query(collectionGroup(db, 'votes')), [db]);
  const { data: allVotes } = useCollection<Vote>(votesQuery);

  const projectsQuery = useMemoFirebase(() => query(collection(db, 'projects')), [db]);
  const { data: projects } = useCollection<Project>(projectsQuery);

  const membersQuery = useMemoFirebase(() => {
    return query(collection(db, 'members'), limit(150));
  }, [db]);
  const { data: members, error: membersError } = useCollection<MemberProfile>(membersQuery);

  const filteredMembers = members?.filter(m => {
    const matchStatus = statusFilter === 'all' || m.status === statusFilter;
    const matchRole = roleFilter === 'all' || m.role === roleFilter;
    return matchStatus && matchRole;
  }).sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return 0;
  });

  const pendingCount = members?.filter(m => m.status === 'pending').length || 0;
  const openSessionsCount = assemblies?.filter(a => a.state === 'open').length || 0;

  /**
   * Logique atomique de clôture d'un scrutin unique.
   */
  const performVoteTally = async (assemblyId: string, voteId: string) => {
    const voteRef = doc(db, 'assemblies', assemblyId, 'votes', voteId);
    const voteSnap = await getDoc(voteRef);
    
    if (!voteSnap.exists()) throw new Error("Scrutin introuvable.");
    const voteData = voteSnap.data() as Vote;
    
    if (voteData.state !== 'open') {
      return { skipped: true };
    }

    const ballotsRef = collection(db, 'assemblies', assemblyId, 'votes', voteId, 'ballots');
    const ballotsSnap = await getDocs(ballotsRef);
    const ballots = ballotsSnap.docs.map(d => d.data() as Ballot);

    if (ballots.length === 0) {
      throw new Error("Impossible de clôturer sans aucun bulletin.");
    }

    const results = computeSchulzeResults(voteData.projectIds, ballots);

    const batch = writeBatch(db);
    const assemblyRef = doc(db, 'assemblies', assemblyId);

    batch.update(voteRef, {
      results: {
        winnerId: results.winnerId,
        fullRanking: results.ranking,
        computedAt: serverTimestamp(),
        total: ballots.length
      },
      ballotCount: ballots.length,
      state: 'locked',
      lockedAt: serverTimestamp(),
      closedAt: serverTimestamp(),
      publishedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    batch.update(assemblyRef, {
      state: 'locked',
      updatedAt: serverTimestamp()
    });

    await batch.commit();
    return { winnerId: results.winnerId, ballotCount: ballots.length };
  };

  const handleTallyAndPublish = async (assemblyId: string, voteId: string) => {
    console.log(`[CLOSE] Initiation`, { assemblyId, voteId, uid: user?.uid, isAdmin, memberStatus: member?.status });
    
    if (!isAdmin || member?.status !== 'active') {
      toast({ variant: "destructive", title: "Accès refusé", description: "Votre compte admin doit être 'actif' pour clôturer." });
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      const result = await performVoteTally(assemblyId, voteId);
      if (result.skipped) {
        toast({ title: "Déjà clôturé" });
      } else {
        toast({ title: "Scrutin clôturé", description: "Les résultats ont été publiés." });
      }
    } catch (e: any) {
      console.error(`[CLOSE] Exception: ${e.code || 'UNKNOWN'} ${e.message}`);
      toast({ variant: "destructive", title: "Erreur de clôture", description: e.message || "Impossible de verrouiller le scrutin." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const bulkCloseOpenVotes = async () => {
    if (!isAdmin || member?.status !== 'active') return;
    setIsBulkSubmitting(true);
    let successCount = 0;
    let failCount = 0;

    try {
      const q = query(collectionGroup(db, 'votes'), where('state', '==', 'open'));
      const snapshot = await getDocs(q);

      for (const voteDoc of snapshot.docs) {
        const voteData = voteDoc.data() as Vote;
        const assemblyId = voteData.assemblyId;
        const voteId = voteDoc.id;

        try {
          const result = await performVoteTally(assemblyId, voteId);
          if (!result.skipped) successCount++;
        } catch (e: any) {
          failCount++;
        }
      }

      toast({ title: "Opération terminée", description: `${successCount} votes clôturés, ${failCount} échecs.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur globale", description: e.message });
    } finally {
      setIsBulkSubmitting(false);
      setIsConfirmBulkOpen(false);
    }
  };

  const handleCreateSession = async () => {
    if (!newSessionTitle || !newVoteQuestion || selectedProjectIds.length < 2 || !user) {
      toast({ variant: "destructive", title: "Champs manquants" });
      return;
    }
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      const assemblyRef = doc(collection(db, 'assemblies'));
      const voteRef = doc(collection(db, 'assemblies', assemblyRef.id, 'votes'));
      
      batch.set(assemblyRef, {
        id: assemblyRef.id,
        title: newSessionTitle,
        state: 'draft',
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        activeVoteId: voteRef.id,
      });
      
      batch.set(voteRef, {
        id: voteRef.id,
        assemblyId: assemblyRef.id,
        question: newVoteQuestion,
        projectIds: selectedProjectIds,
        state: 'draft',
        ballotCount: 0,
        eligibleCount: 0,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });
      
      await batch.commit();
      toast({ title: "Session créée" });
      setIsDialogOpen(false);
      resetForm();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecalculateBallots = async (assemblyId: string, voteId: string) => {
    setIsSubmitting(true);
    try {
      const ballotsSnap = await getDocs(collection(db, 'assemblies', assemblyId, 'votes', voteId, 'ballots'));
      await updateDoc(doc(db, 'assemblies', assemblyId, 'votes', voteId), {
        ballotCount: ballotsSnap.size,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Compteur synchronisé" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateSessionState = async (assemblyId: string, newState: 'open' | 'locked') => {
    try {
      setIsSubmitting(true);
      const assemblyRef = doc(db, 'assemblies', assemblyId);
      const votesSnap = await getDocs(collection(db, 'assemblies', assemblyId, 'votes'));
      if (votesSnap.empty) return;
      const voteDoc = votesSnap.docs[0];
      const batch = writeBatch(db);

      if (newState === 'open') {
        const activeMembersSnap = await getDocs(query(collection(db, 'members'), where('status', '==', 'active')));
        const eligibleCount = activeMembersSnap.size;

        batch.update(voteDoc.ref, { 
          state: newState, 
          eligibleCount: eligibleCount,
          openedAt: serverTimestamp(),
          updatedAt: serverTimestamp() 
        });
      } else {
        batch.update(voteDoc.ref, { state: newState, updatedAt: serverTimestamp() });
      }

      batch.update(assemblyRef, { 
        state: newState, 
        activeVoteId: newState === 'open' ? voteDoc.id : (assemblyRef as any).activeVoteId, 
        updatedAt: serverTimestamp() 
      });

      await batch.commit();
      toast({ title: `Session ${newState === 'open' ? 'ouverte' : 'verrouillée'}` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateMemberStatus = async (uid: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'members', uid), { status: newStatus, updatedAt: serverTimestamp() });
      toast({ title: "Statut mis à jour" });
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); }
  };

  const updateMemberRole = async (uid: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'members', uid), { role: newRole, updatedAt: serverTimestamp() });
      toast({ title: "Rôle mis à jour" });
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); }
  };

  const handleRepairMembers = async () => {
    setIsRepairing(true);
    try {
      const snapshot = await getDocs(collection(db, 'members'));
      const batch = writeBatch(db);
      snapshot.docs.forEach(memberDoc => {
        const data = memberDoc.data();
        if (!data.id || !data.email || !data.status || data.statut) {
          batch.update(memberDoc.ref, { 
            id: memberDoc.id, 
            status: data.status || data.statut || "pending", 
            statut: deleteField(),
            updatedAt: serverTimestamp() 
          });
        }
      });
      await batch.commit();
      toast({ title: "Réparation terminée" });
    } catch (e: any) { toast({ variant: "destructive", title: "Erreur" }); } finally { setIsRepairing(false); }
  };

  const generateDemoProjects = async () => {
    if (!user) return;
    setIsGenerating(true);
    const demoData = [
      { title: "Pistes cyclables sécurisées", summary: "Aménagement de voies réservées aux vélos.", budget: "45 000 €", imageUrl: PlaceHolderImages[4].imageUrl },
      { title: "Rénovation de l'école primaire", summary: "Isolation thermique et modernisation.", budget: "120 000 €", imageUrl: PlaceHolderImages[1].imageUrl }
    ];
    try {
      for (const item of demoData) {
        await addDoc(collection(db, 'projects'), { ...item, status: "candidate", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ownerUid: user.uid });
      }
      toast({ title: "Projets générés" });
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); } finally { setIsGenerating(false); }
  };

  const resetForm = () => {
    setNewSessionTitle('');
    setNewVoteQuestion('');
    setSelectedProjectIds([]);
  };

  const getStatusBadge = (state: string) => {
    switch (state) {
      case 'open': return <Badge className="bg-[#7DC092] hover:bg-[#7DC092]">Ouvert</Badge>;
      case 'locked': return <Badge variant="secondary">Verrouillé</Badge>;
      case 'active': return <Badge className="bg-green-100 text-green-700 border-green-200">Actif</Badge>;
      case 'pending': return <Badge variant="outline" className="border-orange-500 text-orange-500 font-bold">En attente</Badge>;
      default: return <Badge variant="outline">Brouillon</Badge>;
    }
  };

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <h1 className="text-4xl font-bold">Administration</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-none h-12 px-6 font-bold uppercase tracking-widest text-xs gap-2">
              <Plus className="h-4 w-4" /> Créer une session
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-none p-8">
            <DialogHeader><DialogTitle className="text-2xl font-bold uppercase tracking-tight">Nouvelle Session</DialogTitle></DialogHeader>
            <div className="space-y-8 py-6">
              <div className="space-y-4">
                <Label htmlFor="title" className="text-xs uppercase font-black tracking-widest text-muted-foreground">Titre</Label>
                <Input id="title" value={newSessionTitle} onChange={(e) => setNewSessionTitle(e.target.value)} className="rounded-none h-12" />
              </div>
              <div className="space-y-4">
                <Label htmlFor="question" className="text-xs uppercase font-black tracking-widest text-muted-foreground">Question</Label>
                <Input id="question" value={newVoteQuestion} onChange={(e) => setNewVoteQuestion(e.target.value)} className="rounded-none h-12" />
              </div>
              <div className="space-y-4">
                <Label className="text-xs uppercase font-black tracking-widest text-muted-foreground block mb-4">Projets</Label>
                <div className="grid grid-cols-1 gap-3 max-h-48 overflow-y-auto p-4 border border-border">
                  {projects?.map((project) => (
                    <div key={project.id} className="flex items-center space-x-3 p-2 hover:bg-secondary">
                      <Checkbox id={`p-${project.id}`} checked={selectedProjectIds.includes(project.id)} onCheckedChange={(checked) => {
                        if (checked) setSelectedProjectIds([...selectedProjectIds, project.id]);
                        else setSelectedProjectIds(selectedProjectIds.filter(id => id !== project.id));
                      }} />
                      <label htmlFor={`p-${project.id}`} className="text-sm font-medium leading-none cursor-pointer">{project.title}</label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-none h-12 px-8 uppercase font-bold text-xs">Annuler</Button>
              <Button onClick={handleCreateSession} disabled={isSubmitting} className="rounded-none h-12 px-8 uppercase font-bold text-xs">Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      <Tabs defaultValue="sessions" className="w-full">
        <TabsList className="w-full justify-start rounded-none bg-transparent border-b border-border h-auto p-0 gap-8">
          <TabsTrigger value="sessions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-0 py-4 text-sm font-bold uppercase tracking-widest">Sessions</TabsTrigger>
          <TabsTrigger value="projects" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-0 py-4 text-sm font-bold uppercase tracking-widest">Projets</TabsTrigger>
          <TabsTrigger value="members" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-0 py-4 text-sm font-bold uppercase tracking-widest">Membres</TabsTrigger>
          <TabsTrigger value="results" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-0 py-4 text-sm font-bold uppercase tracking-widest">Résultats</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="py-12 space-y-6">
          {openSessionsCount > 0 && (
            <div className="flex justify-end mb-8">
              <AlertDialog open={isConfirmBulkOpen} onOpenChange={setIsConfirmBulkOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="rounded-none h-10 px-6 font-bold uppercase tracking-widest text-[10px] gap-2">
                    <ShieldAlert className="h-3.5 w-3.5" /> Clôturer tout ({openSessionsCount})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-none">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="uppercase font-black">Confirmation</AlertDialogTitle>
                    <AlertDialogDescription>Clôturer toutes les sessions ouvertes ? Action irréversible.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-none uppercase font-bold text-xs">Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={bulkCloseOpenVotes} disabled={isBulkSubmitting} className="rounded-none bg-destructive">
                      {isBulkSubmitting ? <Loader2 className="animate-spin" /> : "Oui, tout clôturer"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          <div className="grid gap-6">
            {assemblies?.map((assembly) => {
              const sessionVote = allVotes?.find(v => v.assemblyId === assembly.id);
              return (
                <div key={assembly.id} className="group border border-border p-8 bg-white hover:border-black transition-all flex flex-col md:flex-row md:items-center justify-between gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">{getStatusBadge(assembly.state)}</div>
                    <div className="space-y-1">
                      <h3 className="text-2xl font-bold">{assembly.title}</h3>
                      <div className="flex items-center gap-6 mt-2">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">{sessionVote?.ballotCount || 0} bulletins</p>
                        <p className="text-[10px] uppercase font-bold text-primary">{sessionVote?.eligibleCount || 0} éligibles</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {assembly.state === 'draft' && (
                      <Button onClick={() => updateSessionState(assembly.id, 'open')} disabled={isSubmitting} className="rounded-none bg-[#7DC092] h-10 px-6 uppercase font-bold text-[10px]">Ouvrir</Button>
                    )}
                    {assembly.state === 'open' && (
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => sessionVote && handleRecalculateBallots(assembly.id, sessionVote.id)} disabled={isSubmitting}><RefreshCw className={isSubmitting ? "animate-spin" : ""} /></Button>
                        <Button onClick={() => sessionVote && handleTallyAndPublish(assembly.id, sessionVote.id)} disabled={isSubmitting} className="rounded-none bg-black text-white h-10 px-6 uppercase font-bold text-[10px]">Clôturer</Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="projects" className="py-12 space-y-8">
          <div className="flex items-center justify-between border-b border-border pb-6">
            <h2 className="text-xl font-bold">Projets ({projects?.length || 0})</h2>
            <Button onClick={generateDemoProjects} disabled={isGenerating} variant="outline" className="rounded-none border-primary text-primary uppercase font-bold text-xs">Générer démo</Button>
          </div>
          <div className="grid gap-4">
            {projects?.map((project) => (
              <div key={project.id} className="border border-border p-6 bg-white flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="font-bold text-lg">{project.title}</h4>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{project.budget}</p>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="members" className="py-12 space-y-8">
          <div className="p-4 bg-secondary/5 border border-border flex items-center justify-between">
            <div className="flex items-center gap-4 text-[10px] uppercase font-bold tracking-widest">
              <Database className="h-3 w-3 text-primary" /> <span>Membres : {members?.length || 0}</span>
            </div>
            <Button onClick={handleRepairMembers} disabled={isRepairing} variant="outline" size="sm" className="h-8 rounded-none border-primary text-primary font-bold uppercase text-[10px]">Réparer</Button>
          </div>
          <div className="flex flex-col md:flex-row gap-6 items-center justify-between border-b border-border pb-6">
            <h2 className="text-xl font-bold">Annuaire {pendingCount > 0 && <span className="text-sm font-normal text-orange-600 ml-2">({pendingCount} en attente)</span>}</h2>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] rounded-none"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Tous</SelectItem><SelectItem value="active">Actif</SelectItem><SelectItem value="pending">En attente</SelectItem><SelectItem value="blocked">Bloqué</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="border border-border bg-white overflow-hidden">
            <Table>
              <TableHeader className="bg-secondary/20"><TableRow><TableHead>Email</TableHead><TableHead>Statut</TableHead><TableHead>Rôle</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {filteredMembers?.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium text-sm">{member.email}</TableCell>
                    <TableCell>{getStatusBadge(member.status)}</TableCell>
                    <TableCell><Badge variant="outline" className="rounded-none border-black font-bold uppercase text-[9px]">{member.role}</Badge></TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-none">
                          <DropdownMenuItem onClick={() => updateMemberStatus(member.id, 'active')} className="text-xs text-green-600 font-bold">Activer</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateMemberStatus(member.id, 'pending')} className="text-xs">En attente</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setConfirmAdminPromote(member.id)} className="text-xs">Promouvoir Admin</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="results" className="py-12 space-y-8">
          <div className="flex items-center justify-between border-b border-border pb-6">
            <h2 className="text-xl font-bold">Procès-verbaux des scrutins</h2>
          </div>
          <div className="grid gap-8">
            {assemblies?.filter(a => a.state === 'locked').map((assembly) => (
              <AssemblyResultItem key={assembly.id} assembly={assembly} projects={projects || []} />
            ))}
            {assemblies?.filter(a => a.state === 'locked').length === 0 && (
              <div className="text-center py-24 border border-dashed border-border bg-secondary/10">
                <p className="text-muted-foreground italic">Aucun résultat officiel publié.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!confirmAdminPromote} onOpenChange={(open) => !open && setConfirmAdminPromote(null)}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader><AlertDialogTitle>Promouvoir Admin ?</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmAdminPromote && updateMemberRole(confirmAdminPromote, 'admin')} className="rounded-none bg-black">Confirmer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function AdminPage() {
  const { isAdmin, isMemberLoading } = useAuthStatus();

  return (
    <RequireActiveMember>
      <MainLayout statusText="Administration">
        {!isMemberLoading && isAdmin ? (
          <AdminContent />
        ) : !isMemberLoading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-8 text-center animate-in fade-in duration-700">
            <ShieldAlert className="h-20 w-20 text-destructive" />
            <h2 className="text-3xl font-bold">Accès refusé</h2>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 space-y-6">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        )}
      </MainLayout>
    </RequireActiveMember>
  );
}
