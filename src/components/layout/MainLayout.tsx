'use client';

import { ReactNode } from 'react';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Assembly } from '@/types';
import { useAuthStatus, DEFAULT_ASSEMBLY_ID } from '@/components/auth/AuthStatusProvider';

/**
 * MainLayout gère dynamiquement l'état "Vote Ouvert" basé sur l'assemblée unique.
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

  // Détection d'un vote ouvert sur l'assemblée par défaut
  const assemblyRef = useMemoFirebase(() => {
    if (isMemberLoading || !isActiveMember) return null;
    return doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID);
  }, [db, isActiveMember, isMemberLoading]);

  const { data: assembly } = useDoc<Assembly>(assemblyRef);
  const isVoteOpen = !!(assembly && assembly.state === 'open' && assembly.activeVoteId);

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