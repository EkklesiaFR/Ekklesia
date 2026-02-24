"use client";

import Link from 'next/link';
import { LogOut, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useUser, useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';

export function Header({ 
  role, 
  statusText 
}: { 
  role?: string; 
  statusText?: string 
}) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  
  const isVoteOpen = statusText === "Vote ouvert";

  const handleLogout = () => {
    signOut(auth);
  };

  const getDisplayName = () => {
    if (!user) return "Membre";
    if (user.displayName) return user.displayName;
    return user.email?.split('@')[0] || "Membre";
  };

  return (
    <header className="w-full border-b border-border bg-background py-6">
      <div className="mx-auto max-w-[900px] flex items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-2xl font-bold tracking-tight text-black font-headline">
            Ekklesia
          </Link>
          {statusText && (
            <div className="flex items-center gap-4 border-l pl-8 border-border h-6">
              <span className={cn(
                "text-[13px] font-medium tracking-tight font-body",
                isVoteOpen ? "text-[#7DC092]" : "text-black"
              )}>
                {statusText}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-8">
          {!isUserLoading && user ? (
            <div className="flex items-center gap-8">
              <span className="text-[13px] font-medium text-black font-body">
                Membre : {getDisplayName()}
              </span>
              {role === 'admin' && (
                <Link href="/admin" className="text-[13px] font-medium hover:text-[#7DC092] transition-colors font-body">
                  Administration
                </Link>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogout}
                className="h-auto p-0 text-[13px] font-medium hover:bg-transparent flex items-center gap-2 text-muted-foreground hover:text-black transition-colors font-body"
              >
                <span>Déconnexion</span>
                <LogOut className="h-3 w-3" />
              </Button>
            </div>
          ) : !isUserLoading && (
            <Link href="/login">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-auto p-0 text-[13px] font-medium hover:bg-transparent flex items-center gap-2 hover:text-[#7DC092] transition-colors font-body"
              >
                <span>Connexion</span>
                <LogIn className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
