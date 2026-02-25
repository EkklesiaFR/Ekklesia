'use client';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { useAuthStatus } from '@/components/auth/AuthStatusProvider';
import { DEFAULT_ASSEMBLY_ID } from '@/config/assembly';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import Link from 'next/link';
import { 
  LayoutGrid, 
  Settings, 
  Users,
  Activity,
  Clock,
  PieChart
} from 'lucide-react';
import { Project, Vote, Assembly } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { AdminTrendsPanel } from '@/components/voting/AdminTrendsPanel';
import { LastVoteResultCard } from '@/components/voting/LastVoteResultCard';

function ParticipationPanel({ 
  ballotCount, 
  eligibleCount, 
  isLoading 
}: { 
  ballotCount?: number; 
  eligibleCount?: number;
  isLoading?: boolean;
}) {
  if (isLoading) return <p className="text-[10px] uppercase font-bold text-muted-foreground">Calcul...</p>;

  const voters = ballotCount ?? 0;
  const participationRate = eligibleCount && eligibleCount > 0 ? Math.round((voters / eligibleCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-widest font-bold text-gray-400 flex items-center gap-2">
          <PieChart className="h-3 w-3 text-primary" /> Participation
        </h3>
        <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{participationRate}%</span>
      </div>
      <Progress value={participationRate} className="h-1 bg-gray-800" />
    </div>
  );
}

function AssemblyDashboardContent() {
  const { isAdmin, isMemberLoading } = useAuthStatus();
  const db = useFirestore();

  const assemblyRef = useMemoFirebase(() => doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID), [db]);
  const { data: activeAssembly, isLoading: isAssemblyLoading } = useDoc<Assembly>(assemblyRef);

  const voteRef = useMemoFirebase(() => {
    if (!activeAssembly?.activeVoteId || activeAssembly.state !== 'open') return null;
    return doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'votes', activeAssembly.activeVoteId);
  }, [db, activeAssembly]);
  const { data: activeVote, isLoading: isVoteLoading } = useDoc<Vote>(voteRef);

  const projectsQuery = useMemoFirebase(() => collection(db, 'projects'), [db]);
  const { data: allProjects } = useCollection<Project>(projectsQuery);
  const activeProjects = allProjects?.filter(p => activeVote?.projectIds.includes(p.id)) || [];

  if (isAssemblyLoading) return <div className="py-24 text-center">Chargement...</div>;

  const isOpen = activeAssembly?.state === 'open' && activeVote;

  return (
    <div className="space-y-16 animate-in fade-in duration-700">
      <header className="space-y-6">
        <div className="space-y-2">
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted-foreground block">Espace Membre</span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-black">Une voix, une communauté.</h1>
        </div>
      </header>

      {!isOpen ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section className="border border-border p-12 bg-secondary/5 text-center flex flex-col justify-center space-y-6">
            <Activity className="h-8 w-8 text-muted-foreground mx-auto" />
            <h2 className="text-2xl font-bold">Aucun scrutin ouvert</h2>
          </section>
          <LastVoteResultCard />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="border border-border p-8 bg-white space-y-8 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-2">
                  <Activity className="h-3 w-3" /> Vote en cours
                </h3>
                <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              </div>
              <p className="text-2xl font-bold leading-tight">{activeVote?.question}</p>
            </div>
            <Link href="/vote" className="block pt-4">
              <Button className="w-full rounded-none h-14 font-bold uppercase tracking-widest text-xs">Je vote</Button>
            </Link>
          </div>

          <div className="border border-border p-8 bg-black text-white space-y-8 flex flex-col justify-between">
            {isAdmin ? (
              <AdminTrendsPanel 
                assemblyId={DEFAULT_ASSEMBLY_ID} 
                voteId={activeVote.id} 
                projects={activeProjects} 
              />
            ) : (
              <ParticipationPanel 
                ballotCount={activeVote?.ballotCount} 
                eligibleCount={activeVote?.eligibleCount}
              />
            )}
            <Link href="/projects" className="block pt-4">
              <Button variant="outline" className="w-full border-gray-700 text-white rounded-none h-12 font-bold uppercase tracking-widest text-xs">Détails des projets</Button>
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-16 border-t border-border">
        <Link href={isOpen ? "/vote" : "#"} className={cn("group h-full", !isOpen && "opacity-50 pointer-events-none")}>
          <div className="h-full border border-border p-8 bg-white hover:border-black transition-all space-y-6">
            <Activity className="h-6 w-6" />
            <h3 className="text-xl font-bold">Je vote</h3>
          </div>
        </Link>
        <Link href="/projects" className="group h-full">
          <div className="h-full border border-border p-8 bg-white hover:border-black transition-all space-y-6">
            <LayoutGrid className="h-6 w-6" />
            <h3 className="text-xl font-bold">Les Projets</h3>
          </div>
        </Link>
        {isAdmin && (
          <Link href="/admin" className="group h-full">
            <div className="h-full border border-dashed border-primary p-8 bg-primary/5 hover:bg-primary/10 transition-all space-y-6">
              <Settings className="h-6 w-6" />
              <h3 className="text-xl font-bold">Administration</h3>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}

export default function AssemblyDashboard() {
  return (
    <RequireActiveMember>
      <MainLayout statusText="Dashboard">
        <AssemblyDashboardContent />
      </MainLayout>
    </RequireActiveMember>
  );
}
