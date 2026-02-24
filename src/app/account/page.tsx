
'use client';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { useUser } from '@/firebase';
import { useAuthStatus } from '@/components/auth/AuthStatusProvider';
import { User as UserIcon } from 'lucide-react';

export default function AccountPage() {
  const { user } = useUser();
  const { member } = useAuthStatus();

  return (
    <RequireActiveMember>
      <MainLayout statusText="Compte">
        <div className="space-y-12">
          <h1 className="text-4xl font-bold">Mon Compte</h1>
          
          <section className="border border-border p-8 space-y-8 bg-white">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-secondary flex items-center justify-center">
                <UserIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-bold">{user?.displayName || "Membre"}</h2>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>

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
          </section>
        </div>
      </MainLayout>
    </RequireActiveMember>
  );
}
