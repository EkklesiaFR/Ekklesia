'use client';

import Image from 'next/image';
import { ChevronRight, Landmark } from 'lucide-react';

import type { Project } from '@/types';
import { cn } from '@/lib/utils';

interface ProjectCardProps {
  project: Project;
  onClick: (project: Project) => void;
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(project)}
      className={cn(
        'group block w-full overflow-hidden rounded-[28px] border border-white/60 bg-white/40 text-left backdrop-blur-md transition-all duration-300',
        'shadow-[0_10px_30px_rgba(15,23,42,0.06)] hover:-translate-y-1 hover:bg-white/55 hover:shadow-[0_18px_40px_rgba(15,23,42,0.10)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30'
      )}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-secondary/30">
        {project.imageUrl ? (
          <Image
            src={project.imageUrl}
            alt={project.title}
            fill
            className="object-cover grayscale transition-all duration-700 group-hover:scale-[1.03] group-hover:grayscale-0"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Landmark className="h-12 w-12 opacity-20" />
          </div>
        )}

        <div className="absolute left-4 top-4">
          <div className="inline-flex items-center rounded-full border border-white/70 bg-white/85 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground shadow-sm backdrop-blur-md">
            {project.budget}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-white/5 opacity-80" />
      </div>

      <div className="flex items-end justify-between gap-4 p-5 md:p-6">
        <div className="min-w-0 space-y-3">
          <h3 className="text-xl font-semibold leading-tight tracking-tight text-foreground transition-colors group-hover:text-primary">
            {project.title}
          </h3>

          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {project.summary}
          </p>
        </div>

        <div className="shrink-0 self-end rounded-full border border-white/60 bg-white/60 p-3 text-primary transition-all duration-300 group-hover:translate-x-0.5 group-hover:bg-white/80">
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </button>
  );
}