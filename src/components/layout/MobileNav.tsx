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
          'transition-transform duration-200 active:scale-[0.98]',
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

        <span
          className={cn(
            'absolute bottom-0 h-[2px] w-7 rounded-full transition-all duration-300',
            isActive ? 'bg-[#7DC092] opacity-100' : 'opacity-0'
          )}
        />
      </Link>
    );
  };

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 md:hidden',
        'bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70',
        'border-t border-black/10',
        'h-[calc(4.5rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)]'
      )}
      aria-label="Navigation principale"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-black/5" />

      <div className="relative flex h-full items-center">

        {/* LEFT TABS */}
        <div className="flex flex-1 items-center justify-around pl-4">
          {tabsLeft.map((tab) => (
            <NavItem key={tab.label} tab={tab} />
          ))}
        </div>

        {/* CENTER SPACER (important) */}
        <div className="w-[72px]" />

        {/* RIGHT TABS */}
        <div className="flex flex-1 items-center justify-around pr-4">
          {tabsRight.map((tab) => (
            <NavItem key={tab.label} tab={tab} />
          ))}
        </div>

        {/* CENTER FAB */}
        <div className="pointer-events-none absolute left-1/2 top-0 flex -translate-x-1/2 -translate-y-1/3 items-center justify-center">
          <Link
            href="/assembly"
            aria-label="Accéder au dashboard de l’assemblée"
            aria-current={isAssemblyActive ? 'page' : undefined}
            className={cn(
              'pointer-events-auto relative flex h-14 w-14 items-center justify-center rounded-full',
              'shadow-[0_10px_25px_rgba(0,0,0,0.12)] ring-1 ring-black/10',
              'transition-all duration-200 active:scale-95 hover:scale-[1.03]'
            )}
          >
            <div
              className={cn(
                'absolute inset-0 rounded-full',
                isAssemblyActive
                  ? 'bg-[#7DC092] shadow-[0_8px_20px_rgba(125,192,146,0.35)]'
                  : 'bg-white'
              )}
            />

            <EkklesiaAssemblyLogo
              title="Assemblée"
              className={cn(
                'relative h-8 w-8 translate-y-[0.5px]',
                isAssemblyActive ? 'text-white' : 'text-zinc-900'
              )}
            />
          </Link>

          {isVoteOpen && (
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full ring-2 ring-[#7DC092]/30 animate-pulse"
            />
          )}
        </div>
      </div>
    </nav>
  );
}