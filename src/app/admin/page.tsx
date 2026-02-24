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
  collectionGroup
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
  Loader2
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Assembly, Vote, Project } from '@/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

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

      await addDoc(collection(db, 'assemblies', assemblyRef.id, 'votes'), {
        assemblyId: assemblyRef.id,
        question: newVoteQuestion,
        projectIds: selectedProjectIds,
        state: 'draft',
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        opensAt: startsAt ? new Date(startsAt) : null,
        closesAt: endsAt ? new Date(endsAt) : null,
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

  const generateDemoProjects = async () => {
    if (!user) return;
    
    if (projects && projects.length > 0) {
      if (!confirm(`Il y a déjà ${projects.length} projets. Voulez-vous en ajouter 10 de plus ?`)) {
        return;
      }
    }

    setIsGenerating(true);
    const demoData = [
      { title: "Pistes cyclables sécurisées", summary: "Aménagement de voies réservées aux vélos pour favoriser la mobilité douce.", budget: "45 000 €" },
      { title: "Rénovation de l'école primaire", summary: "Isolation thermique et modernisation des salles de classe pour le confort des élèves.", budget: "120 000 €" },
      { title: "Festival des Arts de Rue", summary: "Organisation d'un événement annuel gratuit pour promouvoir la culture locale.", budget: "15 000 €" },
      { title: "Installation de panneaux solaires", summary: "Équiper les bâtiments publics de panneaux photovoltaïques.", budget: "85 000 €" },
      { title: "Centre de santé communautaire", summary: "Création d'un espace de consultation accessible à tous.", budget: "200 000 €" },
      { title: "Programme d'inclusion numérique", summary: "Ateliers de formation aux outils numériques pour les seniors.", budget: "12 000 €" },
      { title: "Jardins partagés urbains", summary: "Transformation de terrains vagues en espaces de culture collective.", budget: "8 000 €" },
      { title: "Bibliothèque mobile (Bibliobus)", summary: "Un bus itinérant pour apporter des livres dans les quartiers excentrés.", budget: "60 000 €" },
      { title: "Maison des Jeunes", summary: "Construction d'un lieu de rencontre et d'activités pour les adolescents.", budget: "150 000 €" },
      { title: "Reforestation urbaine", summary: "Plantation de 500 arbres pour créer des îlots de fraîcheur.", budget: "25 000 €" },
    ];

    try {
      for (const item of demoData) {
        await addDoc(collection(db, 'projects'), {
          ...item,
          status: "candidate",
          createdAt: serverTimestamp(),
          createdByUserId: user.uid,
          updatedAt: serverTimestamp(),
          assetUrl: "",
          sessionId: "" // Standalone candidate
        });
      }
      toast({ title: "Projets générés", description: "10 projets de démonstration ont été ajoutés." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur", description: "Échec de la génération." });
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

  const updateSessionState = async (assemblyId: string, newState: 'open' | 'closed') => {
    try {
      await updateDoc(doc(db, 'assemblies', assemblyId), { state: newState });
      const sessionVotes = allVotes?.filter(v => v.assemblyId === assemblyId) || [];
      for (const v of sessionVotes) {
        await updateDoc(doc(db, 'assemblies', assemblyId, 'votes', v.id), { state: newState });
      }
      toast({ title: `Session ${newState === 'open' ? 'ouverte' : 'fermée'}` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: "Action impossible." });
    }
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
              <DialogTitle className="text-2xl font-bold uppercase tracking-tight">Nouvelle Session de Vote</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-8 py-6">
              <div className="space-y-4">
                <Label htmlFor="title" className="text-xs uppercase font-black tracking-widest text-muted-foreground">Titre de l'Assemblée</Label>
                <Input 
                  id="title" 
                  placeholder="Ex: Assemblée Générale - Printemps 2024" 
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  className="rounded-none h-12"
                />
              </div>

              <div className="space-y-4">
                <Label htmlFor="question" className="text-xs uppercase font-black tracking-widest text-muted-foreground">Question du Scrutin</Label>
                <Input 
                  id="question" 
                  placeholder="Ex: Quel projet urbain préférez-vous pour le quartier ?" 
                  value={newVoteQuestion}
                  onChange={(e) => setNewVoteQuestion(e.target.value)}
                  className="rounded-none h-12"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <Label className="text-xs uppercase font-black tracking-widest text-muted-foreground">Date d'ouverture</Label>
                  <Input 
                    type="datetime-local" 
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="rounded-none h-12"
                  />
                </div>
                <div className="space-y-4">
                  <Label className="text-xs uppercase font-black tracking-widest text-muted-foreground">Date de clôture</Label>
                  <Input 
                    type="datetime-local" 
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className="rounded-none h-12"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-xs uppercase font-black tracking-widest text-muted-foreground block mb-4">
                  Sélection des Projets (Min. 2)
                </Label>
                <div className="grid grid-cols-1 gap-3 max-h-48 overflow-y-auto p-4 border border-border">
                  {projects?.map((project) => (
                    <div key={project.id} className="flex items-center space-x-3 p-2 hover:bg-secondary transition-colors">
                      <Checkbox 
                        id={`p-${project.id}`}
                        checked={selectedProjectIds.includes(project.id)}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedProjectIds([...selectedProjectIds, project.id]);
                          else setSelectedProjectIds(selectedProjectIds.filter(id => id !== project.id));
                        }}
                      />
                      <label htmlFor={`p-${project.id}`} className="text-sm font-medium leading-none cursor-pointer">
                        {project.title}
                      </label>
                    </div>
                  ))}
                  {(!projects || projects.length === 0) && (
                    <p className="text-xs italic text-muted-foreground text-center py-4">Aucun projet disponible.</p>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)} 
                className="rounded-none h-12 px-8 uppercase font-bold text-xs"
              >
                Annuler
              </Button>
              <Button 
                onClick={handleCreateSession} 
                disabled={isSubmitting}
                className="rounded-none h-12 px-8 uppercase font-bold text-xs"
              >
                {isSubmitting ? "Création..." : "Enregistrer le brouillon"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      <Tabs defaultValue="sessions" className="w-full">
        <TabsList className="w-full justify-start rounded-none bg-transparent border-b border-border h-auto p-0 gap-8 overflow-x-auto no-scrollbar">
          <TabsTrigger value="sessions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-0 py-4 text-sm font-bold uppercase tracking-widest whitespace-nowrap">Sessions</TabsTrigger>
          <TabsTrigger value="projects" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-0 py-4 text-sm font-bold uppercase tracking-widest whitespace-nowrap">Projets</TabsTrigger>
          <TabsTrigger value="members" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-0 py-4 text-sm font-bold uppercase tracking-widest whitespace-nowrap">Membres</TabsTrigger>
        </TabsList>
        
        <TabsContent value="sessions" className="py-12 space-y-6">
          {(!assemblies || assemblies.length === 0) ? (
            <div className="text-center py-20 border border-dashed border-border bg-secondary/5">
              <p className="text-muted-foreground italic">Aucune session enregistrée.</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {assemblies.map((assembly) => {
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
                        {sessionVote && (
                          <p className="text-sm text-muted-foreground flex items-center gap-2 italic">
                            <ChevronRight className="h-3 w-3" />
                            {sessionVote.question} ({sessionVote.projectIds.length} projets)
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {assembly.state === 'draft' && (
                        <Button 
                          onClick={() => updateSessionState(assembly.id, 'open')}
                          className="rounded-none bg-[#7DC092] hover:bg-[#6ab081] text-white font-bold uppercase tracking-widest text-[10px] h-10 px-6 gap-2"
                        >
                          <Play className="h-3.5 w-3.5" />
                          Ouvrir le vote
                        </Button>
                      )}
                      {assembly.state === 'open' && (
                        <Button 
                          onClick={() => updateSessionState(assembly.id, 'closed')}
                          variant="outline"
                          className="rounded-none border-black hover:bg-black hover:text-white font-bold uppercase tracking-widest text-[10px] h-10 px-6 gap-2"
                        >
                          <Square className="h-3.5 w-3.5" />
                          Clôturer
                        </Button>
                      )}
                      {assembly.state === 'closed' && (
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-secondary px-4 py-2">
                          <Archive className="h-3.5 w-3.5" />
                          Session Archivée
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="projects" className="py-12 space-y-8">
          <div className="flex items-center justify-between border-b border-border pb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <LayoutGrid className="h-5 w-5" />
              Liste des Projets ({projects?.length || 0})
            </h2>
            <Button 
              onClick={generateDemoProjects} 
              disabled={isGenerating}
              variant="outline"
              className="rounded-none border-primary text-primary hover:bg-primary hover:text-white font-bold uppercase tracking-widest text-xs gap-2"
            >
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              {projects && projects.length > 0 ? "Ajouter 10 projets" : "Générer des projets (démo)"}
            </Button>
          </div>

          {!projects || projects.length === 0 ? (
            <div className="text-center py-20 border border-dashed border-border bg-secondary/5">
              <p className="text-muted-foreground italic mb-6">Aucun projet dans la base de données.</p>
              <Button onClick={generateDemoProjects} disabled={isGenerating} className="rounded-none gap-2">
                <Wand2 className="h-4 w-4" />
                Générer les données de démo
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {projects.map((project) => (
                <div key={project.id} className="border border-border p-6 bg-white hover:border-black transition-all flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-2 flex-grow">
                    <div className="flex items-center gap-3">
                      <h4 className="font-bold text-lg">{project.title}</h4>
                      <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-widest">
                        {project.budget || "Sans budget"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 max-w-2xl leading-relaxed">
                      {project.summary}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground pt-1">
                      Ajouté le {project.createdAt?.seconds ? format(new Date(project.createdAt.seconds * 1000), 'dd MMM yyyy HH:mm', { locale: fr }) : '...'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="members" className="py-12">
          <div className="text-center py-20 border border-dashed border-border bg-secondary/5">
            <p className="text-muted-foreground italic">La gestion des membres est en cours d'implémentation.</p>
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
