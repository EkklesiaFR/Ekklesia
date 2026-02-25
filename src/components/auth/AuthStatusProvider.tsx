'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
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
    // Immediate reset on UID change to avoid cross-account leaks
    setMember(null);
    setIsMemberLoading(true);

    if (isUserLoading) return;

    if (!uid) {
      setIsMemberLoading(false);
      return;
    }

    const memberRef = doc(db, 'members', uid);
    
    // Subscribe to member document
    const unsubscribe = onSnapshot(memberRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const profile = {
          id: docSnap.id,
          email: data.email || user.email || '',
          displayName: data.displayName || user.displayName || '',
          status: data.status || 'pending',
          role: data.role || 'member',
          joinedAt: data.joinedAt || null,
          lastLoginAt: data.lastLoginAt || null,
        } as MemberProfile;
        
        setMember(profile);

        // Update last login timestamp and basic info if doc exists
        setDoc(memberRef, {
          email: user.email,
          displayName: user.displayName,
          lastLoginAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });

      } else {
        // Doc doesn't exist yet - maybe new user
        setMember(null);
        
        // Auto-create pending member doc if it doesn't exist to show in admin
        setDoc(memberRef, {
          email: user.email,
          displayName: user.displayName,
          status: 'pending',
          role: 'member',
          joinedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp()
        }, { merge: true });
      }
      setIsMemberLoading(false);

      if (process.env.NODE_ENV !== "production") {
        console.log("[AuthStatus] Update:", { uid, status: docSnap.data()?.status, exists: docSnap.exists() });
      }
    }, (error) => {
      if (process.env.NODE_ENV !== "production") {
        console.error("[AuthStatus] Error:", error.code, error.message);
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
