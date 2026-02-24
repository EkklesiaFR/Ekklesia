'use client';

import { useEffect } from 'react';
import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { useAuthStatus } from '@/components/auth/AuthStatusProvider';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collectionGroup, query, where, limit, collection } from 'firebase/firestore';
import Link from 'next/link';
import { 
  LayoutGrid, 
  User, 
  Settings, 
  Trophy,
  Users,
  Activity,
  Clock,
  Landmark
} from 'lucide-react';
import { computeSchulzeResults } from '@/lib/tally';
import { Project, Vote, Ballot } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

function AssemblyDashboardContent() {
  const { isAdmin } = useAuthStatus();
  const db = useFirestore();

  // 1. Récupération de la session de vote ouverte ou close
  const activeVoteQuery = useMemoFirebase(() => {
    // On cherche d'abord le vote ouvert, sinon le plus récent clos
    return query(collectionGroup(db, 'votes'), where('state', 'in', ['open', 'closed']), limit(1));
  }, [db]);

  const { data: votes, isLoading: isVotesLoading, error: voteError } = useCollection<Vote>(activeVoteQuery);
  const activeVote = votes?.[0];

  // Logs de diagnostic
  useEffect(() => {
    console.log('[DEBUG] AssemblyDashboard: votes récupérés:', votes);
    if (voteError) console.error('[DEBUG] AssemblyDashboard: Erreur query votes:', voteError);
  }, [votes, voteError]);

  // 2. Récupération des projets
  const projectsQuery = useMemoFirebase(() => {
    return collection(db, 'projects');
  }, [db]);
  const { data: allProjects } = useCollection<Project>(projectsQuery);
  const activeProjects = allProjects?.filter(p => activeVote?.projectIds.includes(p.id)) || [];

  // 3. Récupération des bulletins (uniquement si un vote est identifié)
  const ballotsQuery = useMemoFirebase(() => {
    if (!activeVote) return null;
    return collection(db, 'assemblies', activeVote.assemblyId, 'votes', activeVote.id, 'ballots');
  }, [db, activeVote]);
  const { data: ballots } = useCollection<Ballot>(ballotsQuery);

  // 4. Calcul des résultats (Schulze)
  const results = (ballots && activeProjects.length > 0) 
    ? computeSchulzeResults(activeProjects.map(p => p.id), ballots)
    : null;

  const winnerProject = results?.winnerId ? activeProjects.find(p => p.id === results.winnerId) : null;

  if (isVotesLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-12 h-12 border-t-2 border-primary animate-spin rounded-full"></div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Chargement du dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-16 animate-in fade-in duration-700">
      <header className="space-y-6">
        <div className="space-y-2">
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted-foreground block">
            Espace Membre
          </span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-black">Une voix, une communauté.</h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-2xl font-medium">Bienvenue dans votre interface de participation citoyenne.</p>
      </header>

      {!activeVote ? (
        <section className="border border-border p-12 bg-secondary/5 text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-muted flex items-center justify-center rounded-full mb-4">
            <Activity className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Aucune session active</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Il n'y a pas de session de vote ouverte pour le moment.
            </p>
          </div>
          {isAdmin && (
            <Link href="/admin">
              <Button variant="outline" className="rounded-none uppercase tracking-widest text-[10px] font-bold h-12 px-8">
                Aller à l'administration
              </Button>
            </Link>
          )}
        </section>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="border border-border p-8 bg-white space-y-8 flex flex-col justify-between">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-2">
                    <Activity className="h-3 w-3" />
                    Scrutin en cours
                  </h3>
                  {activeVote.state === 'open' ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Ouvert</span>
                      <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold text-muted-foreground px-2 py-1 bg-secondary uppercase">CLOS</span>
                  )}
                </div>
                
                <div className="space-y-4">
                  <p className="text-2xl font-bold leading-tight">{activeVote.question}</p>
                  
                  <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                    <span className="flex items-center gap-2 font-medium">
                      <Users className="h-4 w-4 text-primary" />
                      <strong>{ballots?.length || 0}</strong> bulletins déposés
                    </span>
                    
                    {activeVote.closesAt && activeVote.state === 'open' && (
                      <span className="flex items-center gap-2 font-medium">
                        <Clock className="h-4 w-4 text-primary" />
                        Clôture {formatDistanceToNow(new Date(activeVote.closesAt.seconds * 1000), { addSuffix: true, locale: fr })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {activeVote.state === 'open' && (
                <Link href="/vote" className="block pt-4">
                  <Button className="w-full rounded-none h-14 font-bold uppercase tracking-widest text-xs shadow-sm hover:shadow-md transition-all">
                    Voter maintenant
                  </Button>
                </Link>
              )}
            </div>

            <div className="border border-border p-8 bg-black text-white space-y-8 flex flex-col justify-between">
              <div className="space-y-6">
                <h3 className="text-xs uppercase tracking-widest font-bold text-gray-400 flex items-center gap-2">
                  <Trophy className="h-3 w-3 text-primary" />
                  {activeVote.state === 'open' ? "Tendance actuelle" : "Résultat Final"}
                </h3>
                <div className="space-y-4">
                  {winnerProject ? (
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase font-bold tracking-widest text-primary">En tête</p>
                      <p className="text-2xl font-bold leading-tight">{winnerProject.title}</p>
                      <p className="text-xs text-gray-400 italic">Calculé via la méthode de Schulze</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">En attente des premiers bulletins...</p>
                  )}
                </div>
              </div>
              <Link href="/results" className="block pt-4">
                <Button variant="outline" className="w-full border-gray-700 text-white hover:bg-white hover:text-black rounded-none h-12 font-bold uppercase tracking-widest text-xs">
                  Détail des votes
                </Button>
              </Link>
            </div>
          </div>

          <section className="space-y-8">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 className="text-xs uppercase tracking-widest font-bold text-muted-foreground">
                Projets soumis ({activeProjects.length})
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeProjects.map((project) => (
                <div key={project.id} className="group border border-border p-6 bg-white space-y-4 hover:border-black transition-all">
                  <div className="space-y-1">
                    <h4 className="font-bold text-lg">{project.title}</h4>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{project.budget}</p>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                    {project.summary}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-8 border-t border-border">
        <Link href="/vote" className="group">
          <div className="h-full border border-border p-8 bg-white hover:border-black transition-all space-y-6">
            <div className="w-12 h-12 bg-secondary text-black flex items-center justify-center">
              <Activity className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Je vote</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">Participez au scrutin en cours et exprimez vos préférences.</p>
            </div>
          </div>
        </Link>

        <Link href="/projects" className="group">
          <div className="h-full border border-border p-8 bg-white hover:border-black transition-all space-y-6">
            <div className="w-12 h-12 bg-secondary text-black flex items-center justify-center">
              <LayoutGrid className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Les Projets</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">Consultez l'ensemble des initiatives citoyennes déposées.</p>
            </div>
          </div>
        </Link>

        {isAdmin ? (
          <Link href="/admin" className="group">
            <div className="h-full border border-dashed border-primary p-8 bg-primary/5 hover:bg-primary/10 transition-all space-y-6">
              <div className="w-12 h-12 bg-primary text-white flex items-center justify-center">
                <Settings className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">Administration</h3>
                <p className="text-sm text-muted-foreground">Outils de gestion des sessions, des membres et des projets.</p>
              </div>
            </div>
          </Link>
        ) : (
          <Link href="/account" className="group">
            <div className="h-full border border-border p-8 bg-white hover:border-black transition-all space-y-6">
              <div className="w-12 h-12 bg-secondary text-black flex items-center justify-center">
                <User className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">Mon Compte</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">Gérez vos informations et votre statut de membre actif.</p>
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
