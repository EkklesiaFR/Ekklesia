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

  // REDIRECTION EARLY : Dès qu'on a un user, on dégage de /login
  useEffect(() => {
    if (!isUserLoading && user && pathname === '/login') {
      console.log('[AUTH] User detected early -> redirecting to /assembly');
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
          console.log('[AUTH] Redirect result success:', result.user.email, 'UID:', result.user.uid);
          await bootstrapUser(result.user);
        } else {
          console.log('[AUTH] No redirect result found (normal boot or empty result)');
        }
      } catch (error: any) {
        console.error('[AUTH] Redirect result error:', error.code, error.message);
        if (error.code === 'auth/account-exists-with-different-credential') {
          const cred = GoogleAuthProvider.credentialFromError(error);
          if (cred) {
            console.log('[AUTH] Found pending credential for linking');
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

    console.log('[AUTH] Bootstrapping user profile for:', user.uid);
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
        console.log('[AUTH] Updating existing member login time...');
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

    console.log('[AUTH] Auth state changed. User:', user?.uid || 'NONE', 'Path:', pathname);

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
        console.log('[AUTH] Member profile loaded. Status:', data.status, 'Role:', data.role);
        setMember({ ...data, id: docSnap.id });
      } else {
        console.warn('[AUTH] No member profile document found for UID:', user.uid);
        setMember(null);
      }
      setIsMemberLoading(false);
    }, (error) => {
      console.error("[AUTH] Profile listener error:", error.code);
      setTimeout(() => setIsMemberLoading(false), 2000);
    });

    return () => unsubscribe();
  }, [user, isUserLoading, db, pathname]);

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
