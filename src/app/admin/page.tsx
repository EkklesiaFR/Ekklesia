
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
  limit 
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
  Settings
} from 'lucide-react';
import { Assembly, Project, MemberProfile } from '@/types';

/**
 * Console d'administration sécurisée.
 * La migration se fait désormais via script Admin SDK uniquement pour plus de sécurité.
 */

function AdminContent() {
  const { user } = useUser();
  const db = useFirestore();
  const { isAdmin } = useAuthStatus();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const assembliesQuery = useMemoFirebase(() => query(collection(db, 'assemblies')), [db]);
  const { data: assemblies } = useCollection<Assembly>(assembliesQuery);

  const projectsQuery = useMemoFirebase(() => query(collection(db, 'projects')), [db]);
  const { data: projects } = useCollection<Project>(projectsQuery);

  const membersQuery = useMemoFirebase(() => {
    return query(collection(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'members'), limit(150));
  }, [db]);
  const { data: members } = useCollection<MemberProfile>(membersQuery);

  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold">Administration</h1>
        <div className="flex gap-4">
          <Button onClick={() => setIsDialogOpen(true)} className="rounded-none font-bold uppercase tracking-widest text-xs">
            <Plus className="h-4 w-4" /> Créer une session
          </Button>
        </div>
      </div>
      
      <Tabs defaultValue="sessions" className="w-full">
        <TabsList className="w-full justify-start rounded-none bg-transparent border-b border-border h-auto p-0 gap-8">
          <TabsTrigger value="sessions" className="px-0 py-4 font-bold uppercase tracking-widest">Sessions</TabsTrigger>
          <TabsTrigger value="members" className="px-0 py-4 font-bold uppercase tracking-widest">Membres</TabsTrigger>
          <TabsTrigger value="results" className="px-0 py-4 font-bold uppercase tracking-widest">Résultats PV</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="py-12">
           <div className="grid gap-6">
             {assemblies?.map(asm => (
               <div key={asm.id} className="p-6 border border-border bg-white flex items-center justify-between">
                 <div className="space-y-1">
                   <h3 className="text-xl font-bold">{asm.title}</h3>
                   <Badge variant="secondary" className="rounded-none uppercase text-[9px] font-black tracking-widest">{asm.state}</Badge>
                 </div>
                 <Button variant="outline" className="rounded-none h-10 uppercase text-xs font-bold gap-2">
                   <Settings className="h-3 w-3" /> Gérer
                 </Button>
               </div>
             ))}
           </div>
        </TabsContent>

        <TabsContent value="members" className="py-12 space-y-8">
           <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Annuaire de l&apos;Assemblée ({members?.length || 0})</h2>
              <div className="flex gap-2">
                 <Select value={statusFilter} onValueChange={setStatusFilter}>
                   <SelectTrigger className="w-[150px] rounded-none"><SelectValue placeholder="Statut" /></SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">Tous</SelectItem>
                     <SelectItem value="active">Actif</SelectItem>
                     <SelectItem value="pending">En attente</SelectItem>
                   </SelectContent>
                 </Select>
              </div>
           </div>
           <div className="border border-border bg-white">
             <Table>
               <TableHeader>
                 <TableRow className="hover:bg-transparent">
                   <TableHead>Email</TableHead>
                   <TableHead>Statut</TableHead>
                   <TableHead>Rôle</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {members?.filter(m => statusFilter === 'all' || m.status === statusFilter).map((m) => (
                   <TableRow key={m.id}>
                     <TableCell className="font-medium">{m.email}</TableCell>
                     <TableCell>
                        <Badge className={m.status === 'active' ? "bg-green-600 rounded-none" : "bg-orange-500 rounded-none"}>
                          {m.status}
                        </Badge>
                     </TableCell>
                     <TableCell className="capitalize">{m.role}</TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>
           </div>
        </TabsContent>

        <TabsContent value="results" className="py-12">
          <div className="p-12 border border-dashed border-border bg-secondary/10 text-center">
            <p className="text-muted-foreground italic">Sélectionnez une session pour voir les résultats consolidés.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AdminPage() {
  const { isAdmin, isMemberLoading } = useAuthStatus();
  return (
    <RequireActiveMember>
      <MainLayout statusText="Admin">
        {!isMemberLoading && isAdmin ? <AdminContent /> : <div className="p-20 text-center"><ShieldAlert className="mx-auto h-20 w-20 text-destructive" /></div>}
      </MainLayout>
    </RequireActiveMember>
  );
}
