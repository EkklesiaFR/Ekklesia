'use client';

import type React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';
import { Home, Lightbulb, CheckSquare, User } from 'lucide-react';
import { EkklesiaAssemblyLogo } from '@/components/icons/EkklesiaAssemblyLogo';

interface MobileNavProps {
  isVoteOpen: boolean;
}

type Tab = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  disabled?: boolean;
  isActive?: (pathname: string) => boolean;
};

export function MobileNav({ isVoteOpen }: MobileNavProps) {
  const pathname = usePathname();
  const { user } = useUser();

  const tabsLeft: Tab[] = [
    { label: 'Accueil', href: '/', icon: Home, isActive: (p) => p === '/' },
    {
      label: 'Projets',
      href: '/projects',
      icon: Lightbulb,
      isActive: (p) => p === '/projects' || p.startsWith('/projects/'),
    },
  ];

  const tabsRight: Tab[] = [
    {
      label: 'Vote',
      href: '/vote',
      icon: CheckSquare,
      disabled: !isVoteOpen,
      isActive: (p) => p === '/vote' || p.startsWith('/vote/'),
    },
    {
      label: 'Compte',
      href: user ? '/account' : '/login',
      icon: User,
      isActive: (p) => p === '/account' || p.startsWith('/account/') || p === '/login',
    },
  ];

  const isAssemblyActive = pathname === '/assembly' || pathname.startsWith('/assembly/');

  const NavItem = ({ tab }: { tab: Tab }) => {
    const Icon = tab.icon;
    const isActive = tab.isActive ? tab.isActive(pathname) : pathname === tab.href;
    const isDisabled = !!tab.disabled;

    return (
      <Link
        href={isDisabled ? '#' : tab.href}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'relative flex min-w-[64px] flex-col items-center justify-center gap-1 px-2 py-2',
          'transition-all duration-200 active:scale-[0.98]',
          isDisabled && 'pointer-events-none opacity-40'
        )}
      >
        <Icon
          strokeWidth={2.25}
          className={cn(
            'h-6 w-6 transition-colors duration-200',
            isActive ? 'text-[#7DC092]' : 'text-zinc-700'
          )}
        />

        <span
          className={cn(
            'text-[10px] uppercase tracking-[0.12em] font-bold font-body transition-colors duration-200',
            isActive ? 'text-[#7DC092]' : 'text-zinc-700'
          )}
        >
          {tab.label}
        </span>

        {/* Active indicator (premium, subtle) */}
        <span
          className={cn(
            'absolute -bottom-0.5 h-1 w-1 rounded-full transition-opacity duration-200',
            isActive ? 'opacity-100 bg-[#7DC092]' : 'opacity-0'
          )}
        />
      </Link>
    );
  };

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 md:hidden',
        // premium "glass" effect
        'bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70',
        'border-t border-black/10',
        'h-[calc(4.5rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)]'
      )}
      aria-label="Navigation principale"
    >
      <div className="relative flex h-full items-center justify-between px-3">
        {/* Left */}
        <div className="flex flex-1 items-center justify-between px-6">
          {tabsLeft.map((tab) => (
            <NavItem key={tab.label} tab={tab} />
          ))}
        </div>

        {/* Center FAB (logo) */}
        <div className="pointer-events-none absolute left-1/2 top-0 flex -translate-x-1/2 -translate-y-1/3 items-center justify-center">
          <Link
            href="/assembly"
            aria-label="Accéder au dashboard de l’assemblée"
            aria-current={isAssemblyActive ? 'page' : undefined}
            className={cn(
              'pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full',
              'shadow-xl ring-1 ring-black/10 transition-all duration-200 active:scale-95',
              isAssemblyActive ? 'bg-[#7DC092] text-white scale-110' : 'bg-white text-zinc-900 hover:bg-zinc-50'
            )}
          >
            <EkklesiaAssemblyLogo
              title="Assemblée"
              className={cn(
                // bigger + better optical centering
                'h-8 w-8 translate-y-[0.5px]',
                isAssemblyActive ? 'text-white' : 'text-zinc-900'
              )}
            />
          </Link>

          {/* Vote open: subtle ring (no heavy glow) */}
          {isVoteOpen && (
            <span
              aria-hidden="true"
              className={cn('absolute inset-0 rounded-full', 'ring-2 ring-[#7DC092]/30', 'animate-pulse')}
            />
          )}
        </div>

        {/* Right */}
        <div className="flex flex-1 items-center justify-between px-6">
          {tabsRight.map((tab) => (
            <NavItem key={tab.label} tab={tab} />
          ))}
        </div>
      </div>
    </nav>
  );
}