'use client';

import { useState } from 'react';
import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Project } from '@/types';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { ProjectDetailModal } from '@/components/voting/ProjectDetailModal';
import { SubmitProjectModal } from '@/components/projects/SubmitProjectModal';
import { Button } from '@/components/ui/button';
import { PlusCircle, Search, LayoutGrid } from 'lucide-react';
import { Input } from '@/components/ui/input';

function ProjectsContent() {
  const db = useFirestore();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const projectsQuery = useMemoFirebase(() => query(
    collection(db, 'projects'), 
    orderBy('createdAt', 'desc')
  ), [db]);

  const { data: projects, isLoading } = useCollection<Project>(projectsQuery);

  const filteredProjects = projects?.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.summary.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-16 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Projets de l'Assemblée</h1>
          <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
            Consultez et déposez des propositions pour façonner l'avenir de notre communauté.
          </p>
        </div>
        <Button 
          onClick={() => setIsSubmitModalOpen(true)}
          className="rounded-none h-14 px-10 font-bold uppercase tracking-widest text-xs gap-3 shadow-lg hover:shadow-xl transition-all"
        >
          <PlusCircle className="h-5 w-5" />
          Déposer un projet
        </Button>
      </header>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input 
          placeholder="Rechercher un projet..." 
          className="pl-12 h-16 rounded-none border-border focus:border-black text-lg"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <div className="w-12 h-12 border-t-2 border-primary animate-spin rounded-full"></div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Chargement des projets...</p>
        </div>
      ) : (!filteredProjects || filteredProjects.length === 0) ? (
        <div className="py-24 text-center border border-dashed border-border bg-secondary/5">
          <LayoutGrid className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
          <p className="text-muted-foreground italic">Aucun projet trouvé.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProjects.map((project) => (
            <ProjectCard 
              key={project.id} 
              project={project} 
              onClick={(p) => setSelectedProject(p)} 
            />
          ))}
        </div>
      )}

      <ProjectDetailModal 
        project={selectedProject} 
        isOpen={!!selectedProject} 
        onClose={() => setSelectedProject(null)} 
      />

      <SubmitProjectModal 
        isOpen={isSubmitModalOpen} 
        onOpenChange={setIsSubmitModalOpen} 
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
