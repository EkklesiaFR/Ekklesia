'use client';

import { useMemo, useState } from 'react';
import { collection, orderBy, query } from 'firebase/firestore';
import { Search, LayoutGrid, FolderOpen } from 'lucide-react';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { Input } from '@/components/ui/input';
import { GlassCard } from '@/components/ui/glass-card';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import type { Project } from '@/types';

import { ProjectCard } from '@/components/projects/ProjectCard';
import { ProjectDetailModal } from '@/components/voting/ProjectDetailModal';

function ProjectsContent() {
  const db = useFirestore();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const projectsQuery = useMemoFirebase(
    () => query(collection(db, 'projects'), orderBy('createdAt', 'desc')),
    [db]
  );

  const { data: projects, isLoading } = useCollection<Project>(projectsQuery);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const filteredProjects = useMemo(() => {
    if (!projects) return [];

    return projects.filter((project) => {
      const title = project.title?.toLowerCase() ?? '';
      const summary = project.summary?.toLowerCase() ?? '';
      return title.includes(normalizedSearch) || summary.includes(normalizedSearch);
    });
  }, [projects, normalizedSearch]);

  const projectCount = filteredProjects.length;

  const editorialText =
    projectCount > 0
      ? `Ce mois-ci, l’Ekklesia soumet ${projectCount} projet${
          projectCount > 1 ? 's' : ''
        } à la décision collective. Prenez le temps de les explorer avant de voter.`
      : `Ce mois-ci, l’Ekklesia soumet ces projets à la décision collective. Prenez le temps de les explorer avant de voter.`;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 md:space-y-10">
      <header className="space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Projets
        </p>

        <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Les projets de l&apos;assemblée
        </h1>

        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
          {editorialText}
        </p>
      </header>

      <GlassCard intensity="soft" className="p-4 md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un projet..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-12 rounded-full border-white/60 bg-white/50 pl-11 pr-4 backdrop-blur-sm transition-all focus-visible:ring-1 focus-visible:ring-primary/30"
            />
          </div>

          <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/60 bg-white/45 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground md:self-auto">
            <LayoutGrid className="h-4 w-4" />
            {projectCount} projet{projectCount > 1 ? 's' : ''}
          </div>
        </div>
      </GlassCard>

      {isLoading ? (
        <GlassCard intensity="soft" className="p-10 md:p-12">
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-black/10 border-t-primary" />
            <p className="text-sm text-muted-foreground">Chargement des projets…</p>
          </div>
        </GlassCard>
      ) : projectCount > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-2">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={(p) => setSelectedProject(p)}
            />
          ))}
        </div>
      ) : (
        <GlassCard intensity="soft" className="p-10 md:p-12">
          <div className="flex flex-col items-center justify-center gap-4 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/60 bg-white/50">
              <FolderOpen className="h-6 w-6 text-muted-foreground" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Aucun projet trouvé</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Aucun projet ne correspond à votre recherche pour le moment.
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      <ProjectDetailModal
        project={selectedProject}
        isOpen={!!selectedProject}
        onClose={() => setSelectedProject(null)}
      />
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <RequireActiveMember>
      <MainLayout statusText="Projets">
        <ProjectsContent />
      </MainLayout>
    </RequireActiveMember>
  );
}