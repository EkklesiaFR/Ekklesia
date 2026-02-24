
"use client";

import { MainLayout } from '@/components/layout/MainLayout';
import { VotingSession, TallyResult } from '@/types';
import { CheckCircle2, Trophy, BarChart2 } from 'lucide-react';
import Image from 'next/image';

const MOCK_RESULTS: TallyResult = {
  sessionId: 's1',
  winnerId: 'p1',
  fullRanking: [
    { projectId: 'p1', rank: 1 },
    { projectId: 'p2', rank: 2 },
    { projectId: 'p3', rank: 3 }
  ],
  totalBallots: 248,
  computedAt: new Date()
};

const MOCK_PROJECTS = [
  { id: 'p1', title: 'Rénovation du Parvis Central', budget: '45,000 €', imageUrl: 'https://picsum.photos/seed/urban/800/400' },
  { id: 'p2', title: 'Réseau de Bornes Électriques', budget: '60,000 €', imageUrl: 'https://picsum.photos/seed/energy/800/400' },
  { id: 'p3', title: 'Espace Culturel Éphémère', budget: '25,000 €', imageUrl: 'https://picsum.photos/seed/tech/800/400' }
];

export default function ResultsPage() {
  const winner = MOCK_PROJECTS.find(p => p.id === MOCK_RESULTS.winnerId);

  return (
    <MainLayout role="member" statusText="Proclamation des Résultats">
      <div className="space-y-20 animate-in fade-in duration-500">
        <header className="text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-8">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-xs uppercase tracking-[0.3em] font-bold text-muted-foreground">Scrutin Clôturé</h1>
          <h2 className="text-5xl font-bold tracking-tight">Projet Retenu</h2>
        </header>

        {winner && (
          <section className="border border-border p-12 space-y-8 bg-white text-center">
            <div className="relative h-[300px] w-full mb-12 border border-border">
              <Image src={winner.imageUrl} alt={winner.title} fill className="object-cover grayscale" />
              <div className="absolute inset-0 bg-black/10"></div>
            </div>
            <h3 className="text-4xl font-bold">{winner.title}</h3>
            <div className="flex justify-center gap-12 text-sm uppercase tracking-widest font-semibold text-muted-foreground">
              <span>Budget : {winner.budget}</span>
              <span className="border-l border-border pl-12">Total des bulletins : {MOCK_RESULTS.totalBallots}</span>
            </div>
          </section>
        )}

        <section className="space-y-12">
          <div className="flex items-center gap-4">
            <BarChart2 className="h-5 w-5 text-primary" />
            <h4 className="text-xl font-bold">Classement complet (Schulze)</h4>
          </div>
          
          <div className="space-y-4">
            {MOCK_RESULTS.fullRanking.map((item, index) => {
              const project = MOCK_PROJECTS.find(p => p.id === item.projectId);
              return (
                <div key={item.projectId} className="flex items-center gap-8 p-6 border border-border bg-white hover:border-primary/30 transition-colors">
                  <span className="text-2xl font-black text-muted-foreground/30 w-12">{item.rank}</span>
                  <div className="flex-grow">
                    <h5 className="font-bold text-lg">{project?.title}</h5>
                  </div>
                  {item.rank === 1 && <CheckCircle2 className="h-5 w-5 text-primary" />}
                </div>
              );
            })}
          </div>
        </section>

        <section className="pt-20 text-center text-xs text-muted-foreground uppercase tracking-widest leading-loose">
          Les résultats présentés ci-dessus ont été calculés automatiquement selon la méthode de Schulze.<br />
          Le dépouillement a été certifié par le conseil d'administration de l'Ekklesia.
        </section>
      </div>
    </MainLayout>
  );
}
