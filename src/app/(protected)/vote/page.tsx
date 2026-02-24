
"use client";

import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { RankedList } from '@/components/voting/RankedList';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function VotePage() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <MainLayout statusText="Vote ouvert">
      <div className="space-y-12">
        <h1 className="text-4xl font-bold">Exprimez vos préférences</h1>
        <p className="text-lg text-muted-foreground">Classez les projets par ordre de priorité.</p>
        <Button className="rounded-none bg-primary h-14 px-12 uppercase font-bold tracking-widest text-white">
          Confirmer mon bulletin
        </Button>
      </div>
    </MainLayout>
  );
}
