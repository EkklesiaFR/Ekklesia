
"use client";

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Project, VotingSession } from '@/types';
import Image from 'next/image';
import { ProjectDetailModal } from '@/components/voting/ProjectDetailModal';

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
      summary: 'Une proposition pour revitaliser l’espace public devant l’hôtel de ville.',
      budget: '45 000 €',
      keyFeatures: ['Pavés écologiques', 'Nouveau mobilier'],
      imageUrl: 'https://picsum.photos/seed/urban/1200/600'
    }
  ]
};

export default function ProjectsPage() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  return (
    <MainLayout statusText="Vote ouvert">
      <div className="space-y-16 animate-in fade-in duration-700">
        <header className="space-y-6">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Projets de l'Assemblée</h1>
          <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
            Consultez les propositions soumises au vote.
          </p>
        </header>

        <div className="grid gap-12">
          {MOCK_SESSION.projects?.map((project) => (
            <div 
              key={project.id} 
              onClick={() => setSelectedProject(project)}
              className="group border border-border bg-white p-8 md:p-12 hover:border-[#7DC092]/30 transition-all cursor-pointer space-y-8"
            >
              <h2 className="text-3xl font-bold group-hover:text-[#7DC092] transition-colors">{project.title}</h2>
              <p className="text-lg text-muted-foreground">{project.summary}</p>
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
  );
}
