
"use client";

import { MainLayout } from '@/components/layout/MainLayout';
import { TallyResult } from '@/types';
import Image from 'next/image';

export default function ResultsPage() {
  return (
    <MainLayout statusText="Résultats publiés">
      <div className="space-y-24 animate-in fade-in duration-700">
        <h1 className="text-5xl font-bold">Résultats de l'Assemblée</h1>
        <p className="text-xl text-muted-foreground">Les résultats officiels seront affichés ici.</p>
      </div>
    </MainLayout>
  );
}
