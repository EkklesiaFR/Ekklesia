
"use client";

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, LayoutGrid } from 'lucide-react';
import { VotingSession } from '@/types';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Mock current session for initial state
const MOCK_SESSION: VotingSession = {
  id: 'session-2024-03',
  title: 'Session de Printemps 2024',
  announcementAt: new Date(Date.now() - 86400000),
  votingOpensAt: new Date(Date.now() - 3600000),
  votingClosesAt: new Date(Date.now() + 172800000),
  isResultsPublished: false,
  status: 'open',
  projects: [] // Not needed on home anymore
};

export default function Home() {
  const db = useFirestore();
  const [session, setSession] = useState<VotingSession | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');

  // Query for the last published session
  const lastSessionQuery = useMemoFirebase(() => {
    return query(
      collection(db, 'publicVotingSessions'),
      orderBy('resultsPublishedAt', 'desc'),
      limit(1)
    );
  }, [db]);

  const { data: lastSessions, isLoading: isLastSessionLoading } = useCollection(lastSessionQuery);
  const lastPublishedSession = lastSessions?.[0];

  useEffect(() => {
    setSession(MOCK_SESSION);
    
    const timer = setInterval(() => {
      const now = new Date();
      const diff = MOCK_SESSION.votingClosesAt.getTime() - now.getTime();
      
      if (diff <= 0) {
        setTimeLeft('Vote clos');
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      
      setTimeLeft(`${days}j ${hours}h ${minutes}m`);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getStatusText = (s: VotingSession) => {
    const now = new Date();
    if (s.isResultsPublished || s.status === 'published') return "Résultats publiés";
    if (now < s.votingOpensAt) return "Vote à venir";
    if (now > s.votingClosesAt) return "Vote clos";
    return "Vote ouvert";
  };

  if (!session) return null;

  return (
    <MainLayout role="member" statusText={getStatusText(session)}>
      <div className="space-y-24 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        {/* Hero Section */}
        <section className="space-y-12">
          <div className="space-y-4">
            <span className="text-xs uppercase tracking-[0.3em] font-bold text-muted-foreground block">
              assemblée de mars 2026
            </span>
            <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight text-balance">
              1 voix. 1 communauté.<br />
              Des milliers de projets à financer.
            </h1>
          </div>
          <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-2xl font-medium">
            Votre participation façonne l'avenir de notre communauté. Prenez le temps d'étudier les projets soumis et exprimez vos préférences par un vote ordonné.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Link href="/projects">
              <Button size="lg" className="w-full sm:w-auto bg-black hover:bg-black/90 text-white rounded-none px-10 py-8 text-lg flex items-center gap-3 transition-all">
                <LayoutGrid className="h-5 w-5" />
                Voir les projets
              </Button>
            </Link>
            <Link href="/vote">
              <Button size="lg" variant="outline" className="w-full sm:w-auto border-black hover:bg-black hover:text-white rounded-none px-10 py-8 text-lg flex items-center gap-3 transition-all">
                votez
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Typographic Counters */}
        <section className="border-y border-border py-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-12">
          <div className="flex flex-col md:flex-row gap-12 md:gap-16">
            <div className="space-y-1">
              <p className="text-sm uppercase tracking-widest font-bold text-muted-foreground">Participation</p>
              <p className="text-3xl font-bold">
                <span className="text-[#7DC092]">142</span> bulletins déposés
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm uppercase tracking-widest font-bold text-muted-foreground">Échéance</p>
              <p className="text-3xl font-bold">
                Clôture dans <span className="text-[#7DC092]">{timeLeft}</span>
              </p>
            </div>
          </div>
        </section>

        {/* Last Assembly Section (Only if published session exists) */}
        {!isLastSessionLoading && lastPublishedSession && (
          <section className="space-y-8 py-12 border-b border-border">
            <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-muted-foreground">
              Dernière assemblée
            </h3>
            <div className="space-y-2">
              <p className="text-3xl font-bold tracking-tight">
                Projet retenu : {lastPublishedSession.winnerProjectTitle}
              </p>
              <p className="text-lg text-muted-foreground">
                {lastPublishedSession.resultsPublishedAt && format(new Date(lastPublishedSession.resultsPublishedAt), 'MMMM yyyy', { locale: fr })} — {lastPublishedSession.totalBallotsCount} bulletins
              </p>
            </div>
            <Link 
              href="/results" 
              className="inline-block text-xs uppercase tracking-[0.2em] font-black text-[#7DC092] hover:text-[#7DC092]/80 transition-colors"
            >
              Voir le procès-verbal
            </Link>
          </section>
        )}

        {/* Manifesto/Mission Section */}
        <section className="grid md:grid-cols-2 gap-16 py-12">
          <div className="space-y-6">
            <h3 className="text-3xl font-bold tracking-tight">Le Manifeste Ekklesia</h3>
            <div className="h-1 w-20 bg-[#7DC092]"></div>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Nous croyons en une démocratie directe, transparente et technologique. Ekklesia permet à chaque membre de l'assemblée de peser sur les décisions budgétaires de manière équitable grâce au vote par classement.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8">
            <div className="space-y-2">
              <h4 className="font-bold uppercase tracking-widest text-sm">Transparence Totale</h4>
              <p className="text-muted-foreground">Chaque bulletin est cryptographié et vérifiable, assurant l'intégrité absolue du scrutin.</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-bold uppercase tracking-widest text-sm">Méthode Schulze</h4>
              <p className="text-muted-foreground">Nous utilisons des algorithmes de théorie des jeux pour dégager un consensus réel, dépassant le simple vote majoritaire.</p>
            </div>
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
