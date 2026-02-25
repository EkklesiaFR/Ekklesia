'use client';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { useAuthStatus } from '@/components/auth/AuthStatusProvider';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, limit, doc } from 'firebase/firestore';
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
import { useEffect } from 'react';

function ParticipationPanel({ ballotCount, eligibleCount }: { ballotCount?: number; eligibleCount?: number }) {
  if (eligibleCount === undefined || eligibleCount === null || eligibleCount === 0) {
    return (
      <div className="p-4 bg-secondary/10 border border-dashed border-border text-center">
        <p className="text-[10px] uppercase font-bold text-muted-foreground">Quorum en calcul…</p>
        <p className="text-[9px] text-muted-foreground mt-1 italic">Vérifiez l'ouverture du scrutin (Admin)</p>
        <p className="text-[8px] text-muted-foreground/50 mt-2 font-mono">Bulletins: {ballotCount ?? "—"}</p>
      </div>
    );
  }

  const voters = ballotCount ?? 0;
  const participationRate = eligibleCount > 0 ? Math.round((voters / eligibleCount) * 100) : 0;
  const abstentionCount = Math.max(0, eligibleCount - voters);
  const abstentionRate = eligibleCount > 0 ? Math.round((abstentionCount / eligibleCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-widest font-bold text-gray-400 flex items-center gap-2">
          <PieChart className="h-3 w-3 text-primary" /> Participation
        </h3>
        <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
          {eligibleCount > 0 ? `${participationRate}%` : "—"}
        </span>
      </div>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest text-gray-400">
            <span>Votants</span>
            <span className="text-white">{ballotCount ?? "—"}</span>
          </div>
          <Progress value={participationRate} className="h-1 bg-gray-800" />
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest text-gray-400">
            <span>Abstention</span>
            <span className="text-white">{abstentionCount}</span>
          </div>
          <Progress value={abstentionRate} className="h-1 bg-gray-800" />
        </div>
      </div>
    </div>
  );
}

function AssemblyDashboardContent() {
  const { isAdmin, isMemberLoading } = useAuthStatus();
  const db = useFirestore();

  // 1. Trouver l'assemblée ouverte
  const openAssemblyQuery = useMemoFirebase(() => {
    return query(collection(db, 'assemblies'), where('state', '==', 'open'), limit(1));
  }, [db]);
  const { data: openAssemblies, isLoading: isAssemblyLoading } = useCollection<Assembly>(openAssemblyQuery);
  const activeAssembly = openAssemblies?.[0];

  // 2. Charger le vote associé
  const voteRef = useMemoFirebase(() => {
    if (!activeAssembly?.activeVoteId) return null;
    return doc(db, 'assemblies', activeAssembly.id, 'votes', activeAssembly.activeVoteId);
  }, [db, activeAssembly]);
  const { data: activeVote, isLoading: isVoteLoading } = useDoc<Vote>(voteRef);

  // 3. Charger les projets pour l'affichage (Utilisé pour les titres des résultats)
  const projectsQuery = useMemoFirebase(() => collection(db, 'projects'), [db]);
  const { data: allProjects } = useCollection<Project>(projectsQuery);
  const activeProjects = allProjects?.filter(p => activeVote?.projectIds.includes(p.id)) || [];

  // Log de diagnostic temporaire
  useEffect(() => {
    if (activeVote) {
      console.log("vote fields (Dashboard)", { 
        ballotCount: activeVote.ballotCount, 
        eligibleCount: activeVote.eligibleCount, 
        voteId: activeVote.id,
        state: activeVote.state
      });
    }
  }, [activeVote]);

  if (isAssemblyLoading || isVoteLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-12 h-12 border-t-2 border-primary animate-spin rounded-full"></div>
      </div>
    );
  }

  const showAdminTrends = !isMemberLoading && isAdmin && activeAssembly && activeVote;

  return (
    <div className="space-y-16 animate-in fade-in duration-700">
      <header className="space-y-6">
        <div className="space-y-2">
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted-foreground block">Espace Membre</span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-black">Une voix, une communauté.</h1>
        </div>
      </header>

      {!activeAssembly ? (
        <section className="border border-border p-12 bg-secondary/5 text-center space-y-6">
          <Activity className="h-8 w-8 text-muted-foreground mx-auto" />
          <h2 className="text-2xl font-bold">Aucun vote ouvert</h2>
        </section>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* PANNEAU GAUCHE : VOTE */}
          <div className="border border-border p-8 bg-white space-y-8 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-2">
                  <Activity className="h-3 w-3" /> Vote en cours
                </h3>
                <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              </div>
              <div className="space-y-4">
                <p className="text-2xl font-bold leading-tight">{activeVote?.question || activeAssembly.title}</p>
                <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2 font-medium">
                    <Users className="h-4 w-4 text-primary" /> <strong>{activeVote?.ballotCount ?? 0}</strong> bulletins
                  </span>
                  {activeVote?.closesAt && (
                    <span className="flex items-center gap-2 font-medium">
                      <Clock className="h-4 w-4 text-primary" />
                      Clôture {formatDistanceToNow(new Date(activeVote.closesAt.seconds * 1000), { addSuffix: true, locale: fr })}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Link href="/vote" className="block pt-4">
              <Button className="w-full rounded-none h-14 font-bold uppercase tracking-widest text-xs">Je vote</Button>
            </Link>
          </div>

          {/* PANNEAU DROIT : PARTICIPATION OU TRENDS (ADMIN) */}
          <div className="border border-border p-8 bg-black text-white space-y-8 flex flex-col justify-between">
            {showAdminTrends ? (
              <AdminTrendsPanel 
                assemblyId={activeAssembly.id} 
                voteId={activeVote.id} 
                projects={activeProjects} 
              />
            ) : activeVote?.state === 'locked' && activeVote.results ? (
              <div className="space-y-6">
                <h3 className="text-xs uppercase tracking-widest font-bold text-gray-400">Résultats officiels</h3>
                <div className="space-y-2">
                  <p className="text-[10px] uppercase font-bold text-primary tracking-widest">Élu à l&apos;unanimité</p>
                  <p className="text-2xl font-bold">
                    {activeProjects.find(p => p.id === activeVote.results?.winnerId)?.title || "Calculé"}
                  </p>
                </div>
              </div>
            ) : (
              <ParticipationPanel 
                ballotCount={activeVote?.ballotCount} 
                eligibleCount={activeVote?.eligibleCount} 
              />
            )}
            <Link href="/projects" className="block pt-4">
              <Button variant="outline" className="w-full border-gray-700 text-white hover:bg-white hover:text-black rounded-none h-12 font-bold uppercase tracking-widest text-xs">Détails des projets</Button>
            </Link>
          </div>
        </div>
      )}

      {/* RACCOURCIS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-8 border-t border-border">
        <Link href={activeAssembly ? "/vote" : "#"} className={cn("group h-full", !activeAssembly && "opacity-50 pointer-events-none")}>
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