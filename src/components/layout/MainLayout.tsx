import { ReactNode } from 'react';
import { Header } from './Header';
import { MobileNav } from './MobileNav';

export function MainLayout({ 
  children, 
  role, 
  statusText 
}: { 
  children: ReactNode; 
  role?: string; 
  statusText?: string 
}) {
  const isVoteOpen = statusText === "Vote ouvert";

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header role={role} statusText={statusText} />
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
