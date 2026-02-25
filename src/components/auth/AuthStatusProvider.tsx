'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, onSnapshot, setDoc, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore';
import { MemberProfile } from '@/types';

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
  const db = useFirestore();
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [isMemberLoading, setIsMemberLoading] = useState(true);

  const uid = user?.uid;

  useEffect(() => {
    // Reset state immediately on UID change to prevent access leak/flicker
    setMember(null);
    setIsMemberLoading(true);

    if (isUserLoading) return;

    if (!uid) {
      setIsMemberLoading(false);
      return;
    }

    const memberRef = doc(db, 'members', uid);
    
    // 1. Logic for automatic profile creation and login updates
    const syncProfile = async () => {
      try {
        const docSnap = await getDoc(memberRef);
        
        if (docSnap.exists()) {
          // Existing user: Update last login and basic info only
          await updateDoc(memberRef, {
            email: user.email,
            displayName: user.displayName || '',
            lastLoginAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } else {
          // New user: Create profile with default 'pending' status
          await setDoc(memberRef, {
            email: user.email,
            displayName: user.displayName || '',
            status: 'pending',
            role: 'member',
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      } catch (error: any) {
        if (process.env.NODE_ENV !== "production") {
          console.error("[AuthStatus] Sync Error:", error.code, error.message);
        }
      }
    };

    syncProfile();

    // 2. Real-time subscription to member document
    const unsubscribe = onSnapshot(memberRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const profile = {
          id: docSnap.id,
          email: data.email || user.email || '',
          displayName: data.displayName || user.displayName || '',
          status: data.status || 'pending',
          role: data.role || 'member',
          joinedAt: data.createdAt || null,
          lastLoginAt: data.lastLoginAt || null,
          createdAt: data.createdAt || null,
        } as MemberProfile;
        
        setMember(profile);
      } else {
        setMember(null);
      }
      setIsMemberLoading(false);

      if (process.env.NODE_ENV !== "production") {
        console.log("[AuthStatus] Member data resolved:", { uid, status: docSnap.data()?.status });
      }
    }, (error) => {
      if (process.env.NODE_ENV !== "production") {
        console.error("[AuthStatus] Snapshot Error:", error.code, error.message);
      }
      setMember(null);
      setIsMemberLoading(false);
    });

    return () => unsubscribe();
  }, [uid, isUserLoading, db, user?.email, user?.displayName]);

  const isActiveMember = member?.status === 'active';
  const isAdmin = member?.role === 'admin' && isActiveMember;

  return (
    <AuthStatusContext.Provider value={{ 
      member, 
      isMemberLoading, 
      isActiveMember, 
      isAdmin 
    }}>
      {children}
    </AuthStatusContext.Provider>
  );
}

export const useAuthStatus = () => useContext(AuthStatusContext);
