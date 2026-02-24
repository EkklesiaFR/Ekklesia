
'use client';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, LayoutGrid, Award } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useEffect, useState } from 'react';

const MOCK_CURRENT_SESSION = {
  id: 'session-2024-03',
  votingClosesAt: new Date(Date.now() + 172800000),
};

export default function Home() {
  const db = useFirestore();
  const [timeLeft, setTimeLeft] = useState<string>('');

  const lastPublishedSessionQuery = useMemoFirebase(() => {
    return query(
      collection(db, 'publicVotingSessions'),
      where('status', '==', 'published'),
      orderBy('resultsPublishedAt', 'desc'),
      limit(1)
    );
  }, [db]);

  const { data: publishedSessions, isLoading: isPublishedLoading } = useCollection(lastPublishedSessionQuery);
  const lastPublishedSession = publishedSessions?.[0] as any | undefined;

  useEffect(() => {
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

  const formatDate = (date: any) => {
    if (!date) return '';
    try {
      const d = date.toDate ? date.toDate() : new Date(date);
      return format(d, 'MMMM yyyy', { locale: fr });
    } catch (e) {
      return '';
    }
  };

  return (
    <RequireActiveMember>
      <MainLayout role="member" statusText="Vote ouvert">
        <div className="space-y-24 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-20">
          <section className="space-y-12">
            <div className="space-y-4">
              <span className="text-xs uppercase tracking-[0.3em] font-bold text-muted-foreground block">
                assemblée de mars 2026
              </span>
              <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight text-balance text-black">
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

          <section className="space-y-12 pt-12 border-t border-border">
            <header className="space-y-4">
              <h2 className="text-3xl font-bold tracking-tight text-black">Derniers projets financés</h2>
              <div className="h-1 w-20 bg-[#7DC092]"></div>
            </header>
            {!isPublishedLoading && lastPublishedSession ? (
              <div className="space-y-12">
                <div className="grid gap-8">
                  {lastPublishedSession.winnerProjectTitle && (
                    <div className="bg-secondary/30 p-8 border border-border group hover:border-[#7DC092]/30 transition-all">
                      <div className="flex items-start gap-6">
                        <div className="w-12 h-12 flex items-center justify-center bg-black text-white rounded-none flex-shrink-0">
                          <Award className="h-6 w-6" />
                        </div>
                        <div className="space-y-4">
                          <div className="space-y-1">
                            <p className="text-[10px] uppercase tracking-widest font-bold text-[#7DC092]"> Lauréat — {lastPublishedSession.title}</p>
                            <h3 className="text-2xl font-bold text-black">{lastPublishedSession.winnerProjectTitle}</h3>
                          </div>
                          <p className="text-muted-foreground leading-relaxed max-w-xl">
                            Ce projet a été plébiscité par la communauté lors de la session de {formatDate(lastPublishedSession.resultsPublishedAt || lastPublishedSession.votingClosesAt)}.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="pt-4">
                  <Link href="/results" className="text-xs uppercase tracking-[0.2em] font-black text-[#7DC092] hover:text-[#7DC092]/80 transition-colors">
                    Consulter les procès-verbaux complets
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-8 py-12 text-center border border-dashed border-border bg-secondary/10">
                <p className="text-muted-foreground italic max-w-md mx-auto leading-relaxed">
                  Aucun projet financé pour le moment.
                </p>
              </div>
            )}
          </section>
        </div>
      </MainLayout>
    </RequireActiveMember>
  );
}
