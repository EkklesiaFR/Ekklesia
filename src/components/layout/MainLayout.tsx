'use client';

import { ReactNode } from 'react';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, limit } from 'firebase/firestore';
import { Assembly } from '@/types';
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

  // Détection d'un vote ouvert : on regarde si une assemblée a l'état 'open'
  const openAssemblyQuery = useMemoFirebase(() => {
    if (isMemberLoading || !isActiveMember) return null;
    return query(collection(db, 'assemblies'), where('state', '==', 'open'), limit(1));
  }, [db, isActiveMember, isMemberLoading]);

  const { data: openAssemblies } = useCollection<Assembly>(openAssemblyQuery);
  const isVoteOpen = !!(openAssemblies && openAssemblies.length > 0);

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
