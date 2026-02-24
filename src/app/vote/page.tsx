
'use client';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { RankedList } from '@/components/voting/RankedList';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const MOCK_PROJECTS = [
  {
    id: 'p1',
    title: 'Rénovation du Parvis Central',
    summary: 'Une proposition pour revitaliser l’espace public devant l’hôtel de ville.',
    budget: '45,000 €',
    keyFeatures: ['Pavés écologiques']
  }
];

export default function VotePage() {
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const [rankedIds, setRankedIds] = useState<string[]>(MOCK_PROJECTS.map(p => p.id));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

  const handleSubmit = () => {
    if (!user) return;
    setIsSubmitting(true);
    
    const ballotId = `session-2024-03_${user.uid}`;
    const ballotRef = doc(db, 'ballots', ballotId);
    
    const ballotData = {
      sessionId: 'session-2024-03',
      userId: user.uid,
      ranking: rankedIds,
      createdAt: serverTimestamp(),
    };

    setDoc(ballotRef, ballotData)
      .then(() => {
        setHasVoted(true);
        setIsSubmitting(false);
        toast({ title: "Vote enregistré", description: "Votre bulletin a été déposé avec succès." });
      })
      .catch(async (error) => {
        setIsSubmitting(false);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: ballotRef.path,
          operation: 'create',
          requestResourceData: ballotData,
        }));
      });
  };

  if (hasVoted) {
    return (
      <MainLayout role="member" statusText="Vote ouvert">
        <div className="flex flex-col items-center justify-center py-24 space-y-8 text-center">
          <CheckCircle className="h-16 w-16 text-primary" />
          <h1 className="text-4xl font-bold">Votre vote a été validé</h1>
          <Link href="/"><Button variant="outline" className="rounded-none px-8">Retour à l'accueil</Button></Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <RequireActiveMember>
      <MainLayout role="member" statusText="Vote ouvert">
        <div className="space-y-12">
          <header className="space-y-6">
            <Link href="/" className="text-sm flex items-center gap-2 hover:text-primary transition-colors">
              <ArrowLeft className="h-3 w-3" />
              Retour
            </Link>
            <h1 className="text-4xl font-bold">Exprimez vos préférences</h1>
            <p className="text-lg text-muted-foreground">Classez les projets par ordre de priorité.</p>
          </header>

          <RankedList projects={MOCK_PROJECTS as any} onOrderChange={setRankedIds} disabled={isSubmitting} />

          <div className="pt-8 border-t border-border flex flex-col items-center gap-6">
            <p className="text-sm text-muted-foreground text-center max-w-sm">Cette action est définitive.</p>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full md:w-auto bg-primary text-white px-12 h-auto py-6">
              {isSubmitting ? 'Traitement...' : 'Confirmer mon bulletin'}
            </Button>
          </div>
        </div>
      </MainLayout>
    </RequireActiveMember>
  );
}
