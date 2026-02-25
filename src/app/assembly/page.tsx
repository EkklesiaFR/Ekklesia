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
  User, 
  Settings, 
  Trophy,
  Users,
  Activity,
  Clock,
  Landmark,
  PieChart
} from 'lucide-react';
import { computeSchulzeResults } from '@/lib/tally';
import { Project, Vote, Assembly, Ballot } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

function ParticipationPanel({ ballotCount = 0, eligibleCount = 100 }: { ballotCount?: number, eligibleCount?: number }) {
  const participationRate = eligibleCount > 0 ? Math.round((ballotCount / eligibleCount) * 100) : 0;
  const abstentionRate = 100 - participationRate;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-widest font-bold text-gray-400 flex items-center gap-2">
          <PieChart className="h-3 w-3 text-primary" /> Participation
        </h3>
        <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{participationRate}%</span>
      </div>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest text-gray-400">
            <span>Votants</span>
            <span className="text-white">{ballotCount}</span>
          </div>
          <Progress value={participationRate} className="h-1 bg-gray-800" />
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest text-gray-400">
            <span>Abstention</span>
            <span className="text-white">{eligibleCount - ballotCount}</span>
          </div>
          <Progress value={abstentionRate} className="h-1 bg-gray-800" />
        </div>
      </div>
    </div>
  );
}

function AssemblyDashboardContent() {
  const { isAdmin } = useAuthStatus();
  const db = useFirestore();

  const openAssemblyQuery = useMemoFirebase(() => {
    return query(collection(db, 'assemblies'), where('state', '==', 'open'), limit(1));
  }, [db]);
  const { data: openAssemblies, isLoading: isAssemblyLoading } = useCollection<Assembly>(openAssemblyQuery);
  const activeAssembly = openAssemblies?.[0];

  const voteRef = useMemoFirebase(() => {
    if (!activeAssembly?.activeVoteId) return null;
    return doc(db, 'assemblies', activeAssembly.id, 'votes', activeAssembly.activeVoteId);
  }, [db, activeAssembly]);
  const { data: activeVote, isLoading: isVoteLoading } = useDoc<Vote>(voteRef);

  const projectsQuery = useMemoFirebase(() => collection(db, 'projects'), [db]);
  const { data: allProjects } = useCollection<Project>(projectsQuery);
  const activeProjects = allProjects?.filter(p => activeVote?.projectIds.includes(p.id)) || [];

  /**
   * PREUVE DE SÉCURITÉ :
   * La requête LIST sur 'ballots' est STRICTEMENT conditionnée par isAdmin.
   * Si isAdmin est false (membre standard), ballotsQuery est null.
   * Le hook useCollection ne lancera AUCUNE requête si ballotsQuery est null.
   */
  const canListBallots = isAdmin === true;
  const ballotsQuery = useMemoFirebase(() => {
    if (!canListBallots || !activeAssembly || !activeVote) return null;
    return collection(db, 'assemblies', activeAssembly.id, 'votes', activeVote.id, 'ballots');
  }, [db, activeAssembly, activeVote, canListBallots]);
  
  const { data: ballots } = useCollection<Ballot>(ballotsQuery);

  const results = (canListBallots && ballots && activeProjects.length > 0) 
    ? computeSchulzeResults(activeProjects.map(p => p.id), ballots)
    : activeVote?.results;

  const winnerProject = results?.winnerId ? activeProjects.find(p => p.id === results.winnerId) : null;

  if (isAssemblyLoading || isVoteLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-12 h-12 border-t-2 border-primary animate-spin rounded-full"></div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-16 animate-in fade-in duration-700">
      <header className="space-y-6">
        <div className="space-y-2">
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted-foreground block">Espace Membre</span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-black">Une voix, une communauté.</h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-2xl font-medium">Bienvenue dans votre interface de participation citoyenne.</p>
      </header>

      {!activeAssembly ? (
        <section className="border border-border p-12 bg-secondary/5 text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-muted flex items-center justify-center rounded-full mb-4">
            <Activity className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Aucun vote ouvert</h2>
            <p className="text-muted-foreground max-w-md mx-auto">Revenez prochainement pour participer.</p>
          </div>
        </section>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="border border-border p-8 bg-white space-y-8 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-2">
                  <Activity className="h-3 w-3" /> Vote en cours
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Ouvert</span>
                  <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-2xl font-bold leading-tight">{activeVote?.question || activeAssembly.title}</p>
                <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                  <span className="flex items-center gap-2 font-medium">
                    <Users className="h-4 w-4 text-primary" /> <strong>{activeVote?.ballotCount || 0}</strong> bulletins
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

          <div className="border border-border p-8 bg-black text-white space-y-8 flex flex-col justify-between">
            {canListBallots || activeVote?.state === 'closed' ? (
              <div className="space-y-6">
                <h3 className="text-xs uppercase tracking-widest font-bold text-gray-400 flex items-center gap-2">
                  <Trophy className="h-3 w-3 text-primary" /> {canListBallots && activeVote?.state === 'open' ? "Tendance Live (Admin)" : "Résultats officiels"}
                </h3>
                <div className="space-y-4">
                  {winnerProject ? (
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase font-bold tracking-widest text-primary">
                        {activeVote?.state === 'open' ? 'En tête' : 'Projet retenu'}
                      </p>
                      <p className="text-2xl font-bold leading-tight">{winnerProject.title}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Calcul en cours...</p>
                  )}
                </div>
              </div>
            ) : (
              <ParticipationPanel 
                ballotCount={activeVote?.ballotCount} 
                eligibleCount={activeVote?.eligibleCount || 100} 
              />
            )}
            <Link href="/projects" className="block pt-4">
              <Button variant="outline" className="w-full border-gray-700 text-white hover:bg-white hover:text-black rounded-none h-12 font-bold uppercase tracking-widest text-xs">Détails des projets</Button>
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-8 border-t border-border">
        <Link href={activeAssembly ? "/vote" : "#"} className={cn("group h-full", !activeAssembly && "opacity-50 pointer-events-none")}>
          <div className="h-full border border-border p-8 bg-white hover:border-black transition-all space-y-6">
            <div className="w-12 h-12 bg-secondary text-black flex items-center justify-center"><Activity className="h-6 w-6" /></div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Je vote</h3>
              <p className="text-sm text-muted-foreground">Exprimez vos préférences pour la session.</p>
            </div>
          </div>
        </Link>
        <Link href="/projects" className="group h-full">
          <div className="h-full border border-border p-8 bg-white hover:border-black transition-all space-y-6">
            <div className="w-12 h-12 bg-secondary text-black flex items-center justify-center"><LayoutGrid className="h-6 w-6" /></div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Les Projets</h3>
              <p className="text-sm text-muted-foreground">Consultez les initiatives citoyennes.</p>
            </div>
          </div>
        </Link>
        {isAdmin ? (
          <Link href="/admin" className="group h-full">
            <div className="h-full border border-dashed border-primary p-8 bg-primary/5 hover:bg-primary/10 transition-all space-y-6">
              <div className="w-12 h-12 bg-primary text-white flex items-center justify-center"><Settings className="h-6 w-6" /></div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">Administration</h3>
                <p className="text-sm text-muted-foreground">Gérer les sessions et les membres.</p>
              </div>
            </div>
          </Link>
        ) : (
          <Link href="/account" className="group h-full">
            <div className="h-full border border-border p-8 bg-white hover:border-black transition-all space-y-6">
              <div className="w-12 h-12 bg-secondary text-black flex items-center justify-center"><User className="h-6 w-6" /></div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">Mon Compte</h3>
                <p className="text-sm text-muted-foreground">Gérez vos informations de membre.</p>
              </div>
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
