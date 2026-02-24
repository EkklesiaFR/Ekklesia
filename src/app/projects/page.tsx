
'use client';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { Project, VotingSession } from '@/types';
import { ProjectDetailModal } from '@/components/voting/ProjectDetailModal';
import { useState } from 'react';
import Image from 'next/image';

const MOCK_SESSION: VotingSession = {
  id: 'session-2024-03',
  title: 'Session de Printemps 2024',
  announcementAt: new Date(Date.now() - 86400000),
  votingOpensAt: new Date(Date.now() - 3600000),
  votingClosesAt: new Date(Date.now() + 172800000),
  isResultsPublished: false,
  status: 'open',
  projects: [
    {
      id: 'p1',
      title: 'Rénovation du Parvis Central',
      summary: 'Une proposition pour revitaliser l’espace public devant l’hôtel de ville avec des pavés drainants et du mobilier urbain durable.',
      longDescription: `Ce projet ambitieux vise à transformer le cœur battant de notre commune.`,
      budget: '45 000 €',
      keyFeatures: ['Pavés écologiques', 'Nouveau mobilier'],
      imageUrl: 'https://picsum.photos/seed/urban/1200/600',
      ownerName: 'Comité du Centre-Ville',
    }
  ]
};

export default function ProjectsPage() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  return (
    <RequireActiveMember>
      <MainLayout statusText="Vote ouvert">
        <div className="space-y-16 animate-in fade-in duration-700">
          <header className="space-y-6">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Projets de l'Assemblée</h1>
            <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
              Consultez les propositions soumises au vote pour la session de Printemps 2024.
            </p>
          </header>

          <div className="grid gap-12">
            {MOCK_SESSION.projects?.map((project) => (
              <div 
                key={project.id} 
                onClick={() => setSelectedProject(project)}
                className="group border border-border bg-white p-8 md:p-12 hover:border-[#7DC092]/30 transition-all cursor-pointer space-y-8"
              >
                <div className="flex flex-col md:flex-row gap-8 items-start">
                  <div className="relative aspect-video w-full md:w-80 overflow-hidden border border-border flex-shrink-0">
                    <Image 
                      src={project.imageUrl || 'https://picsum.photos/seed/ekklesia/800/400'} 
                      alt={project.title}
                      fill
                      className="object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                    />
                  </div>
                  <div className="space-y-6 flex-grow">
                    <h2 className="text-3xl font-bold tracking-tight group-hover:text-[#7DC092] transition-colors">
                      {project.title}
                    </h2>
                    <p className="text-lg text-muted-foreground leading-relaxed line-clamp-3">
                      {project.summary}
                    </p>
                    <div className="pt-4 border-t border-border">
                      <span className="inline-block px-2 py-1 bg-secondary text-[10px] uppercase tracking-widest font-black border border-border">
                        {project.budget}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <ProjectDetailModal 
          project={selectedProject}
          isOpen={!!selectedProject}
          onClose={() => setSelectedProject(null)}
        />
      </MainLayout>
    </RequireActiveMember>
  );
}
