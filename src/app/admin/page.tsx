'use client';

export const dynamic = 'force-dynamic';

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
  where
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, ShieldAlert, Trophy, Settings, Users, Activity } from 'lucide-react';
import { Project, MemberProfile, Vote } from '@/types';
import { CreateSessionModal } from '@/components/admin/CreateSessionModal';
import { toast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { computeSchulzeResults } from '@/lib/tally';

function ResultsTabContent() {
  const db = useFirestore();
  const votesQuery = useMemoFirebase(() => 
    query(collection(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes'), orderBy('createdAt', 'desc')), 
  [db]);
  const { data: votes } = useCollection<Vote>(votesQuery);

  const handlePublishResults = async (vote: Vote) => {
    // Logique de clôture et calcul des résultats
    toast({ title: "Calcul en cours", description: "Dépouillement des bulletins..." });
  };

  return (
    <div className="space-y-6">
      {votes?.filter(v => v.state !== 'draft').map(v => (
        <div key={v.id} className="p-8 border bg-white flex justify-between items-center">
          <div className="space-y-1">
            <Badge className={v.state === 'open' ? "bg-green-600" : "bg-black"}>{v.state}</Badge>
            <h3 className="text-xl font-bold">{v.question}</h3>
            <p className="text-sm text-muted-foreground">{v.ballotCount || 0} bulletins reçus</p>
          </div>
          {v.state === 'open' && (
            <Button variant="outline" onClick={() => handlePublishResults(v)} className="font-bold uppercase tracking-widest text-xs">Clôturer & Publier</Button>
          )}
        </div>
      ))}
    </div>
  );
}

function AdminContent() {
  const db = useFirestore();
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);

  const votesQuery = useMemoFirebase(() => query(collection(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes'), orderBy('createdAt', 'desc')), [db]);
  const { data: votes } = useCollection<Vote>(votesQuery);

  const projectsQuery = useMemoFirebase(() => query(collection(db, 'projects'), orderBy('createdAt', 'desc')), [db]);
  const { data: projects } = useCollection<Project>(projectsQuery);

  const membersQuery = useMemoFirebase(() => collection(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'members'), [db]);
  const { data: members } = useCollection<MemberProfile>(membersQuery);

  const handleProjectStatus = async (projectId: string, newStatus: Project['status']) => {
    try {
      await updateDoc(doc(db, 'projects', projectId), { status: newStatus, updatedAt: serverTimestamp() });
      toast({ title: "Succès", description: "Statut mis à jour." });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur", description: "Modification impossible." });
    }
  };

  return (
    <div className="space-y-12">
      <div className="flex justify-between items-center">
        <h1 className="text-4xl font-bold">Console Admin</h1>
        <Button onClick={() => setIsSessionModalOpen(true)} className="rounded-none font-bold uppercase tracking-widest text-xs gap-2">
          <Plus className="h-4 w-4" /> Nouvelle Session
        </Button>
      </div>
      
      <Tabs defaultValue="sessions">
        <TabsList className="rounded-none bg-transparent border-b h-auto p-0 gap-8 mb-8">
          <TabsTrigger value="sessions" className="px-0 py-4 font-bold uppercase tracking-widest text-[11px] data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none flex items-center gap-2"><Activity className="h-3 w-3" /> Sessions</TabsTrigger>
          <TabsTrigger value="results" className="px-0 py-4 font-bold uppercase tracking-widest text-[11px] data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none flex items-center gap-2"><Trophy className="h-3 w-3" /> Résultats</TabsTrigger>
          <TabsTrigger value="projects" className="px-0 py-4 font-bold uppercase tracking-widest text-[11px] data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none flex items-center gap-2"><Settings className="h-3 w-3" /> Projets</TabsTrigger>
          <TabsTrigger value="members" className="px-0 py-4 font-bold uppercase tracking-widest text-[11px] data-[state=active]:border-b-2 data-[state=active]:border-black rounded-none flex items-center gap-2"><Users className="h-3 w-3" /> Membres</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-6">
          {votes?.map(v => (
            <div key={v.id} className="p-8 border bg-white flex justify-between items-center">
              <div>
                <Badge className="bg-black mb-2 uppercase text-[9px] rounded-none">{v.state}</Badge>
                <h3 className="text-xl font-bold">{v.question}</h3>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="results">
          <ResultsTabContent />
        </TabsContent>

        <TabsContent value="projects" className="space-y-6">
          {projects?.map(p => (
            <div key={p.id} className="p-8 border bg-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold">{p.title}</h3>
                <p className="text-sm text-muted-foreground">{p.budget}</p>
              </div>
              <div className="flex gap-4">
                <Button size="sm" variant="outline" onClick={() => handleProjectStatus(p.id, 'candidate')} className="rounded-none font-bold text-green-600">Candidat</Button>
                <Button size="sm" variant="outline" onClick={() => handleProjectStatus(p.id, 'rejected')} className="rounded-none font-bold text-destructive">Rejeter</Button>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="members" className="bg-white border">
          <Table>
            <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Rôle</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
            <TableBody>
              {members?.map(m => (
                <TableRow key={m.id}>
                  <TableCell>{m.email}</TableCell>
                  <TableCell className="capitalize">{m.role}</TableCell>
                  <TableCell><Badge className={m.status === 'active' ? "bg-green-600" : "bg-orange-500"}>{m.status}</Badge></TableCell>
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
        {!isMemberLoading && isAdmin ? <AdminContent /> : <div className="py-24 text-center"><ShieldAlert className="mx-auto h-20 w-20 text-destructive opacity-20" /><p className="font-bold uppercase tracking-widest text-muted-foreground">Accès Réservé</p></div>}
      </MainLayout>
    </RequireActiveMember>
  );
}