'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';
import { Landmark } from 'lucide-react';

interface MobileNavProps {
  isVoteOpen: boolean;
}

export function MobileNav({ isVoteOpen }: MobileNavProps) {
  const pathname = usePathname();
  const { user } = useUser();

  // Navigation simplifiée : Accueil et Dashboard uniquement pour les membres.
  const tabsLeft = [
    { label: 'Accueil', href: '/' },
  ];

  const tabsRight = [
    { label: 'Vote', href: '/vote', disabled: !isVoteOpen },
    { label: 'Compte', href: user ? '/account' : '/login' },
  ];

  const isAssemblyActive = pathname === '/assembly' || pathname.startsWith('/assembly/');

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border flex items-center justify-between px-4 md:hidden pb-[env(safe-area-inset-bottom)] h-[calc(4rem+env(safe-area-inset-bottom))]">
      {/* Côté Gauche */}
      <div className="flex flex-1 justify-around items-center h-full">
        {tabsLeft.map((tab) => {
          const isActive = pathname === tab.href || (tab.href !== '/' && pathname.startsWith(tab.href));
          return (
            <Link
              key={tab.label}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                "flex flex-col items-center justify-center px-1 py-1 transition-colors",
                "text-[10px] uppercase tracking-[0.1em] font-bold font-body",
                isActive ? "text-[#7DC092]" : "text-black"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Bouton Central : Assemblée (FAB) */}
      <div className="relative -mt-6">
        <Link
          href="/assembly"
          aria-label="Accéder au dashboard de l’assemblée"
          aria-current={isAssemblyActive ? 'page' : undefined}
          className={cn(
            "flex items-center justify-center w-14 h-14 rounded-full transition-all duration-300 shadow-sm active:scale-95",
            isAssemblyActive 
              ? "bg-[#7DC092] text-white scale-110 -translate-y-1 border-none" 
              : "bg-white border-2 border-black text-black"
          )}
        >
          <Landmark className="h-6 w-6" />
        </Link>
      </div>

      {/* Côté Droit */}
      <div className="flex flex-1 justify-around items-center h-full">
        {tabsRight.map((tab) => {
          const isActive = pathname === tab.href || (tab.label === 'Compte' && pathname === '/login');
          const isDisabled = tab.disabled;

          return (
            <Link
              key={tab.label}
              href={isDisabled ? '#' : tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                "flex flex-col items-center justify-center px-1 py-1 transition-colors",
                "text-[10px] uppercase tracking-[0.1em] font-bold font-body",
                isActive ? "text-[#7DC092]" : "text-black",
                isDisabled && "text-muted-foreground/40 cursor-not-allowed pointer-events-none"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
