'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface MemberProfile {
  status: 'active' | 'pending' | 'revoked';
  role: 'admin' | 'member';
  joinedAt?: any;
}

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
    // Reset state immediately on UID change
    setMember(null);
    setIsMemberLoading(true);

    if (isUserLoading) return;

    if (!uid) {
      setIsMemberLoading(false);
      return;
    }

    const memberRef = doc(db, 'members', uid);
    
    // onSnapshot is the only place where we set isMemberLoading to false
    const unsubscribe = onSnapshot(memberRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMember({
          status: data.status || 'pending',
          role: data.role || 'member',
          joinedAt: data.joinedAt || null,
        });
      } else {
        setMember(null);
      }
      setIsMemberLoading(false);
    }, (error) => {
      if (process.env.NODE_ENV !== "production") {
        console.error("[AuthStatus] Error:", error.code, error.message);
      }
      setMember(null);
      setIsMemberLoading(false);
    });

    return () => unsubscribe();
  }, [uid, isUserLoading, db]);

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
