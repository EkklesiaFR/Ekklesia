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
  
  // Guard for double bootstrap per session
  const didBootstrap = useRef(false);

  // 1. Early Redirect Logic
  useEffect(() => {
    if (!isUserLoading && user && pathname === '/login') {
      console.log('[AUTH] user detected -> redirect /assembly');
      router.replace('/assembly');
    } else if (!isUserLoading && !user && pathname === '/login') {
      console.log('[AUTH] user null -> stay /login');
    }
  }, [user, isUserLoading, pathname, router]);

  // 2. Handle OAuth Redirect Result on Mount
  useEffect(() => {
    const processRedirect = async () => {
      try {
        const result = await handleGoogleRedirectResult(auth);
        if (result?.user) {
          console.log('[AUTH] Redirect result success', {
            uid: result.user.uid,
            email: result.user.email,
            providerId: result.providerId
          });
          bootstrapUser(result.user);
        }
      } catch (error: any) {
        console.error('[AUTH] Redirect result error', {
          code: error.code,
          message: error.message
        });

        // Handle the "account already exists" case
        if (error.code === 'auth/account-exists-with-different-credential') {
          const cred = GoogleAuthProvider.credentialFromError(error);
          if (cred) {
            setPendingCred(cred);
            console.log('[AUTH] Pending credential stored for linking');
          }
        }
      }
    };
    processRedirect();
  }, [auth]);

  // 3. Secure Bootstrap Function
  const bootstrapUser = async (user: User) => {
    if (didBootstrap.current) return;
    didBootstrap.current = true;

    const memberRef = doc(db, 'members', user.uid);
    try {
      const snap = await getDoc(memberRef);
      
      const safeData = {
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0],
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (!snap.exists()) {
        console.log('[AUTH] Creating initial member profile with safe defaults');
        await setDoc(memberRef, {
          ...safeData,
          id: user.uid,
          role: 'member',
          status: 'pending',
          createdAt: serverTimestamp(),
        });
      } else {
        console.log('[AUTH] Updating member profile (safe fields only)');
        // NEVER overwrite role/status here to prevent client-side elevation
        await updateDoc(memberRef, safeData);
      }
    } catch (e) {
      console.error('[AUTH] Bootstrap error:', e);
    }
  };

  // 4. Listen to Member Profile & Bootstrap
  useEffect(() => {
    if (isUserLoading) return;

    if (!user) {
      setMember(null);
      setIsMemberLoading(false);
      didBootstrap.current = false; // Reset guard on sign-out
      return;
    }

    // Always attempt bootstrap on user detection
    bootstrapUser(user);

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
      console.error("[AUTH] Member listener error:", error.message);
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
