'use client';

import { Project } from '@/types';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Landmark } from 'lucide-react';
import Image from 'next/image';

interface ProjectCardProps {
  project: Project;
  onClick: (project: Project) => void;
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  return (
    <Card 
      className="group rounded-none border-border overflow-hidden hover:border-black transition-all cursor-pointer bg-white"
      onClick={() => onClick(project)}
    >
      <div className="relative aspect-video w-full bg-secondary overflow-hidden">
        {project.imageUrl ? (
          <Image
            src={project.imageUrl}
            alt={project.title}
            fill
            className="object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Landmark className="h-12 w-12 opacity-20" />
          </div>
        )}
        <div className="absolute top-4 left-4">
          <Badge variant="secondary" className="bg-white/90 backdrop-blur-sm text-[10px] font-bold uppercase tracking-widest rounded-none border-none">
            {project.budget}
          </Badge>
        </div>
      </div>
      
      <CardContent className="p-6 space-y-3">
        <h3 className="text-xl font-bold leading-tight group-hover:text-primary transition-colors">
          {project.title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {project.summary}
        </p>
      </CardContent>

      <CardFooter className="px-6 pb-6 pt-0 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {project.ownerName || "Projet Citoyen"}
        </span>
        <ChevronRight className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
      </CardFooter>
    </Card>
  );
}
