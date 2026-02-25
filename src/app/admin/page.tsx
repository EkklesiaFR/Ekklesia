'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { useAuthStatus, DEFAULT_ASSEMBLY_ID } from '@/components/auth/AuthStatusProvider';
import { 
  collection, 
  query, 
  limit, 
  orderBy,
  doc,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
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
  Plus, 
  ShieldAlert,
  Settings,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Assembly, Project, MemberProfile, Vote } from '@/types';
import { CreateSessionModal } from '@/components/admin/CreateSessionModal';
import { toast } from '@/hooks/use-toast';

function AdminContent() {
  const { user } = useUser();
  const db = useFirestore();
  const { isAdmin } = useAuthStatus();
  
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Queries
  const votesQuery = useMemoFirebase(() => {
    return query(collection(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes'), orderBy('createdAt', 'desc'));
  }, [db]);
  const { data: votes } = useCollection<Vote>(votesQuery);

  const projectsQuery = useMemoFirebase(() => query(collection(db, 'projects'), orderBy('createdAt', 'desc')), [db]);
  const { data: projects } = useCollection<Project>(projectsQuery);

  const membersQuery = useMemoFirebase(() => {
    return query(collection(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'members'), limit(150));
  }, [db]);
  const { data: members } = useCollection<MemberProfile>(membersQuery);

  const handleProjectStatus = async (projectId: string, newStatus: Project['status']) => {
    try {
      await updateDoc(doc(db, 'projects', projectId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Statut mis à jour", description: `Le projet est désormais : ${newStatus}` });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de modifier le statut." });
    }
  };

  const closeVote = async (vote: Vote) => {
    try {
      await updateDoc(doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID), { 
        state: 'locked', 
        updatedAt: serverTimestamp() 
      });
      await updateDoc(doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes', vote.id), { 
        state: 'locked',
        updatedAt: serverTimestamp()
      });
      toast({ title: "Scrutin clôturé", description: "Le vote est désormais archivé." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur", description: "Échec de la clôture." });
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted-foreground block">Contrôle</span>
          <h1 className="text-4xl font-bold">Console Admin</h1>
        </div>
        <div className="flex gap-4">
          <Button onClick={() => setIsSessionModalOpen(true)} className="rounded-none h-12 font-bold uppercase tracking-widest text-xs gap-2">
            <Plus className="h-4 w-4" /> Nouvelle Session
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="sessions" className="w-full">
        <TabsList className="w-full justify-start rounded-none bg-transparent border-b border-border h-auto p-0 gap-8 mb-8">
          <TabsTrigger value="sessions" className="px-0 py-4 font-bold uppercase tracking-widest text-[11px] data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none">Sessions</TabsTrigger>
          <TabsTrigger value="projects" className="px-0 py-4 font-bold uppercase tracking-widest text-[11px] data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none">Projets</TabsTrigger>
          <TabsTrigger value="members" className="px-0 py-4 font-bold uppercase tracking-widest text-[11px] data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none">Membres</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-6">
           <div className="grid gap-6">
             {votes?.length === 0 && (
               <div className="p-12 border border-dashed text-center italic text-muted-foreground bg-secondary/5">
                 Aucun scrutin configuré.
               </div>
             )}
             {votes?.map(v => (
               <div key={v.id} className="p-8 border border-border bg-white flex flex-col md:flex-row md:items-center justify-between gap-6">
                 <div className="space-y-3">
                   <div className="flex items-center gap-3">
                     <Badge className={v.state === 'open' ? "bg-green-600 rounded-none uppercase text-[9px]" : "bg-black rounded-none uppercase text-[9px]"}>
                       {v.state === 'open' ? 'Ouvert' : 'Archives'}
                     </Badge>
                     <span className="text-[10px] font-mono text-muted-foreground">ID: {v.id}</span>
                   </div>
                   <h3 className="text-2xl font-bold">{v.question}</h3>
                 </div>
                 <div className="flex gap-4">
                   {v.state === 'open' && (
                     <Button variant="outline" onClick={() => closeVote(v)} className="rounded-none h-10 border-destructive text-destructive hover:bg-destructive hover:text-white uppercase text-xs font-bold gap-2">
                       <XCircle className="h-3 w-3" /> Clôturer
                     </Button>
                   )}
                   <Button variant="outline" className="rounded-none h-10 border-black uppercase text-xs font-bold gap-2">
                     <Settings className="h-3 w-3" /> Gérer
                   </Button>
                 </div>
               </div>
             ))}
           </div>
        </TabsContent>

        <TabsContent value="projects" className="space-y-8">
          <div className="grid gap-6">
            {projects?.map(project => (
              <div key={project.id} className="p-8 border border-border bg-white space-y-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold">{project.title}</h3>
                    <p className="text-sm text-muted-foreground">{project.summary}</p>
                  </div>
                  <Badge variant="outline" className="rounded-none uppercase text-[10px]">{project.status}</Badge>
                </div>
                <div className="flex gap-4 pt-4 border-t">
                  <Button size="sm" variant="outline" onClick={() => handleProjectStatus(project.id, 'candidate')} className="rounded-none text-[10px] uppercase font-bold text-green-600 border-green-200">
                    <CheckCircle2 className="h-3 w-3 mr-2" /> Candidat
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleProjectStatus(project.id, 'rejected')} className="rounded-none text-[10px] uppercase font-bold text-destructive border-destructive/20">
                    <XCircle className="h-3 w-3 mr-2" /> Rejeter
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="members" className="space-y-8">
           <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Annuaire ({members?.length || 0})</h2>
              <div className="flex gap-2">
                 <Select value={statusFilter} onValueChange={setStatusFilter}>
                   <SelectTrigger className="w-[150px] rounded-none h-10"><SelectValue placeholder="Statut" /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">Tous</SelectItem>
                     <SelectItem value="active">Actif</SelectItem>
                     <SelectItem value="pending">En attente</SelectItem>
                   </SelectContent>
                 </Select>
              </div>
           </div>
           <div className="border border-border bg-white overflow-hidden">
             <Table>
               <TableHeader className="bg-secondary/30">
                 <TableRow className="hover:bg-transparent">
                   <TableHead className="font-bold text-[10px] uppercase tracking-widest">Email</TableHead>
                   <TableHead className="font-bold text-[10px] uppercase tracking-widest">Statut</TableHead>
                   <TableHead className="font-bold text-[10px] uppercase tracking-widest text-right">Actions</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {members?.filter(m => statusFilter === 'all' || m.status === statusFilter).map((m) => (
                   <TableRow key={m.id} className="hover:bg-secondary/10">
                     <TableCell className="font-medium">{m.email}</TableCell>
                     <TableCell>
                        <Badge className={m.status === 'active' ? "bg-green-600 rounded-none text-[9px]" : "bg-orange-500 rounded-none text-[9px]"}>
                          {m.status}
                        </Badge>
                     </TableCell>
                     <TableCell className="text-right">
                       <Button variant="ghost" size="sm" className="text-[10px] font-bold uppercase">Gérer</Button>
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
        {!isMemberLoading && isAdmin ? <AdminContent /> : (
          <div className="py-24 text-center space-y-6">
            <ShieldAlert className="mx-auto h-20 w-20 text-destructive opacity-20" />
            <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Accès Admin Requis</p>
          </div>
        )}
      </MainLayout>
    </RequireActiveMember>
  );
}