'use client';

import Link from 'next/link';
import type React from 'react';
import { RequireActiveMember } from '@/components/auth/RequireActiveMember';
import { MainLayout } from '@/components/layout/MainLayout';
import { useUser, useAuth, firebaseApp, firestore } from '@/firebase';
import { useAuthStatus } from '@/components/auth/AuthStatusProvider';
import { User as UserIcon, LogOut, ChevronRight, Vote, CreditCard, Settings, Camera } from 'lucide-react';
import { signOut, updateProfile } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useRef, useState } from 'react';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const storage = getStorage(firebaseApp);

  const getInitials = (displayName?: string | null) => {
    if (!displayName) return '';
    const initials = displayName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
    return initials.length > 2 ? initials.substring(0, 2) : initials; // Ensure max 2 initials
  };

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

      // Update Firebase Auth profile
      await updateProfile(user, { photoURL: downloadURL });

      // Update member document in Firestore
      const memberDocRef = doc(firestore, `members/${user.uid}`);
      await updateDoc(memberDocRef, {
        photoURL: downloadURL,
      });

    } catch (error) {
      console.error("Error uploading profile photo:", error);
      // TODO: Show a user-friendly error message
    } finally {
      setIsUploading(false);
    }
  };

  const currentPhotoURL = member?.photoURL || user?.photoURL || undefined;

  return (
    <RequireActiveMember>
      <MainLayout statusText="Compte">
        <div className="space-y-12">
          <h1 className="text-4xl font-bold">Mon Compte</h1>

          <section className="border border-border p-8 space-y-8 bg-white">
            {/* Profil */}
            <div className="flex items-center gap-6">
              <div className="relative w-16 h-16">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={currentPhotoURL} alt={user?.displayName || 'User'} />
                  <AvatarFallback className="bg-secondary text-muted-foreground text-xl font-semibold">
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
                    "absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-700 text-white shadow-md transition-colors",
                    isUploading ? "opacity-50 cursor-not-allowed" : "hover:bg-zinc-800"
                  )}
                  title="Changer la photo de profil"
                  onClick={handlePhotoChangeClick}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent border-white" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </button>
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