'use client';

import { useState } from 'react';
import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  collectionGroup,
  deleteDoc,
  getDocs
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
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Calendar, 
  Play, 
  Square, 
  ChevronRight, 
  Archive,
  Wand2,
  LayoutGrid,
  Loader2,
  Trash2
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Assembly, Vote, Project } from '@/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Image from 'next/image';

function AdminContent() {
  const { user } = useUser();
  const db = useFirestore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Form state
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newVoteQuestion, setNewVoteQuestion] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  // 1. Data Fetching
  const assembliesQuery = useMemoFirebase(() => query(collection(db, 'assemblies'), orderBy('createdAt', 'desc')), [db]);
  const { data: assemblies } = useCollection<Assembly>(assembliesQuery);

  const votesQuery = useMemoFirebase(() => query(collectionGroup(db, 'votes')), [db]);
  const { data: allVotes } = useCollection<Vote>(votesQuery);

  const projectsQuery = useMemoFirebase(() => query(collection(db, 'projects'), orderBy('createdAt', 'desc')), [db]);
  const { data: projects } = useCollection<Project>(projectsQuery);

  // 2. Actions
  const handleCreateSession = async () => {
    if (!newSessionTitle || !newVoteQuestion || selectedProjectIds.length < 2 || !user) {
      toast({ 
        variant: "destructive", 
        title: "Champs manquants", 
        description: "Veuillez remplir le titre, la question et sélectionner au moins 2 projets." 
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const assemblyRef = await addDoc(collection(db, 'assemblies'), {
        title: newSessionTitle,
        state: 'draft',
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
      });

      const voteRef = await addDoc(collection(db, 'assemblies', assemblyRef.id, 'votes'), {
        assemblyId: assemblyRef.id,
        question: newVoteQuestion,
        projectIds: selectedProjectIds,
        state: 'draft',
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        opensAt: startsAt ? new Date(startsAt) : null,
        closesAt: endsAt ? new Date(endsAt) : null,
      });

      // Lier immédiatement le vote à l'assemblée
      await updateDoc(doc(db, 'assemblies', assemblyRef.id), {
        activeVoteId: voteRef.id
      });

      toast({ title: "Session créée", description: "L'assemblée et le vote sont en brouillon." });
      setIsDialogOpen(false);
      resetForm();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de créer la session." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateSessionState = async (assemblyId: string, newState: 'open' | 'closed') => {
    try {
      // 1. Récupérer les documents de vote
      const votesSnap = await getDocs(collection(db, 'assemblies', assemblyId, 'votes'));
      const activeVoteId = votesSnap.docs[0]?.id;

      if (!activeVoteId) {
        toast({ variant: "destructive", title: "Erreur", description: "Aucun document de vote trouvé pour cette assemblée." });
        return;
      }

      // 2. Mettre à jour l'assemblée avec l'activeVoteId explicite
      await updateDoc(doc(db, 'assemblies', assemblyId), { 
        state: newState,
        activeVoteId: newState === 'open' ? activeVoteId : null
      });
      
      // 3. Mettre à jour tous les votes de cette assemblée
      for (const voteDoc of votesSnap.docs) {
        await updateDoc(doc(db, 'assemblies', assemblyId, 'votes', voteDoc.id), { state: newState });
      }
      
      toast({ title: `Session ${newState === 'open' ? 'ouverte' : 'fermée'}` });
    } catch (e: any) {
      console.error("Erreur mise à jour session:", e);
      toast({ variant: "destructive", title: "Erreur", description: "Action impossible." });
    }
  };

  const generateDemoProjects = async () => {
    if (!user) return;
    
    setIsGenerating(true);
    const demoData = [
      { 
        title: "Pistes cyclables sécurisées", 
        summary: "Aménagement de voies réservées aux vélos pour favoriser la mobilité douce.", 
        longDescription: "Ce projet vise à créer un réseau continu de pistes cyclables protégées reliant le centre-ville aux quartiers périphériques.",
        budget: "45 000 €",
        imageUrl: PlaceHolderImages[4].imageUrl
      },
      { 
        title: "Rénovation de l'école primaire", 
        summary: "Isolation thermique et modernisation des salles de classe.", 
        longDescription: "Un projet ambitieux pour réduire l'empreinte carbone de notre école tout en améliorant l'acoustique.",
        budget: "120 000 €",
        imageUrl: PlaceHolderImages[1].imageUrl
      },
      { 
        title: "Festival des Arts de Rue", 
        summary: "Organisation d'un événement annuel gratuit.", 
        longDescription: "Un festival de 3 jours regroupant théâtre, cirque et musique.",
        budget: "15 000 €",
        imageUrl: PlaceHolderImages[3].imageUrl
      },
      { 
        title: "Installation de panneaux solaires", 
        summary: "Équiper les bâtiments publics de panneaux photovoltaïques.", 
        longDescription: "Installation sur le toit de la mairie et du gymnase municipal.",
        budget: "85 000 €",
        imageUrl: PlaceHolderImages[2].imageUrl
      },
      { 
        title: "Jardins partagés urbains", 
        summary: "Transformation de terrains vagues en espaces de culture collective.", 
        longDescription: "Création de trois zones de potagers partagés avec système de récupération d'eau.",
        budget: "8 000 €",
        imageUrl: PlaceHolderImages[0].imageUrl
      }
    ];

    try {
      for (const item of demoData) {
        await addDoc(collection(db, 'projects'), {
          ...item,
          status: "candidate",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          ownerUid: user.uid,
          ownerName: "Administration Ekklesia",
        });
      }
      toast({ title: "Projets générés", description: "5 projets de démonstration ajoutés." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur", description: "Échec de la génération." });
    } finally {
      setIsGenerating(false);
    }
  };

  const clearAllProjects = async () => {
    if (!confirm("Voulez-vous vraiment supprimer TOUS les projets ?")) return;
    setIsGenerating(true);
    try {
      const snap = await getDocs(collection(db, 'projects'));
      for (const docSnap of snap.docs) {
        await deleteDoc(doc(db, 'projects', docSnap.id));
      }
      toast({ title: "Projets supprimés" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur lors de la suppression." });
    } finally {
      setIsGenerating(false);
    }
  };

  const resetForm = () => {
    setNewSessionTitle('');
    setNewVoteQuestion('');
    setSelectedProjectIds([]);
    setStartsAt('');
    setEndsAt('');
  };

  const getStatusBadge = (state: string) => {
    switch (state) {
      case 'open': return <Badge className="bg-[#7DC092] hover:bg-[#7DC092]">Ouvert</Badge>;
      case 'closed': return <Badge variant="secondary">Clos</Badge>;
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
              <Plus className="h-4 w-4" />
              Créer une session
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-none p-8">
            <DialogHeader className="space-y-4">
              <DialogTitle className="text-2xl font-bold uppercase tracking-tight">Nouvelle Session</DialogTitle>
            </DialogHeader>
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
                <Label className="text-xs uppercase font-black tracking-widest text-muted-foreground block mb-4">Projets (Min. 2)</Label>
                <div className="grid grid-cols-1 gap-3 max-h-48 overflow-y-auto p-4 border border-border">
                  {projects?.map((project) => (
                    <div key={project.id} className="flex items-center space-x-3 p-2 hover:bg-secondary transition-colors">
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
        </TabsList>
        
        <TabsContent value="sessions" className="py-12 space-y-6">
          <div className="grid gap-6">
            {assemblies?.map((assembly) => {
              const sessionVote = allVotes?.find(v => v.assemblyId === assembly.id);
              return (
                <div key={assembly.id} className="group border border-border p-8 bg-white hover:border-black transition-all flex flex-col md:flex-row md:items-center justify-between gap-8">
                  <div className="space-y-4 max-w-xl">
                    <div className="flex items-center gap-4">
                      {getStatusBadge(assembly.state)}
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {assembly.createdAt?.seconds ? format(new Date(assembly.createdAt.seconds * 1000), 'dd MMM yyyy', { locale: fr }) : 'Date inconnue'}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-2xl font-bold">{assembly.title}</h3>
                      {sessionVote && <p className="text-sm text-muted-foreground italic">{sessionVote.question}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {assembly.state === 'draft' && (
                      <Button onClick={() => updateSessionState(assembly.id, 'open')} className="rounded-none bg-[#7DC092] hover:bg-[#6ab081] text-white font-bold uppercase tracking-widest text-[10px] h-10 px-6 gap-2">
                        <Play className="h-3.5 w-3.5" /> Ouvrir
                      </Button>
                    )}
                    {assembly.state === 'open' && (
                      <Button onClick={() => updateSessionState(assembly.id, 'closed')} variant="outline" className="rounded-none border-black hover:bg-black hover:text-white font-bold uppercase tracking-widest text-[10px] h-10 px-6 gap-2">
                        <Square className="h-3.5 w-3.5" /> Clôturer
                      </Button>
                    )}
                    {assembly.state === 'closed' && (
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-secondary px-4 py-2">
                        <Archive className="h-3.5 w-3.5" /> Archivée
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
            <h2 className="text-xl font-bold">Liste des Projets ({projects?.length || 0})</h2>
            <div className="flex gap-4">
              <Button onClick={clearAllProjects} disabled={isGenerating || !projects || projects.length === 0} variant="ghost" className="rounded-none text-destructive uppercase font-bold text-xs">Vider</Button>
              <Button onClick={generateDemoProjects} disabled={isGenerating} variant="outline" className="rounded-none border-primary text-primary uppercase font-bold text-xs">Générer démo</Button>
            </div>
          </div>
          <div className="grid gap-4">
            {projects?.map((project) => (
              <div key={project.id} className="border border-border p-6 bg-white hover:border-black transition-all flex items-center justify-between">
                <div className="flex gap-6 items-center">
                  {project.imageUrl && (
                    <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden border">
                      <Image src={project.imageUrl} alt="" fill className="object-cover grayscale" />
                    </div>
                  )}
                  <div className="space-y-1">
                    <h4 className="font-bold text-lg">{project.title}</h4>
                    <p className="text-sm text-muted-foreground line-clamp-1">{project.summary}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{project.budget}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequireActiveMember>
      <MainLayout role="admin" statusText="Administration">
        <AdminContent />
      </MainLayout>
    </RequireActiveMember>
  );
}
