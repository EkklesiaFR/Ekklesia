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
  const hasProcessedRedirect = useRef(false);

  // REDIRECTION EARLY : Déséquilibrée tant que le redirect n'est pas consommé
  useEffect(() => {
    if (!isUserLoading && user && pathname === '/login' && hasProcessedRedirect.current) {
      console.log('[AUTH] user detected -> redirect /assembly');
      router.replace('/assembly');
    }
  }, [user, isUserLoading, pathname, router]);

  // Consommation du résultat Google Redirect - UNIQUE au boot
  useEffect(() => {
    if (hasProcessedRedirect.current) return;
    
    const processRedirect = async () => {
      console.log('[AUTH] Checking for redirect result (Instance:', auth.app.name, ')');
      try {
        const result = await handleGoogleRedirectResult(auth);
        hasProcessedRedirect.current = true;
        
        if (result?.user) {
          console.log('[AUTH] redirect result SUCCESS:', result.user.uid, result.user.email);
          await bootstrapUser(result.user);
        } else {
          console.log('[AUTH] redirect result EMPTY (normal boot)');
        }
      } catch (error: any) {
        console.error('[AUTH] redirect result ERROR:', error.code, error.message);
        if (error.code === 'auth/account-exists-with-different-credential') {
          const cred = GoogleAuthProvider.credentialFromError(error);
          if (cred) {
            console.log('[AUTH] pending link set (conflict found)');
            setPendingCred(cred);
          }
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
        console.log('[AUTH] Bootstrapping new member profile:', user.uid);
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
        console.log('[AUTH] Updating existing member login info:', user.uid);
        await updateDoc(memberRef, {
          lastLoginAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          displayName: user.displayName || snap.data().displayName,
          email: user.email || snap.data().email,
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

    // Lancer le bootstrap
    bootstrapUser(user);

    // Écouter le profil membre
    const memberRef = doc(db, 'members', user.uid);
    const unsubscribe = onSnapshot(memberRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as MemberProfile;
        setMember({ ...data, id: docSnap.id });
      } else {
        setMember(null);
      }
      setIsMemberLoading(false);
    }, (error) => {
      console.error("[AUTH] Profile listener error:", error.code);
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
