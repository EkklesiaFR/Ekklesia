'use client';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { useAuthStatus } from '@/components/auth/AuthStatusProvider';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collectionGroup, query, where, limit, collection } from 'firebase/firestore';
import Link from 'next/link';
import { 
  Vote as VoteIcon, 
  LayoutGrid, 
  User, 
  Settings, 
  ArrowRight,
  ChevronRight,
  Trophy,
  Users,
  Activity
} from 'lucide-react';
import { computeSchulzeResults } from '@/lib/tally';
import { Project, Vote, Ballot } from '@/types';

function AssemblyDashboardContent() {
  const { isAdmin } = useAuthStatus();
  const db = useFirestore();

  // 1. Récupération de la session de vote ouverte (ou la plus récente)
  const activeVoteQuery = useMemoFirebase(() => {
    return query(collectionGroup(db, 'votes'), where('state', 'in', ['open', 'closed']), limit(1));
  }, [db]);
  const { data: votes } = useCollection<Vote>(activeVoteQuery);
  const activeVote = votes?.[0];

  // 2. Récupération des projets pour cette session
  const projectsQuery = useMemoFirebase(() => {
    if (!activeVote) return null;
    return collection(db, 'projects');
  }, [db, activeVote]);
  const { data: allProjects } = useCollection<Project>(projectsQuery);
  const activeProjects = allProjects?.filter(p => activeVote?.projectIds.includes(p.id)) || [];

  // 3. Récupération des bulletins pour les stats
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

  const menuItems = [
    {
      title: "Voter",
      description: "Exprimez vos préférences pour la session en cours.",
      href: "/vote",
      icon: VoteIcon,
      color: "bg-primary/10 text-primary",
      disabled: activeVote?.state !== 'open'
    },
    {
      title: "Projets",
      description: "Consultez le détail des propositions soumises.",
      href: "/projects",
      icon: LayoutGrid,
      color: "bg-blue-50 text-blue-600",
      disabled: false
    },
    {
      title: "Mon Compte",
      description: "Gérez vos informations et votre statut de membre.",
      href: "/account",
      icon: User,
      color: "bg-gray-100 text-gray-600",
      disabled: false
    }
  ];

  return (
    <MainLayout statusText={activeVote?.state === 'open' ? "Vote ouvert" : "Dashboard"}>
      <div className="space-y-16 animate-in fade-in duration-700">
        <header className="space-y-6">
          <div className="space-y-2">
            <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted-foreground block">
              Espace Membre
            </span>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Une voix, une communauté.</h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl">Bienvenue dans votre interface de participation citoyenne.</p>
        </header>

        {activeVote && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="border border-border p-8 bg-white space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase tracking-widest font-bold text-muted-foreground flex items-center gap-2">
                  <Activity className="h-3 w-3" />
                  Session en cours
                </h3>
                {activeVote.state === 'open' ? (
                  <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                ) : (
                  <span className="text-[10px] font-bold text-muted-foreground">CLOS</span>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-2xl font-bold">{activeVote.question}</p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Users className="h-4 w-4" />
                    {ballots?.length || 0} bulletins déposés
                  </span>
                </div>
              </div>
              {activeVote.state === 'open' && (
                <Link href="/vote" className="block pt-4">
                  <Button className="w-full rounded-none h-12 font-bold uppercase tracking-widest text-xs">
                    Voter maintenant
                  </Button>
                </Link>
              )}
            </div>

            <div className="border border-border p-8 bg-black text-white space-y-6">
              <h3 className="text-xs uppercase tracking-widest font-bold text-gray-400 flex items-center gap-2">
                <Trophy className="h-3 w-3 text-primary" />
                {activeVote.state === 'open' ? "Tendance actuelle" : "Résultat Final"}
              </h3>
              <div className="space-y-4">
                {winnerProject ? (
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-primary">Projet en tête</p>
                    <p className="text-2xl font-bold leading-tight">{winnerProject.title}</p>
                    <p className="text-sm text-gray-400 italic">Méthode de Schulze (Condorcet)</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">Calcul des résultats en cours...</p>
                )}
              </div>
              <Link href="/results" className="block pt-4">
                <Button variant="outline" className="w-full border-gray-700 text-white hover:bg-white hover:text-black rounded-none h-12 font-bold uppercase tracking-widest text-xs">
                  Voir les détails
                </Button>
              </Link>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {menuItems.map((item) => (
            <Link key={item.href} href={item.disabled ? "#" : item.href} className={item.disabled ? "opacity-50 cursor-not-allowed" : "group"}>
              <div className="h-full border border-border p-8 bg-white hover:border-black transition-all flex flex-col justify-between space-y-8">
                <div className="space-y-6">
                  <div className={`w-12 h-12 ${item.color} flex items-center justify-center`}>
                    <item.icon className="h-6 w-6" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold">{item.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                </div>
                {!item.disabled && (
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest group-hover:gap-4 transition-all">
                    Y accéder <ChevronRight className="h-3 w-3" />
                  </div>
                )}
              </div>
            </Link>
          ))}

          {isAdmin && (
            <Link href="/admin" className="group md:col-span-3">
              <div className="border border-dashed border-primary p-8 bg-primary/5 hover:bg-primary/10 transition-all flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 bg-primary text-white flex items-center justify-center">
                    <Settings className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Administration</h3>
                    <p className="text-sm text-muted-foreground">Gérer les sessions, les membres et les émargements.</p>
                  </div>
                </div>
                <Button variant="ghost" className="rounded-none font-bold uppercase tracking-widest text-[10px]">
                  Gérer <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </Button>
              </div>
            </Link>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

export default function AssemblyDashboard() {
  return (
    <RequireActiveMember>
      <AssemblyDashboardContent />
    </RequireActiveMember>
  );
}