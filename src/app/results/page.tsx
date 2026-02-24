
"use client";

import { MainLayout } from '@/components/layout/MainLayout';
import { TallyResult } from '@/types';
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
  { id: 'p1', title: 'Rénovation du Parvis Central', budget: '45 000 €', imageUrl: 'https://picsum.photos/seed/urban/1200/600' },
  { id: 'p2', title: 'Réseau de Bornes Électriques', budget: '60 000 €', imageUrl: 'https://picsum.photos/seed/energy/1200/600' },
  { id: 'p3', title: 'Espace Culturel Éphémère', budget: '25 000 €', imageUrl: 'https://picsum.photos/seed/tech/1200/600' }
];

export default function ResultsPage() {
  const winner = MOCK_PROJECTS.find(p => p.id === MOCK_RESULTS.winnerId);

  return (
    <MainLayout role="member" statusText="Résultats publiés">
      <div className="space-y-24 animate-in fade-in duration-700">
        <header className="space-y-8">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] font-bold text-muted-foreground">
              ASSEMBLÉE — MARS 2024
            </p>
            <p className="text-xs uppercase tracking-[0.3em] font-bold text-muted-foreground">
              Procès-verbal
            </p>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Décision de l’assemblée
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
            À l’issue du vote ordonné, le projet suivant a été retenu par la communauté.
          </p>
        </header>

        {winner && (
          <section className="space-y-12">
            <div className="relative aspect-[21/9] w-full border border-border overflow-hidden">
              <Image 
                src={winner.imageUrl} 
                alt={winner.title} 
                fill 
                className="object-cover grayscale"
                data-ai-hint="civic project"
              />
            </div>
            
            <div className="grid md:grid-cols-2 gap-16 items-start">
              <div className="space-y-6">
                <h2 className="text-4xl font-bold tracking-tight">{winner.title}</h2>
                <div className="h-1 w-12 bg-primary"></div>
              </div>
              
              <div className="space-y-8 pt-2">
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Budget alloué</p>
                    <p className="text-lg font-medium">{winner.budget}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Nombre total de bulletins</p>
                    <p className="text-lg font-medium">{MOCK_RESULTS.totalBallots}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Méthode de calcul</p>
                    <p className="text-lg font-medium">Condorcet (Schulze)</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="space-y-12 border-t border-border pt-16">
          <h3 className="text-xs uppercase tracking-widest font-bold text-muted-foreground">
            Classement des projets
          </h3>
          
          <div className="divide-y divide-border">
            {MOCK_RESULTS.fullRanking.map((item) => {
              const project = MOCK_PROJECTS.find(p => p.id === item.projectId);
              return (
                <div key={item.projectId} className="py-8 flex items-baseline gap-12 group">
                  <span className="text-2xl font-black text-muted-foreground/20 w-8">{item.rank}.</span>
                  <div className="flex-grow">
                    <h4 className="text-xl font-bold tracking-tight">{project?.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{project?.budget}</p>
                  </div>
                  {item.rank === 1 && (
                    <span className="text-[10px] uppercase tracking-widest font-black text-primary px-3 py-1 border border-primary/20">
                      Retenu
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <footer className="pt-12 text-center">
          <p className="text-[10px] uppercase tracking-widest leading-loose text-muted-foreground max-w-lg mx-auto">
            Les résultats présentés ont été certifiés par le conseil d&apos;administration de l&apos;Ekklesia. 
            Conformément aux statuts, cette décision est exécutoire immédiatement.
          </p>
        </footer>
      </div>
    </MainLayout>
  );
}
