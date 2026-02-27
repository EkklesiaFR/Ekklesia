'use client';

import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { useUser, useFirestore, useAuth } from '@/firebase';
import { doc, onSnapshot, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { MemberProfile } from '@/types';
import { handleGoogleRedirectResult, GoogleAuthProvider } from '@/firebase/non-blocking-login';
import { useRouter, usePathname } from 'next/navigation';
import { User, AuthCredential } from 'firebase/auth';

interface AuthStatusContextType {
  member: MemberProfile | null;
  isMemberLoading: boolean;
  isActiveMember: boolean;
  isAdmin: boolean;
  pendingCred: AuthCredential | null;
  setPendingCred: (cred: AuthCredential | null) => void;
}

const AuthStatusContext = createContext<AuthStatusContextType>({
  member: null,
  isMemberLoading: true,
  isActiveMember: false,
  isAdmin: false,
  pendingCred: null,
  setPendingCred: () => {},
});

export function AuthStatusProvider({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [isMemberLoading, setIsMemberLoading] = useState(true);
  const [pendingCred, setPendingCred] = useState<AuthCredential | null>(null);
  
  const didBootstrap = useRef(false);

  // REDIRECTION EARLY : Si on est sur /login et qu'on a un user, on dégage vers /assembly
  // On n'attend pas Firestore pour cette redirection de base.
  useEffect(() => {
    if (!isUserLoading && user && pathname === '/login') {
      console.log('[AUTH] User detected early -> redirecting to /assembly');
      router.replace('/assembly');
    }
  }, [user, isUserLoading, pathname, router]);

  // Consommation du résultat Google Redirect
  useEffect(() => {
    const processRedirect = async () => {
      try {
        const result = await handleGoogleRedirectResult(auth);
        if (result?.user) {
          console.log('[AUTH] Redirect result success:', result.user.email);
          await bootstrapUser(result.user);
        }
      } catch (error: any) {
        console.error('[AUTH] Redirect result error:', error.code);
        if (error.code === 'auth/account-exists-with-different-credential') {
          const cred = GoogleAuthProvider.credentialFromError(error);
          if (cred) setPendingCred(cred);
        }
      }
    };
    processRedirect();
  }, [auth]);

  const bootstrapUser = async (user: User) => {
    if (didBootstrap.current) return;
    didBootstrap.current = true;

    const memberRef = doc(db, 'members', user.uid);
    try {
      const snap = await getDoc(memberRef);
      
      if (!snap.exists()) {
        console.log('[AUTH] Creating initial member profile...');
        await setDoc(memberRef, {
          id: user.uid,
          email: user.email,
          displayName: user.displayName || user.email?.split('@')[0],
          role: 'member',
          status: 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
        });
      } else {
        console.log('[AUTH] Updating existing member timestamps...');
        await updateDoc(memberRef, {
          lastLoginAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (e) {
      console.error('[AUTH] Bootstrap error:', e);
    }
  };

  useEffect(() => {
    if (isUserLoading) return;

    if (!user) {
      console.log('[AUTH] No user found -> clearing session');
      setMember(null);
      setIsMemberLoading(false);
      didBootstrap.current = false;
      return;
    }

    // Lancer le bootstrap
    bootstrapUser(user);

    // Écouter le profil membre
    console.log('[AUTH] Starting member profile listener for:', user.uid);
    const memberRef = doc(db, 'members', user.uid);
    const unsubscribe = onSnapshot(memberRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as MemberProfile;
        console.log('[AUTH] Member profile loaded:', data.status);
        setMember({ ...data, id: docSnap.id });
      } else {
        console.log('[AUTH] Member document does not exist yet');
        setMember(null);
      }
      setIsMemberLoading(false);
    }, (error) => {
      console.error("[AUTH] Profile listener access denied (normal during bootstrap or rules propagation)");
      // On ne met pas loading à false immédiatement pour laisser le temps au bootstrap de finir
      // Sauf si on est vraiment bloqué
      setTimeout(() => setIsMemberLoading(false), 2000);
    });

    return () => unsubscribe();
  }, [user, isUserLoading, db]);

  return (
    <AuthStatusContext.Provider value={{ 
      member, 
      isMemberLoading, 
      isActiveMember: member?.status === 'active', 
      isAdmin: member?.role === 'admin',
      pendingCred,
      setPendingCred
    }}>
      {children}
    </AuthStatusContext.Provider>
  );
}

export const useAuthStatus = () => useContext(AuthStatusContext);