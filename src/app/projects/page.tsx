'use client';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Project } from '@/types';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { ProjectDetailModal } from '@/components/voting/ProjectDetailModal';
import { useState } from 'react';
import { Search, LayoutGrid } from 'lucide-react';
import { Input } from '@/components/ui/input';

function ProjectsContent() {
  const db = useFirestore();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const projectsQuery = useMemoFirebase(() => query(collection(db, 'projects'), orderBy('createdAt', 'desc')), [db]);
  const { data: projects, isLoading } = useCollection<Project>(projectsQuery);

  const filteredProjects = projects?.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.summary.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <header className="space-y-8">
        <div className="space-y-2">
          <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted-foreground block">
            Catalogue
          </span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-black">Les Projets Citoyens</h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-2xl font-medium">
          Découvrez les initiatives portées par les membres de l'assemblée pour transformer notre environnement.
        </p>
      </header>

      <div className="flex flex-col md:flex-row gap-6 items-center justify-between border-b border-border pb-8">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Rechercher un projet..." 
            className="pl-10 rounded-none h-12 border-border focus:border-black transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <LayoutGrid className="h-4 w-4" />
          {filteredProjects?.length || 0} projets trouvés
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <div className="w-12 h-12 border-t-2 border-primary animate-spin rounded-full"></div>
        </div>
      ) : filteredProjects && filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8">
          {filteredProjects.map((project) => (
            <ProjectCard 
              key={project.id} 
              project={project} 
              onClick={(p) => setSelectedProject(p)} 
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-24 border border-dashed border-border bg-secondary/10">
          <p className="text-muted-foreground italic">Aucun projet ne correspond à votre recherche.</p>
        </div>
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
