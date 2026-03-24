'use client';

import Link from 'next/link';
import type React from 'react';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, updateProfile } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import {
  Vote,
  CreditCard,
  Settings,
  Shield,
  Camera,
  LogOut,
  ChevronRight,
} from 'lucide-react';

import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { GlassCard } from '@/components/ui/glass-card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import { useUser, useAuth, firebaseApp, firestore } from '@/firebase';
import { useAuthStatus } from '@/components/auth/AuthStatusProvider';
import { cn } from '@/lib/utils';

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
        'flex items-center justify-between gap-4 rounded-2xl border border-white/60 bg-white/40 p-4 backdrop-blur-md transition-all',
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/55'
      )}
    >
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/70 bg-white/50">
          <Icon className="h-5 w-5 text-zinc-700" strokeWidth={2.1} />
        </div>

        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-foreground">{title}</p>
          <p className="truncate text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {disabled && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
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

function getInitials(displayName?: string | null) {
  if (!displayName) return '?';

  const initials = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((name) => name[0])
    .join('')
    .toUpperCase();

  return initials.length > 2 ? initials.slice(0, 2) : initials;
}

export default function AccountPage() {
  const { user } = useUser();
  const { member } = useAuthStatus();
  const auth = useAuth();
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const storage = getStorage(firebaseApp);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const handlePhotoChangeClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);

    try {
      const storageRef = ref(storage, `profile_pictures/${user.uid}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      await updateProfile(user, { photoURL: downloadURL });

      const memberDocRef = doc(firestore, `members/${user.uid}`);
      await updateDoc(memberDocRef, {
        photoURL: downloadURL,
      });
    } catch (error) {
      console.error('Error uploading profile photo:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const currentPhotoURL = member?.photoURL || user?.photoURL || undefined;
  const isAdmin = member?.role === 'admin';

  return (
    <RequireActiveMember>
      <MainLayout statusText="Compte">
        <div className="space-y-6">
          <GlassCard intensity="medium" className="w-full p-5 md:p-6">
            <div className="flex flex-col gap-6">
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16">
                  <Avatar className="h-16 w-16 border-2 border-white shadow-[0_6px_14px_rgba(15,23,42,0.10)]">
                    <AvatarImage src={currentPhotoURL} alt={user?.displayName || 'User'} />
                    <AvatarFallback className="bg-muted text-lg font-semibold text-foreground">
                      {getInitials(user?.displayName)}
                    </AvatarFallback>
                  </Avatar>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*"
                  />

                  <button
                    className={cn(
                      'absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-white/70 bg-zinc-900 text-white shadow-md transition-colors',
                      isUploading ? 'cursor-not-allowed opacity-60' : 'hover:bg-black'
                    )}
                    title="Changer la photo de profil"
                    onClick={handlePhotoChangeClick}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <div className="min-w-0 space-y-1">
                  <h1 className="truncate text-3xl font-bold tracking-tight text-foreground">
                    {user?.displayName || 'Membre'}
                  </h1>
                  <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/60 bg-white/40 p-4 backdrop-blur-md">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Rôle
                  </p>
                  <p className="mt-2 text-lg font-semibold capitalize text-foreground">
                    {member?.role || 'Membre'}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/60 bg-white/40 p-4 backdrop-blur-md">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Statut
                  </p>
                  <p className="mt-2 text-lg font-semibold capitalize text-primary">
                    {member?.status || 'Actif'}
                  </p>
                </div>
              </div>
            </div>
          </GlassCard>

          <GlassCard intensity="medium" className="w-full p-5 md:p-6">
            <div className="space-y-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Espace
              </p>

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

                {isAdmin && (
                  <SectionLink
                    href="/admin"
                    title="Administration"
                    description="Gérer les membres, les scrutins et les contenus."
                    icon={Shield}
                  />
                )}
              </div>
            </div>
          </GlassCard>

          <GlassCard intensity="soft" className="w-full p-5 md:p-6">
            <div className="space-y-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Session
              </p>

              <Button
                variant="outline"
                onClick={handleLogout}
                className="h-11 rounded-full px-5 text-xs font-semibold uppercase tracking-[0.18em]"
              >
                <span>Déconnexion</span>
                <LogOut className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </GlassCard>
        </div>
      </MainLayout>
    </RequireActiveMember>
  );
}