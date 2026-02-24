
"use client";

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, Clock, Users } from 'lucide-react';
import { VotingSession } from '@/types';
import Image from 'next/image';

// Mock current session
const MOCK_SESSION: VotingSession = {
  id: 'session-2024-03',
  title: 'Session de Printemps 2024',
  announcementAt: new Date(Date.now() - 86400000), // Yesterday
  votingOpensAt: new Date(Date.now() - 3600000), // 1 hour ago
  votingClosesAt: new Date(Date.now() + 172800000), // In 2 days
  isResultsPublished: false,
  status: 'open',
  projects: [
    {
      id: 'p1',
      title: 'Rénovation du Parvis Central',
      summary: 'Une proposition pour revitaliser l’espace public devant l’hôtel de ville avec des pavés drainants et du mobilier urbain durable.',
      budget: '45,000 €',
      keyFeatures: ['Pavés écologiques', 'Nouveau mobilier', 'Accessibilité PMR'],
      imageUrl: 'https://picsum.photos/seed/urban/800/400'
    },
    {
      id: 'p2',
      title: 'Réseau de Bornes Électriques',
      summary: 'Installation de 12 points de recharge ultra-rapides pour véhicules électriques répartis sur l’ensemble du territoire communal.',
      budget: '60,000 €',
      keyFeatures: ['Charge rapide', 'Application mobile', 'Énergie 100% verte'],
      imageUrl: 'https://picsum.photos/seed/energy/800/400'
    }
  ]
};

export default function Home() {
  const [session, setSession] = useState<VotingSession | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    setSession(MOCK_SESSION);
    
    const timer = setInterval(() => {
      if (!MOCK_SESSION) return;
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

  if (!session) return null;

  return (
    <MainLayout role="member" statusText={session.status === 'open' ? 'Scrutin en cours' : 'Annonce'}>
      <div className="space-y-16">
        <section className="space-y-6">
          <h1 className="text-4xl md:text-5xl font-bold leading-tight">
            Assemblée Ekklesia — {session.title}
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Votre participation façonne l'avenir de notre communauté. Prenez le temps d'étudier les projets soumis et exprimez vos préférences par un vote ordonné.
          </p>
        </section>

        {session.status === 'open' && (
          <section className="bg-primary/5 border border-primary/20 p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="space-y-2">
              <h2 className="text-xl font-bold flex items-center gap-3">
                <Clock className="h-5 w-5 text-primary" />
                Le vote est ouvert
              </h2>
              <div className="flex gap-6 text-sm">
                <span className="flex items-center gap-2">
                  <span className="font-semibold">{timeLeft}</span> restants
                </span>
                <span className="flex items-center gap-2 border-l border-border pl-6">
                  <Users className="h-4 w-4" />
                  <span className="font-semibold">142</span> bulletins déposés
                </span>
              </div>
            </div>
            <Link href="/vote">
              <Button size="lg" className="bg-black hover:bg-black/90 text-white rounded-none px-8 flex items-center gap-2">
                Exprimer mon choix
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </section>
        )}

        <section className="space-y-8">
          <h3 className="text-2xl font-bold">Projets soumis au vote</h3>
          <div className="grid gap-12">
            {session.projects.map((project) => (
              <div key={project.id} className="group border border-border p-0 overflow-hidden">
                <div className="relative h-[400px] w-full border-b border-border">
                  <Image 
                    src={project.imageUrl || 'https://picsum.photos/seed/ekklesia/800/400'} 
                    alt={project.title}
                    fill
                    className="object-cover grayscale hover:grayscale-0 transition-all duration-500"
                    data-ai-hint="civic project"
                  />
                </div>
                <div className="p-8 space-y-6">
                  <div className="flex justify-between items-start gap-4">
                    <h4 className="text-2xl font-bold">{project.title}</h4>
                    <span className="bg-secondary px-3 py-1 text-sm font-bold border border-border">
                      {project.budget}
                    </span>
                  </div>
                  <p className="text-lg leading-relaxed">
                    {project.summary}
                  </p>
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Points clés</p>
                    <ul className="flex flex-wrap gap-x-6 gap-y-2">
                      {project.keyFeatures.map((feat, i) => (
                        <li key={i} className="text-sm flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                          {feat}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
