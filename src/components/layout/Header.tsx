
"use client";

import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function Header({ 
  role, 
  statusText 
}: { 
  role?: string; 
  statusText?: string 
}) {
  const isVoteOpen = statusText === "Vote ouvert";

  return (
    <header className="w-full border-b border-border bg-background py-4">
      <div className="mx-auto max-w-[900px] flex items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Ekklesia
          </Link>
          {statusText && (
            <span className={cn(
              "text-sm font-medium pt-0.5 border-l pl-6 border-border",
              isVoteOpen ? "text-primary" : "text-muted-foreground"
            )}>
              {statusText}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-6">
          {role === 'admin' && (
            <Link href="/admin" className="text-sm font-medium hover:underline">
              Administration
            </Link>
          )}
          <Button variant="ghost" size="sm" className="h-auto p-0 text-sm font-medium hover:bg-transparent flex items-center gap-2">
            <span>Déconnexion</span>
            <LogOut className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </header>
  );
}
