
import { ReactNode } from 'react';
import { Header } from './Header';

export function MainLayout({ 
  children, 
  role, 
  statusText 
}: { 
  children: ReactNode; 
  role?: string; 
  statusText?: string 
}) {
  return (
    <div className="min-h-screen bg-white">
      <Header role={role} statusText={statusText} />
      <main className="mx-auto max-w-[900px] px-6 py-16">
        {children}
      </main>
      <footer className="mx-auto max-w-[900px] px-6 py-12 border-t border-border mt-12 text-xs text-muted-foreground uppercase tracking-widest text-center">
        © 2024 Assemblée Ekklesia — Plateforme de Vote
      </footer>
    </div>
  );
}
