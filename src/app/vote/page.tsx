
'use client';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function VotePage() {
  return (
    <RequireActiveMember>
      <MainLayout statusText="Vote ouvert">
        <div className="space-y-12">
          <header className="space-y-6">
            <Link href="/" className="text-sm flex items-center gap-2 hover:text-primary">
              <ArrowLeft className="h-3 w-3" />
              Retour
            </Link>
            <h1 className="text-4xl font-bold">Exprimez vos préférences</h1>
            <p className="text-lg text-muted-foreground">Classez les projets par ordre de priorité.</p>
          </header>

          <div className="py-24 text-center border border-dashed border-border bg-secondary/10">
            <p className="text-muted-foreground italic">Module de vote en cours de chargement...</p>
          </div>
        </div>
      </MainLayout>
    </RequireActiveMember>
  );
}
