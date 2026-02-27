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

  // Redirection immédiate pour éviter les flashs d'UI de login
  useEffect(() => {
    if (!isUserLoading && user && pathname === '/login') {
      router.replace('/assembly');
    }
  }, [user, isUserLoading, pathname, router]);

  // Consommation du résultat Google Redirect
  useEffect(() => {
    const processRedirect = async () => {
      try {
        const result = await handleGoogleRedirectResult(auth);
        if (result?.user) {
          console.log('[AUTH] Redirect success:', result.user.email);
          bootstrapUser(result.user);
        }
      } catch (error: any) {
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
        console.log('[AUTH] Initializing new member profile...');
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
        // Mise à jour uniquement des infos de connexion, sans toucher au rôle/status
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
      setMember(null);
      setIsMemberLoading(false);
      didBootstrap.current = false;
      return;
    }

    bootstrapUser(user);

    const memberRef = doc(db, 'members', user.uid);
    const unsubscribe = onSnapshot(memberRef, (docSnap) => {
      if (docSnap.exists()) {
        setMember({ ...(docSnap.data() as MemberProfile), id: docSnap.id });
      } else {
        setMember(null);
      }
      setIsMemberLoading(false);
    }, (error) => {
      console.error("[AUTH] Profile listener access denied (normal if rules propagated)");
      setIsMemberLoading(false);
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