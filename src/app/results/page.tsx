
'use client';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';

export default function ResultsPage() {
  return (
    <RequireActiveMember>
      <MainLayout statusText="Résultats publiés">
        <div className="space-y-24">
          <header className="space-y-8">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">Décision de l'assemblée</h1>
            <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
              Consultez les résultats officiels des sessions passées.
            </p>
          </header>

          <div className="py-24 text-center border border-dashed border-border bg-secondary/10">
            <p className="text-muted-foreground italic">Archives des résultats en cours de chargement...</p>
          </div>
        </div>
      </MainLayout>
    </RequireActiveMember>
  );
}
