
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

  const tabsLeft = [
    { label: 'Accueil', href: '/' },
    { label: 'Projets', href: '/projects' },
  ];

  const tabsRight = [
    { label: 'Vote', href: '/vote', disabled: !isVoteOpen },
    { label: 'Compte', href: user ? '/account' : '/login' },
  ];

  const isAssemblyActive = pathname === '/assembly';

  // --- VARIANTES DE STYLE ---
  // Sobre: Fond blanc, bordure noire, discret.
  const styleSobre = "bg-white border-2 border-black text-black shadow-sm";
  // Punchy: Fond vert primaire, texte blanc, ressort fortement.
  const stylePunchy = "bg-[#7DC092] border-none text-white shadow-md shadow-[#7DC092]/20";

  // Switcher ici pour changer de style
  const activeStyle = styleSobre; 

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
      <div className="relative -mt-8 flex flex-col items-center">
        <Link
          href="/assembly"
          className={cn(
            "flex items-center justify-center w-14 h-14 rounded-full transition-all duration-300 active:scale-95",
            isAssemblyActive ? "scale-110 -translate-y-1" : "hover:-translate-y-1",
            activeStyle
          )}
        >
          <Landmark className={cn("h-6 w-6", isAssemblyActive && "animate-pulse")} />
        </Link>
        <span className={cn(
          "mt-1 text-[10px] uppercase tracking-[0.1em] font-black font-body",
          isAssemblyActive ? "text-[#7DC092]" : "text-black"
        )}>
          Assemblée
        </span>
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
