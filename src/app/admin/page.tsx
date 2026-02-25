'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { useAuthStatus, DEFAULT_ASSEMBLY_ID } from '@/components/auth/AuthStatusProvider';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Plus, 
  Loader2, 
  MoreHorizontal,
  Database,
  ShieldAlert,
  RefreshCw,
  FileText,
  PieChart,
  Wrench,
  AlertTriangle
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Assembly, Vote, Project, MemberProfile, Ballot } from '@/types';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { computeSchulzeResults } from '@/lib/tally';

/**
 * Composants d'administration enrichis avec outils de maintenance
 */

function AdminContent() {
  const { user } = useUser();
  const db = useFirestore();
  const { isAdmin, member } = useAuthStatus();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const assembliesQuery = useMemoFirebase(() => query(collection(db, 'assemblies')), [db]);
  const { data: assemblies } = useCollection<Assembly>(assembliesQuery);

  const projectsQuery = useMemoFirebase(() => query(collection(db, 'projects')), [db]);
  const { data: projects } = useCollection<Project>(projectsQuery);

  const membersQuery = useMemoFirebase(() => {
    return query(collection(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'members'), limit(150));
  }, [db]);
  const { data: members } = useCollection<MemberProfile>(membersQuery);

  const handleMigrateLegacyMembers = async () => {
    if (!confirm("Voulez-vous tenter de migrer tous les membres de l'ancienne racine vers cette assemblée ?")) return;
    setIsRepairing(true);
    try {
      const legacyCol = collection(db, 'members');
      const legacySnap = await getDocs(legacyCol);
      const batch = writeBatch(db);
      let count = 0;

      for (const lDoc of legacySnap.docs) {
        const data = lDoc.data();
        const targetRef = doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'members', lDoc.id);
        
        batch.set(targetRef, {
          ...data,
          id: lDoc.id,
          migratedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
        count++;
      }

      await batch.commit();
      toast({ title: "Migration réussie", description: `${count} membres ont été synchronisés.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur de migration", description: e.message });
    } finally {
      setIsRepairing(false);
    }
  };

  const isUserActiveAdmin = isAdmin && member?.status === 'active';

  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold">Administration</h1>
        <div className="flex gap-4">
          <Button 
            variant="outline" 
            onClick={handleMigrateLegacyMembers} 
            disabled={isRepairing}
            className="rounded-none border-orange-500 text-orange-600 gap-2 text-[10px] font-bold uppercase"
          >
            {isRepairing ? <Loader2 className="animate-spin h-3 w-3" /> : <Wrench className="h-3 w-3" />}
            Récupérer Anciens Membres
          </Button>
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
          {/* ... existing session list code ... */}
        </TabsContent>

        <TabsContent value="members" className="py-12 space-y-8">
           <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Annuaire ({members?.length || 0})</h2>
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
           <div className="border border-border">
             <Table>
               <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Statut</TableHead><TableHead>Rôle</TableHead></TableRow></TableHeader>
               <TableBody>
                 {members?.map((m) => (
                   <TableRow key={m.id}>
                     <TableCell>{m.email}</TableCell>
                     <TableCell>
                        <Badge className={m.status === 'active' ? "bg-green-600" : "bg-orange-500"}>{m.status}</Badge>
                     </TableCell>
                     <TableCell>{m.role}</TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>
           </div>
        </TabsContent>

        <TabsContent value="results" className="py-12">
          {/* ... existing results code ... */}
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