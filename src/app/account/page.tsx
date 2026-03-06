'use client';

import Link from 'next/link';
import type React from 'react';
import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { useUser, useAuth } from '@/firebase';
import { useAuthStatus } from '@/components/auth/AuthStatusProvider';
import { User as UserIcon, LogOut, ChevronRight, Vote, CreditCard, Settings } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

function SectionLink({
  href,
  title,
  description,
  icon: Icon,
  disabled,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  disabled?: boolean;
}) {
  const content = (
    <div
      className={cn(
        'flex items-center justify-between gap-4 border border-border px-5 py-4 bg-white transition-colors',
        disabled ? 'opacity-45 cursor-not-allowed' : 'hover:bg-zinc-50'
      )}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="h-10 w-10 border border-border flex items-center justify-center shrink-0 bg-white">
          <Icon className="h-5 w-5 text-zinc-700" strokeWidth={2.25} />
        </div>
        <div className="min-w-0">
          <p className="font-bold truncate">{title}</p>
          <p className="text-sm text-muted-foreground truncate">{description}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {disabled && (
          <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
            Bientôt
          </span>
        )}
        <ChevronRight className="h-4 w-4 text-zinc-400" />
      </div>
    </div>
  );

  if (disabled) return content;

  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}

export default function AccountPage() {
  const { user } = useUser();
  const { member } = useAuthStatus();
  const auth = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  return (
    <RequireActiveMember>
      <MainLayout statusText="Compte">
        <div className="space-y-12">
          <h1 className="text-4xl font-bold">Mon Compte</h1>

          <section className="border border-border p-8 space-y-8 bg-white">
            {/* Profil */}
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-secondary flex items-center justify-center">
                <UserIcon className="h-8 w-8 text-muted-foreground" />
              </div>

              <div className="space-y-1">
                <h2 className="text-2xl font-bold">{user?.displayName || 'Membre'}</h2>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            {/* Infos membre */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-border">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Rôle</p>
                <p className="text-lg font-medium capitalize">{member?.role || 'Membre'}</p>
              </div>

              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Statut</p>
                <p className="text-lg font-medium text-primary capitalize">{member?.status || 'Actif'}</p>
              </div>
            </div>

            {/* Menu */}
            <div className="pt-8 border-t border-border space-y-4">
              <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Espace</p>

              <div className="space-y-3">
                <SectionLink
                  href="/account/votes"
                  title="Mes votes"
                  description="Participation et historique des scrutins."
                  icon={Vote}
                />

                <SectionLink
                  href="/account/billing"
                  title="Mon abonnement"
                  description="Gérer votre formule et vos paiements."
                  icon={CreditCard}
                  disabled
                />

                <SectionLink
                  href="/account/settings"
                  title="Paramètres"
                  description="Notifications, sécurité, mot de passe…"
                  icon={Settings}
                  disabled
                />
              </div>
            </div>

            {/* Session */}
            <div className="pt-8 border-t border-border space-y-4">
              <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Session</p>

              <Button variant="outline" onClick={handleLogout} className="flex items-center gap-2">
                <span>Déconnexion</span>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </section>
        </div>
      </MainLayout>
    </RequireActiveMember>
  );
}