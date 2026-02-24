
'use client';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';

export default function ProjectsPage() {
  return (
    <RequireActiveMember>
      <MainLayout statusText="Vote ouvert">
        <div className="space-y-16">
          <header className="space-y-6">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Projets de l'Assemblée</h1>
            <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
              Consultez les propositions soumises au vote.
            </p>
          </header>

          <div className="py-24 text-center border border-dashed border-border bg-secondary/10">
            <p className="text-muted-foreground italic">Liste des projets en cours de chargement...</p>
          </div>
        </div>
      </MainLayout>
    </RequireActiveMember>
  );
}
