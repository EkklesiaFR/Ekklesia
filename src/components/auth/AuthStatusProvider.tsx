'use client';

import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { useUser, useFirestore, useAuth } from '@/firebase';
import { doc, onSnapshot, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { MemberProfile } from '@/types';
import { handleGoogleRedirectResult } from '@/firebase/non-blocking-login';
import { useRouter, usePathname } from 'next/navigation';
import { User } from 'firebase/auth';

interface AuthStatusContextType {
  member: MemberProfile | null;
  isMemberLoading: boolean;
  isActiveMember: boolean;
  isAdmin: boolean;
}

const AuthStatusContext = createContext<AuthStatusContextType>({
  member: null,
  isMemberLoading: true,
  isActiveMember: false,
  isAdmin: false,
});

export function AuthStatusProvider({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [isMemberLoading, setIsMemberLoading] = useState(true);
  
  // Guard for double bootstrap
  const didBootstrap = useRef(false);

  // 1. Early Redirect Logic (as soon as user is detected)
  useEffect(() => {
    if (!isUserLoading && user && pathname === '/login') {
      console.log('[AUTH] Early redirect /login -> /assembly');
      router.replace('/assembly');
    }
  }, [user, isUserLoading, pathname, router]);

  // 2. Handle OAuth Redirect Result on Mount
  useEffect(() => {
    const processRedirect = async () => {
      try {
        const result = await handleGoogleRedirectResult(auth);
        if (result?.user) {
          console.log('[AUTH] Redirect result success', result.user.uid);
          // If we handled a redirect, we definitely want to bootstrap
          bootstrapUser(result.user);
        }
      } catch (error: any) {
        console.error('[AUTH] Redirect result error', error.code, error.message);
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
          role: 'member',    // Forced safe default
          status: 'pending',   // Forced safe default
          createdAt: serverTimestamp(),
        });
      } else {
        console.log('[AUTH] Updating member last login (safe fields only)');
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
      didBootstrap.current = false; // Reset if user signs out
      return;
    }

    // Attempt bootstrap if not already done
    bootstrapUser(user);

    const memberRef = doc(db, 'members', user.uid);
    const unsubscribe = onSnapshot(memberRef, (docSnap) => {
      if (docSnap.exists()) {
        setMember({ id: docSnap.id, ...docSnap.data() } as MemberProfile);
      } else {
        setMember(null);
      }
      setIsMemberLoading(false);
    }, (error) => {
      console.error("AuthStatusProvider member listener error:", error);
      setIsMemberLoading(false);
    });

    return () => unsubscribe();
  }, [user, isUserLoading, db]);

  return (
    <AuthStatusContext.Provider value={{ 
      member, 
      isMemberLoading, 
      isActiveMember: member?.status === 'active', 
      isAdmin: member?.role === 'admin' 
    }}>
      {children}
    </AuthStatusContext.Provider>
  );
}

export const useAuthStatus = () => useContext(AuthStatusContext);
