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
  where
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
  CheckCircle2, 
  Clock, 
  Archive 
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Assembly, Vote, Project } from '@/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AdminPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const projectsQuery = useMemoFirebase(() => query(collection(db, 'projects')), [db]);
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
      // Create Assembly
      const assemblyRef = await addDoc(collection(db, 'assemblies'), {
        title: newSessionTitle,
        state: 'draft',
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
      });

      // Create Vote in subcollection
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

  const resetForm = () => {
    setNewSessionTitle('');
    setNewVoteQuestion('');
    setSelectedProjectIds([]);
    setStartsAt('');
    setEndsAt('');
  };

  const updateSessionState = async (assemblyId: string, newState: 'open' | 'closed') => {
    try {
      // Update Assembly
      await updateDoc(doc(db, 'assemblies', assemblyId), { state: newState });
      
      // Update its votes (assuming current MVP logic uses the first/main vote)
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
    <RequireActiveMember>
      <MainLayout role="admin" statusText="Administration">
        <div className="space-y-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <h1 className="text-4xl font-bold">Gestion des Sessions</h1>
            
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
                        <p className="text-xs italic text-muted-foreground">Aucun projet disponible dans la base.</p>
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
            <TabsList className="w-full justify-start rounded-none bg-transparent border-b border-border h-auto p-0 gap-8">
              <TabsTrigger value="sessions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-0 py-4 text-sm font-bold uppercase tracking-widest">Sessions</TabsTrigger>
              <TabsTrigger value="members" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-0 py-4 text-sm font-bold uppercase tracking-widest">Membres</TabsTrigger>
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

                          {(assembly.startsAt || assembly.endsAt) && (
                            <div className="flex gap-6 text-[10px] uppercase font-bold tracking-wider text-muted-foreground pt-2">
                              {assembly.startsAt && <span>Début: {format(new Date(assembly.startsAt.seconds * 1000), 'Pp', { locale: fr })}</span>}
                              {assembly.endsAt && <span>Fin: {format(new Date(assembly.endsAt.seconds * 1000), 'Pp', { locale: fr })}</span>}
                            </div>
                          )}
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
            
            <TabsContent value="members" className="py-12">
              <div className="text-center py-20 border border-dashed border-border bg-secondary/5">
                <p className="text-muted-foreground italic">La gestion des membres est disponible dans l'onglet Sessions (en cours d'implémentation).</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </MainLayout>
    </RequireActiveMember>
  );
}
