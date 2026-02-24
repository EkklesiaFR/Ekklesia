
"use client";

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { RankedList } from '@/components/voting/RankedList';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
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
    keyFeatures: ['Pavés écologiques', 'Nouveau mobilier']
  },
  {
    id: 'p2',
    title: 'Réseau de Bornes Électriques',
    summary: 'Installation de 12 points de recharge ultra-rapides.',
    budget: '60,000 €',
    keyFeatures: ['Charge rapide', 'Énergie 100% verte']
  },
  {
    id: 'p3',
    title: 'Espace Culturel Éphémère',
    summary: 'Un pavillon démontable pour accueillir expositions et ateliers.',
    budget: '25,000 €',
    keyFeatures: ['Modularité', 'Matériaux biosourcés']
  }
];

export default function VotePage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const [rankedIds, setRankedIds] = useState<string[]>(MOCK_PROJECTS.map(p => p.id));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);

  // For the demo, we use a fixed session ID matching the mock session on the homepage
  const sessionId = 'session-2024-03';

  useEffect(() => {
    if (!isUserLoading && !user) {
      toast({
        title: "Identification requise",
        description: "Vous devez être connecté pour participer au vote.",
      });
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const handleSubmit = () => {
    if (!user) return;
    setIsSubmitting(true);
    
    // Pattern: {sessionId}_{userId}
    const ballotId = `${sessionId}_${user.uid}`;
    const ballotRef = doc(db, 'ballots', ballotId);
    
    const ballotData = {
      sessionId,
      userId: user.uid,
      ranking: rankedIds,
      createdAt: serverTimestamp(),
    };

    setDoc(ballotRef, ballotData)
      .then(() => {
        setHasVoted(true);
        setIsSubmitting(false);
        toast({
          title: "Vote enregistré",
          description: "Votre bulletin a été déposé avec succès dans l'urne numérique.",
        });
      })
      .catch(async (error) => {
        setIsSubmitting(false);
        const permissionError = new FirestorePermissionError({
          path: ballotRef.path,
          operation: 'create',
          requestResourceData: ballotData,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  if (isUserLoading || !user) {
    return (
      <MainLayout role="member" statusText="Vote ouvert">
        <div className="flex items-center justify-center py-24">
          <p className="text-sm uppercase tracking-widest text-muted-foreground animate-pulse">
            Vérification de l'accès...
          </p>
        </div>
      </MainLayout>
    );
  }

  if (hasVoted) {
    return (
      <MainLayout role="member" statusText="Vote ouvert">
        <div className="flex flex-col items-center justify-center py-24 space-y-8 text-center">
          <CheckCircle className="h-16 w-16 text-primary" />
          <div className="space-y-4">
            <h1 className="text-4xl font-bold">Votre vote a été validé</h1>
            <p className="text-lg text-muted-foreground max-w-md">
              Merci pour votre participation. Les résultats seront proclamés à la fermeture du scrutin après validation du conseil.
            </p>
          </div>
          <Link href="/">
            <Button variant="outline" className="rounded-none px-8">
              Retour à l'accueil
            </Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout role="member" statusText="Vote ouvert">
      <div className="space-y-12">
        <div className="space-y-6">
          <Link href="/" className="text-sm flex items-center gap-2 hover:text-primary transition-colors">
            <ArrowLeft className="h-3 w-3" />
            Retour à la session
          </Link>
          <h1 className="text-4xl font-bold">Exprimez vos préférences</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Classez les projets par ordre de préférence. Le projet en première position est votre favori. Utilisez la poignée à droite de chaque projet pour le déplacer.
          </p>
        </div>

        <section className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Votre classement</h2>
            <span className="text-xs text-muted-foreground italic">Drag & Drop pour réorganiser</span>
          </div>
          
          <RankedList 
            projects={MOCK_PROJECTS} 
            onOrderChange={setRankedIds}
            disabled={isSubmitting}
          />
        </section>

        <section className="pt-8 border-t border-border flex flex-col items-center space-y-6">
          <p className="text-sm text-center text-muted-foreground max-w-sm">
            En confirmant, vous validez votre bulletin. Cette action est définitive et ne peut être modifiée ultérieurement.
          </p>
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full md:w-auto bg-primary hover:bg-primary/90 text-white font-bold rounded-none px-12 py-6 h-auto"
          >
            {isSubmitting ? 'Traitement en cours...' : 'Confirmer mon bulletin'}
          </Button>
        </section>
      </div>
    </MainLayout>
  );
}
