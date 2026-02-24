
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';

interface MobileNavProps {
  isVoteOpen: boolean;
}

export function MobileNav({ isVoteOpen }: MobileNavProps) {
  const pathname = usePathname();
  const { user } = useUser();

  const tabs = [
    { label: 'Accueil', href: '/' },
    { label: 'Projets', href: '/projects' },
    { label: 'Vote', href: '/vote', disabled: !isVoteOpen },
    { label: 'Compte', href: user ? '/account' : '/login' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border flex items-center justify-around px-2 md:hidden pb-[env(safe-area-inset-bottom)] h-[calc(4rem+env(safe-area-inset-bottom))]">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || (tab.href !== '/' && pathname.startsWith(tab.href)) || (tab.label === 'Compte' && pathname === '/login');
        const isDisabled = tab.disabled;

        return (
          <Link
            key={tab.label}
            href={isDisabled ? '#' : tab.href}
            className={cn(
              "flex flex-col items-center justify-center h-full px-1 py-1 transition-colors flex-1",
              "text-[11px] uppercase tracking-[0.15em] font-bold font-body",
              isActive ? "text-[#7DC092]" : "text-black",
              isDisabled && "text-muted-foreground/40 cursor-not-allowed pointer-events-none"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
