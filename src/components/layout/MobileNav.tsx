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

  const tabs: Tab[] = [
    { label: 'Accueil', href: '/', icon: Home, isActive: (p) => p === '/' },
    {
      label: 'Projets',
      href: '/projects',
      icon: Lightbulb,
      isActive: (p) => p === '/projects' || p.startsWith('/projects/'),
    },
    {
      label: 'Ekklesia',
      href: '/assembly',
      icon: EkklesiaAssemblyLogo as React.ComponentType<{
        className?: string;
        strokeWidth?: number;
      }>,
      isActive: (p) => p === '/assembly' || p.startsWith('/assembly/'),
    },
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

  const NavItem = ({ tab }: { tab: Tab }) => {
    const Icon = tab.icon;
    const isActive = tab.isActive ? tab.isActive(pathname) : pathname === tab.href;
    const isDisabled = !!tab.disabled;

    return (
      <Link
        href={isDisabled ? '#' : tab.href}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'flex items-center justify-center transition-all duration-200',
          'outline-none focus:outline-none focus-visible:outline-none',
          isDisabled && 'pointer-events-none opacity-35'
        )}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <div
          className={cn(
            'flex min-w-[58px] flex-col items-center justify-center gap-0.5 rounded-full px-3 py-1.5',
            'transition-all duration-250',
            isActive
              ? 'bg-white/16 backdrop-blur-lg shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_12px_rgba(0,0,0,0.06)]'
              : 'bg-transparent'
          )}
        >
          <Icon
            strokeWidth={2.05}
            className={cn(
              'h-[18px] w-[18px] transition-all duration-200',
              isActive ? 'scale-[1.02] text-zinc-900' : 'text-zinc-700/80'
            )}
          />

          <span
            className={cn(
              'text-[8.5px] font-medium uppercase tracking-[0.12em] transition-colors duration-200',
              isActive ? 'text-zinc-900' : 'text-zinc-700/70'
            )}
          >
            {tab.label}
          </span>
        </div>
      </Link>
    );
  };

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 z-50 md:hidden"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}
      aria-label="Navigation principale"
    >
      <div className="mx-auto w-[calc(100%-32px)] max-w-[360px]">
        <div
          className={cn(
            'pointer-events-auto rounded-full border border-white/50',
            'bg-white/38 backdrop-blur-xl supports-[backdrop-filter]:bg-white/32',
            'shadow-[0_8px_20px_rgba(15,23,42,0.08)]'
          )}
        >
          <div className="grid h-[64px] grid-cols-5 items-center px-2">
            {tabs.map((tab) => (
              <NavItem key={tab.label} tab={tab} />
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}