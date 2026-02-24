
"use client";

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, LayoutGrid, Award, CheckCircle2 } from 'lucide-react';
import { VotingSession } from '@/types';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Mock current session for initial state display (until real data is fetched)
const MOCK_CURRENT_SESSION: VotingSession = {
  id: 'session-2024-03',
  title: 'Session de Printemps 2024',
  announcementAt: new Date(Date.now() - 86400000),
  votingOpensAt: new Date(Date.now() - 3600000),
  votingClosesAt: new Date(Date.now() + 172800000),
  isResultsPublished: false,
  status: 'open',
  projects: []
};

export default function Home() {
  const db = useFirestore();
  const [session, setSession] = useState<VotingSession | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');

  // Query for the latest published session
  const lastPublishedSessionQuery = useMemoFirebase(() => {
    return query(
      collection(db, 'publicVotingSessions'),
      where('status', '==', 'published'),
      orderBy('resultsPublishedAt', 'desc'),
      limit(1)
    );
  }, [db]);

  const { data: publishedSessions, isLoading: isPublishedLoading } = useCollection(lastPublishedSessionQuery);
  const lastPublishedSession = publishedSessions?.[0] as VotingSession | undefined;

  useEffect(() => {
    setSession(MOCK_CURRENT_SESSION);
    
    const timer = setInterval(() => {
      const now = new Date();
      const diff = MOCK_CURRENT_SESSION.votingClosesAt.getTime() - now.getTime();
      
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
      <div className="space-y-24 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">
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

        {/* Latest Funded Projects Section */}
        <section className="space-y-12 pt-12 border-t border-border">
          <header className="space-y-4">
            <h2 className="text-3xl font-bold tracking-tight">Derniers projets financés</h2>
            <div className="h-1 w-20 bg-[#7DC092]"></div>
          </header>

          {!isPublishedLoading && lastPublishedSession ? (
            <div className="space-y-12">
              <div className="grid gap-8">
                {/* Winner Highlight */}
                {lastPublishedSession.winnerProjectTitle && (
                  <div className="bg-secondary/30 p-8 border border-border group hover:border-[#7DC092]/30 transition-all">
                    <div className="flex items-start gap-6">
                      <div className="w-12 h-12 flex items-center justify-center bg-black text-white rounded-none flex-shrink-0">
                        <Award className="h-6 w-6" />
                      </div>
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <p className="text-[10px] uppercase tracking-widest font-bold text-[#7DC092]">Lauréat — {lastPublishedSession.title}</p>
                          <h3 className="text-2xl font-bold">{lastPublishedSession.winnerProjectTitle}</h3>
                        </div>
                        <p className="text-muted-foreground leading-relaxed max-w-xl">
                          Ce projet a été plébiscité par la communauté lors de la session de {format(new Date(lastPublishedSession.resultsPublishedAt || lastPublishedSession.votingClosesAt), 'MMMM yyyy', { locale: fr })}.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Other Rankings or Project List Fallback */}
                <div className="divide-y divide-border">
                  {(lastPublishedSession.rankingSummary || lastPublishedSession.projects || []).slice(0, 5).map((item: any, i: number) => {
                    const isWinner = i === 0 && lastPublishedSession.winnerProjectTitle === (item.title || item.projectId);
                    if (isWinner && lastPublishedSession.winnerProjectTitle) return null;

                    return (
                      <div key={item.id || item.projectId || i} className="py-6 flex items-baseline gap-8 group">
                        <span className="text-xl font-black text-muted-foreground/20 w-6">
                          {item.rank || i + 1}.
                        </span>
                        <div className="flex-grow space-y-1">
                          <h4 className="text-lg font-bold tracking-tight group-hover:text-primary transition-colors">
                            {item.title}
                          </h4>
                          <p className="text-sm text-muted-foreground line-clamp-1">{item.summary}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="text-xs font-bold uppercase tracking-widest bg-secondary px-2 py-1 border border-border">
                            {item.budget}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {!lastPublishedSession.rankingSummary && lastPublishedSession.projects && (
                <p className="text-xs text-muted-foreground italic flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3" />
                  Résultats en cours de consolidation pour cette session.
                </p>
              )}

              <div className="pt-4">
                <Link href="/results" className="text-xs uppercase tracking-[0.2em] font-black text-[#7DC092] hover:text-[#7DC092]/80 transition-colors">
                  Consulter les procès-verbaux complets
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-8 py-12 text-center border border-dashed border-border bg-secondary/10">
              <div className="space-y-4">
                <p className="text-muted-foreground italic max-w-md mx-auto leading-relaxed">
                  Aucun projet financé pour le moment. Les premiers résultats apparaîtront ici après la première assemblée.
                </p>
                <Link href="/projects">
                  <Button variant="outline" className="rounded-none px-8 font-bold uppercase tracking-widest text-xs h-12 border-border hover:bg-black hover:text-white transition-all">
                    Voir les projets en cours
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Manifesto/Mission Section */}
        <section className="grid md:grid-cols-2 gap-16 py-12 border-t border-border">
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
