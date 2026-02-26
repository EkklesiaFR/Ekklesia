'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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

  // 1. Handle OAuth Redirect Result & Bootstrap on Mount
  useEffect(() => {
    const processRedirect = async () => {
      try {
        const result = await handleGoogleRedirectResult(auth);
        if (result?.user) {
          console.log('[AUTH] Redirect result success', result.user.uid);
          await bootstrapUser(result.user);
        }
      } catch (error: any) {
        console.error('[AUTH] Redirect result error', error.code, error.message);
      }
    };
    processRedirect();
  }, [auth]);

  // 2. Bootstrap User (Safe fields only)
  const bootstrapUser = async (user: User) => {
    const memberRef = doc(db, 'members', user.uid);
    try {
      const snap = await getDoc(memberRef);
      const safeData = {
        email: user.email,
        displayName: user.displayName,
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (!snap.exists()) {
        console.log('[AUTH] Creating initial member profile (safe fields)');
        await setDoc(memberRef, {
          ...safeData,
          id: user.uid,
          role: 'member', // Default safe role
          status: 'pending', // Default safe status
          createdAt: serverTimestamp(),
        });
      } else {
        console.log('[AUTH] Updating member last login');
        await updateDoc(memberRef, safeData);
      }
    } catch (e) {
      console.error('[AUTH] Bootstrap error:', e);
    }
  };

  // 3. Listen to Member Profile & Auto-redirect
  useEffect(() => {
    if (isUserLoading) return;

    if (!user) {
      console.log('[AUTH] user null -> stay /login or root');
      setMember(null);
      setIsMemberLoading(false);
      return;
    }

    console.log('[AUTH] user detected -> loading member profile');
    
    // Always bootstrap on successful auth if not done by redirect
    bootstrapUser(user);

    const memberRef = doc(db, 'members', user.uid);
    const unsubscribe = onSnapshot(memberRef, (docSnap) => {
      if (docSnap.exists()) {
        setMember({ id: docSnap.id, ...docSnap.data() } as MemberProfile);
      } else {
        setMember(null);
      }
      setIsMemberLoading(false);
      
      // Auto-redirect from login to assembly if user is authenticated
      if (pathname === '/login') {
        console.log('[AUTH] Redirecting to /assembly');
        router.replace('/assembly');
      }
    }, (error) => {
      console.error("AuthStatusProvider listener error:", error);
      setIsMemberLoading(false);
    });

    return () => unsubscribe();
  }, [user, isUserLoading, db, pathname, router]);

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
