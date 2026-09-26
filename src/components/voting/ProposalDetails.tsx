'use client';

import { useState } from 'react';
import type { Project } from '@/types';
import { ProjectDetailModal } from './ProjectDetailModal';
import { Button } from '@/components/ui/button';

export function ProposalDetails({ projects }: { projects: Project[] }) {
  const [selected, setSelected] = useState<Project | null>(null);
  // Resolve again against the vote's source on each render (no stale catalogue modal).
  const project = projects.find(p => p.id === selected?.id) ?? null;
  return <section aria-label="Propositions du scrutin" className="space-y-3">
    <h2 className="font-semibold">Propositions du scrutin</h2>
    {projects.map(p => <div key={p.id} className="rounded-xl border p-4">
      <h3 className="font-semibold">{p.title}</h3>
      <p className="text-sm whitespace-pre-wrap">{p.summary}</p>
      <Button variant="outline" onClick={() => setSelected(p)}>Consulter {p.title}</Button>
    </div>)}
    <ProjectDetailModal project={project} isOpen={!!project} onClose={() => setSelected(null)} />
  </section>;
}
