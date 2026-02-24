
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface MemberProfile {
  status: 'active' | 'pending' | 'revoked' | 'inactive';
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

  useEffect(() => {
    if (isUserLoading) return;

    if (!user) {
      setMember(null);
      setIsMemberLoading(false);
      return;
    }

    setIsMemberLoading(true);
    const memberRef = doc(db, 'members', user.uid);
    
    const unsubscribe = onSnapshot(memberRef, (docSnap) => {
      if (docSnap.exists()) {
        setMember(docSnap.data() as MemberProfile);
      } else {
        setMember(null);
      }
      setIsMemberLoading(false);
    }, (error) => {
      console.error("Error fetching member status:", error);
      setMember(null);
      setIsMemberLoading(false);
    });

    return () => unsubscribe();
  }, [user, isUserLoading, db]);

  const isActiveMember = member?.status === 'active';
  const isAdmin = member?.role === 'admin' && isActiveMember;

  return (
    <AuthStatusContext.Provider value={{ 
      member, 
      isMemberLoading: isUserLoading || isMemberLoading, 
      isActiveMember, 
      isAdmin 
    }}>
      {children}
    </AuthStatusContext.Provider>
  );
}

export const useAuthStatus = () => useContext(AuthStatusContext);
