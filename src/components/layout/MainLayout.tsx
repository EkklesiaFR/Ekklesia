'use client';

import { ReactNode, useEffect } from 'react';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collectionGroup, query, where, limit } from 'firebase/firestore';
import { Vote } from '@/types';
import { useAuthStatus } from '@/components/auth/AuthStatusProvider';

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
  const { isActiveMember, isMemberLoading } = useAuthStatus();

  // Détection dynamique d'un vote ouvert dans toute la base.
  // On ne lance la requête que si l'utilisateur est un membre actif pour respecter les règles de sécurité Firestore
  // et éviter les erreurs de permission sur les pages publiques (Login, etc.).
  const openVoteQuery = useMemoFirebase(() => {
    if (isMemberLoading || !isActiveMember) return null;
    return query(collectionGroup(db, 'votes'), where('state', '==', 'open'), limit(1));
  }, [db, isActiveMember, isMemberLoading]);

  const { data: openVotes } = useCollection<Vote>(openVoteQuery);
  const isVoteOpen = !!(openVotes && openVotes.length > 0);

  // Logs de diagnostic (uniquement si l'utilisateur est autorisé)
  useEffect(() => {
    if (isActiveMember && openVotes) {
      console.log(`[DEBUG] MainLayout: Vote ouvert détecté ? ${isVoteOpen}`, openVotes);
    }
  }, [openVotes, isVoteOpen, isActiveMember]);

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
