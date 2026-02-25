'use client';

import { useState, useEffect } from 'react';
import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { 
  collection, 
  query, 
  addDoc, 
  serverTimestamp, 
  doc, 
  updateDoc, 
  collectionGroup,
  getDocs,
  writeBatch,
  limit
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Plus, 
  Calendar, 
  Play, 
  Square, 
  ChevronRight, 
  Loader2, 
  Users,
  MoreHorizontal,
  Eye,
  Shield,
  UserCheck,
  Ban,
  Clock,
  RefreshCw,
  AlertTriangle,
  Database,
  Info
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Assembly, Vote, Project, MemberProfile } from '@/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Image from 'next/image';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

function AdminContent() {
  const { user } = useUser();
  const db = useFirestore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberProfile | null>(null);
  
  // Promotion to Admin confirmation
  const [confirmAdminPromote, setConfirmAdminPromote] = useState<string | null>(null);

  // Filters for members (local only)
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Form state for sessions
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newVoteQuestion, setNewVoteQuestion] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  // 1. Data Fetching
  const assembliesQuery = useMemoFirebase(() => query(collection(db, 'assemblies')), [db]);
  const { data: assemblies } = useCollection<Assembly>(assembliesQuery);

  const votesQuery = useMemoFirebase(() => query(collectionGroup(db, 'votes')), [db]);
  const { data: allVotes } = useCollection<Vote>(votesQuery);

  const projectsQuery = useMemoFirebase(() => query(collection(db, 'projects')), [db]);
  const { data: projects } = useCollection<Project>(projectsQuery);

  // MEMBRES: Requête simplifiée sans orderBy pour s'assurer de voir TOUS les documents
  // (Firestore exclut les docs n'ayant pas le champ utilisé dans un orderBy)
  const membersQuery = useMemoFirebase(() => {
    return query(collection(db, 'members'), limit(100));
  }, [db]);
  const { data: members, error: membersError, isLoading: isMembersLoading } = useCollection<MemberProfile>(membersQuery);

  // Log error if any
  useEffect(() => {
    if (membersError) {
      console.error("[Admin Members Query Error]", membersError);
    }
  }, [membersError]);

  const filteredMembers = members?.filter(m => {
    const matchStatus = statusFilter === 'all' || m.status === statusFilter;
    const matchRole = roleFilter === 'all' || m.role === roleFilter;
    return matchStatus && matchRole;
  });

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
      const batch = writeBatch(db);
      const assemblyRef = doc(collection(db, 'assemblies'));
      const voteRef = doc(collection(db, 'assemblies', assemblyRef.id, 'votes'));

      batch.set(assemblyRef, {
        title: newSessionTitle,
        state: 'draft',
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
        activeVoteId: voteRef.id,
      });

      batch.set(voteRef, {
        id: voteRef.id,
        assemblyId: assemblyRef.id,
        question: newVoteQuestion,
        projectIds: selectedProjectIds,
        state: 'draft',
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });

      await batch.commit();

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
      setIsSubmitting(true);
      const assemblyRef = doc(db, 'assemblies', assemblyId);
      const votesSnap = await getDocs(collection(db, 'assemblies', assemblyId, 'votes'));
      
      if (votesSnap.empty) {
        toast({ variant: "destructive", title: "Erreur", description: "Aucun vote trouvé pour cette assemblée." });
        return;
      }

      const voteDoc = votesSnap.docs[0];
      const voteRef = voteDoc.ref;

      const batch = writeBatch(db);
      batch.update(assemblyRef, { 
        state: newState,
        activeVoteId: newState === 'open' ? voteDoc.id : null,
        updatedAt: serverTimestamp(),
        openedAt: newState === 'open' ? serverTimestamp() : null
      });
      
      batch.update(voteRef, { 
        state: newState,
        updatedAt: serverTimestamp(),
        opensAt: newState === 'open' ? serverTimestamp() : null
      });

      await batch.commit();
      toast({ title: `Session ${newState === 'open' ? 'ouverte' : 'fermée'}` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: "Action impossible." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateMemberStatus = async (uid: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'members', uid), { 
        status: newStatus, 
        updatedAt: serverTimestamp() 
      });
      toast({ title: "Statut mis à jour", description: `Le membre est désormais ${newStatus}.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de modifier le statut." });
    }
  };

  const updateMemberRole = async (uid: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'members', uid), { 
        role: newRole, 
        updatedAt: serverTimestamp() 
      });
      toast({ title: "Rôle mis à jour", description: `Rôle modifié : ${newRole}.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de modifier le rôle." });
    }
  };

  const generateDemoProjects = async () => {
    if (!user) return;
    setIsGenerating(true);
    const demoData = [
      { title: "Pistes cyclables sécurisées", summary: "Aménagement de voies réservées aux vélos.", budget: "45 000 €", imageUrl: PlaceHolderImages[4].imageUrl },
      { title: "Rénovation de l'école primaire", summary: "Isolation thermique et modernisation.", budget: "120 000 €", imageUrl: PlaceHolderImages[1].imageUrl },
      { title: "Festival des Arts de Rue", summary: "Organisation d'un événement annuel gratuit.", budget: "15 000 €", imageUrl: PlaceHolderImages[3].imageUrl },
      { title: "Installation de panneaux solaires", summary: "Équiper les bâtiments publics.", budget: "85 000 €", imageUrl: PlaceHolderImages[2].imageUrl },
      { title: "Jardins partagés urbains", summary: "Culture collective en ville.", budget: "8 000 €", imageUrl: PlaceHolderImages[0].imageUrl }
    ];

    try {
      for (const item of demoData) {
        await addDoc(collection(db, 'projects'), { ...item, status: "candidate", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ownerUid: user.uid });
      }
      toast({ title: "Projets générés" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur" });
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
      case 'active': return <Badge className="bg-[#7DC092] hover:bg-[#7DC092]">Actif</Badge>;
      case 'closed': return <Badge variant="secondary">Clos</Badge>;
      case 'pending': return <Badge variant="outline" className="border-orange-500 text-orange-500">En attente</Badge>;
      case 'blocked': return <Badge variant="destructive">Bloqué</Badge>;
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
                <Label htmlFor="question" className="text-xs uppercase font-black tracking-widest text-muted-foreground">Question du vote</Label>
                <Input id="question" value={newVoteQuestion} onChange={(e) => setNewVoteQuestion(e.target.value)} className="rounded-none h-12" />
              </div>
              <div className="space-y-4">
                <Label className="text-xs uppercase font-black tracking-widest text-muted-foreground block mb-4">Sélection des Projets (Min. 2)</Label>
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
          <TabsTrigger value="members" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-0 py-4 text-sm font-bold uppercase tracking-widest">Membres</TabsTrigger>
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
                      <Button onClick={() => updateSessionState(assembly.id, 'open')} disabled={isSubmitting} className="rounded-none bg-[#7DC092] hover:bg-[#6ab081] text-white font-bold uppercase tracking-widest text-[10px] h-10 px-6 gap-2">
                        {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                        Ouvrir le vote
                      </Button>
                    )}
                    {assembly.state === 'open' && (
                      <Button onClick={() => updateSessionState(assembly.id, 'closed')} variant="outline" disabled={isSubmitting} className="rounded-none border-black hover:bg-black hover:text-white font-bold uppercase tracking-widest text-[10px] h-10 px-6 gap-2">
                        {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                        Clôturer
                      </Button>
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
              <Button onClick={generateDemoProjects} disabled={isGenerating} variant="outline" className="rounded-none border-primary text-primary uppercase font-bold text-xs">Générer démo</Button>
            </div>
          </div>
          <div className="grid gap-4">
            {projects?.map((project) => (
              <div key={project.id} className="border border-border p-6 bg-white hover:border-black transition-all flex items-center justify-between">
                <div className="flex gap-6 items-center">
                  {project.imageUrl && (
                    <div className="relative h-16 w-16 flex-shrink-0 border">
                      <Image src={project.imageUrl} alt="" fill className="object-cover grayscale" />
                    </div>
                  )}
                  <div className="space-y-1">
                    <h4 className="font-bold text-lg">{project.title}</h4>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{project.budget}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="members" className="py-12 space-y-8">
          {/* Debug Info */}
          <div className="p-4 bg-secondary/5 border border-border flex items-center justify-between">
            <div className="flex items-center gap-4 text-[10px] uppercase font-bold tracking-widest">
              <Database className="h-3 w-3 text-primary" />
              <span>Collection : <code className="bg-white px-1">members</code></span>
              <span className="text-muted-foreground">|</span>
              <span>Docs chargés : <code className="bg-white px-1">{members?.length || 0}</code></span>
            </div>
            {isMembersLoading && <Loader2 className="h-3 w-3 animate-spin" />}
          </div>

          {/* Error Message */}
          {membersError && (
            <Alert variant="destructive" className="rounded-none">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Erreur de lecture Firestore</AlertTitle>
              <AlertDescription className="font-mono text-[10px] mt-2">
                {String(membersError)}
                <br />
                Vérifiez les règles de sécurité ou si la collection "members" existe.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col md:flex-row gap-6 items-center justify-between border-b border-border pb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5" />
              Gestion des Membres ({filteredMembers?.length || 0})
            </h2>
            <div className="flex gap-4 w-full md:w-auto">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px] rounded-none">
                  <SelectValue placeholder="Filtrer par statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="blocked">Bloqué</SelectItem>
                </SelectContent>
              </Select>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[180px] rounded-none">
                  <SelectValue placeholder="Filtrer par rôle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les rôles</SelectItem>
                  <SelectItem value="member">Membre</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredMembers && filteredMembers.length > 0 ? (
            <div className="border border-border bg-white overflow-hidden">
              <Table>
                <TableHeader className="bg-secondary/20">
                  <TableRow>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Email / ID</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Nom</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Statut</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Rôle</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest hidden md:table-cell">Connexion</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Actions rapides</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers?.map((member) => (
                    <TableRow key={member.id} className="hover:bg-secondary/5">
                      <TableCell className="font-medium text-sm">
                        <div className="flex flex-col">
                          <span>{member.email || member.id}</span>
                          {!member.email && <span className="text-[9px] text-muted-foreground uppercase">(ID uniquement)</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{member.displayName || '-'}</TableCell>
                      <TableCell>{getStatusBadge(member.status)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-none border-black font-bold uppercase text-[9px] gap-1">
                          {member.role === 'admin' ? <Shield className="h-3 w-3" /> : null}
                          {member.role || 'member'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground hidden md:table-cell">
                        {member.lastLoginAt?.seconds ? format(new Date(member.lastLoginAt.seconds * 1000), 'dd/MM HH:mm') : 'Jamais'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {member.status !== 'active' && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => updateMemberStatus(member.id, 'active')}
                              className="h-8 px-3 rounded-none border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700 text-[10px] font-bold uppercase"
                            >
                              <UserCheck className="h-3 w-3 mr-1" /> Activer
                            </Button>
                          )}
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-none w-56">
                              <DropdownMenuLabel className="text-[10px] uppercase font-bold">Fiche détaillée</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => setSelectedMember(member)} className="text-xs">
                                <Eye className="h-3.5 w-3.5 mr-2" /> Voir les informations
                              </DropdownMenuItem>
                              
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-[10px] uppercase font-bold">Gestion Statut</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => updateMemberStatus(member.id, 'active')} className="text-xs text-green-600">
                                <UserCheck className="h-3.5 w-3.5 mr-2" /> Activer le compte
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateMemberStatus(member.id, 'pending')} className="text-xs text-orange-600">
                                <RefreshCw className="h-3.5 w-3.5 mr-2" /> Remettre en attente
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => updateMemberStatus(member.id, 'blocked')} className="text-xs text-destructive">
                                <Ban className="h-3.5 w-3.5 mr-2" /> Bloquer l'accès
                              </DropdownMenuItem>
                              
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-[10px] uppercase font-bold">Gestion Rôle</DropdownMenuLabel>
                              {member.role === 'member' || !member.role ? (
                                <DropdownMenuItem onClick={() => setConfirmAdminPromote(member.id)} className="text-xs font-bold text-primary">
                                  <Shield className="h-3.5 w-3.5 mr-2" /> Promouvoir Admin
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => updateMemberRole(member.id, 'member')} className="text-xs">
                                  <Users className="h-3.5 w-3.5 mr-2" /> Rétrograder Membre
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : !isMembersLoading && (
            <div className="py-24 text-center border border-dashed border-border bg-secondary/5 space-y-4">
              <Users className="h-8 w-8 text-muted-foreground mx-auto" />
              <div className="space-y-1">
                <p className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Aucun membre trouvé</p>
                <p className="text-xs text-muted-foreground italic">
                  Si vous attendez des résultats, vérifiez que la collection "members" contient bien des documents.
                </p>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Member Profile Modal */}
      <Dialog open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
        <DialogContent className="max-w-md rounded-none p-12">
          <DialogHeader className="space-y-6">
            <div className="w-16 h-16 bg-secondary flex items-center justify-center border border-border">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <DialogTitle className="text-2xl font-bold tracking-tight">Fiche Membre</DialogTitle>
          </DialogHeader>
          <div className="py-8 space-y-6">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Nom complet</p>
                <p className="font-medium">{selectedMember?.displayName || 'Non renseigné'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email / ID</p>
                <p className="font-medium text-sm truncate">{selectedMember?.email || selectedMember?.id}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Rôle actuel</p>
                <Badge variant="outline" className="rounded-none border-black font-bold uppercase text-[9px]">{selectedMember?.role || 'member'}</Badge>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Statut</p>
                {selectedMember && getStatusBadge(selectedMember.status)}
              </div>
            </div>
            <div className="space-y-1 pt-4 border-t border-border">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Activités</p>
              <div className="flex flex-col gap-2 text-xs text-muted-foreground mt-2">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> 
                  Inscrit le {selectedMember?.joinedAt?.seconds ? format(new Date(selectedMember.joinedAt.seconds * 1000), 'dd/MM/yyyy') : '-'}
                </span>
                <span className="flex items-center gap-1">
                  <Play className="h-3 w-3" /> 
                  Dernière connexion : {selectedMember?.lastLoginAt?.seconds ? format(new Date(selectedMember.lastLoginAt.seconds * 1000), 'dd/MM HH:mm') : 'Jamais'}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setSelectedMember(null)} className="rounded-none h-12 w-full uppercase font-bold text-xs">Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Admin Promotion */}
      <AlertDialog open={!!confirmAdminPromote} onOpenChange={(open) => !open && setConfirmAdminPromote(null)}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle className="uppercase font-black tracking-tight">Confirmer la promotion</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Êtes-vous sûr de vouloir accorder des privilèges d&apos;administrateur à ce membre ? 
              Un administrateur peut modifier les sessions de vote, les projets et le statut de tous les autres membres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none uppercase font-bold text-xs">Annuler</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (confirmAdminPromote) {
                  updateMemberRole(confirmAdminPromote, 'admin');
                  setConfirmAdminPromote(null);
                }
              }}
              className="rounded-none bg-primary text-white hover:bg-primary/90 uppercase font-bold text-xs"
            >
              Confirmer la promotion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
