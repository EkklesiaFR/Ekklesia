'use client';

import { ReactNode, useEffect } from 'react';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collectionGroup, query, where, limit } from 'firebase/firestore';
import { Vote } from '@/types';

/**
 * MainLayout gère désormais dynamiquement l'état "Vote Ouvert" pour toute l'application.
 */
export function MainLayout({ 
  children, 
  role, 
  statusText 
}: { 
  children: ReactNode; 
  role?: string; 
  statusText?: string 
}) {
  const db = useFirestore();

  // Détection dynamique d'un vote ouvert dans toute la base
  const openVoteQuery = useMemoFirebase(() => {
    return query(collectionGroup(db, 'votes'), where('state', '==', 'open'), limit(1));
  }, [db]);

  const { data: openVotes, error } = useCollection<Vote>(openVoteQuery);
  const isVoteOpen = !!(openVotes && openVotes.length > 0);

  // Logs de diagnostic (Dev only)
  useEffect(() => {
    if (openVotes) {
      console.log(`[DEBUG] MainLayout: Vote ouvert détecté ? ${isVoteOpen}`, openVotes);
    }
    if (error) {
      console.error('[DEBUG] MainLayout: Erreur lors de la détection du vote:', error);
    }
  }, [openVotes, isVoteOpen, error]);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header role={role} statusText={statusText} isVoteOpen={isVoteOpen} />
      <main className="flex-grow mx-auto max-w-[900px] w-full px-6 py-16 mb-16 md:mb-0">
        {children}
      </main>
      <footer className="mx-auto max-w-[900px] w-full px-6 py-12 border-t border-border mt-12 text-xs text-muted-foreground uppercase tracking-widest text-center mb-24 md:mb-0">
        © 2024 Assemblée Ekklesia — Plateforme de Vote
      </footer>
      <MobileNav isVoteOpen={isVoteOpen} />
    </div>
  );
}
