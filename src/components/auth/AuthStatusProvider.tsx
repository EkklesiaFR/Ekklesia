'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, onSnapshot, setDoc, serverTimestamp, getDoc, updateDoc } from 'firebase/firestore';
import { MemberProfile } from '@/types';

export const DEFAULT_ASSEMBLY_ID = process.env.NEXT_PUBLIC_DEFAULT_ASSEMBLY_ID || 'default-assembly';

interface AuthStatusContextType {
  member: MemberProfile | null;
  isMemberLoading: boolean;
  isActiveMember: boolean;
  isAdmin: boolean;
  defaultAssemblyId: string;
}

const AuthStatusContext = createContext<AuthStatusContextType>({
  member: null,
  isMemberLoading: true,
  isActiveMember: false,
  isAdmin: false,
  defaultAssemblyId: DEFAULT_ASSEMBLY_ID,
});

export function AuthStatusProvider({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [isMemberLoading, setIsMemberLoading] = useState(true);

  if (!process.env.NEXT_PUBLIC_DEFAULT_ASSEMBLY_ID && process.env.NODE_ENV === 'development') {
    console.warn("NEXT_PUBLIC_DEFAULT_ASSEMBLY_ID is missing in your environment variables.");
  }

  const uid = user?.uid;

  useEffect(() => {
    setMember(null);
    setIsMemberLoading(true);

    if (isUserLoading) return;
    if (!uid) {
      setIsMemberLoading(false);
      return;
    }

    // Path updated to: assemblies/{assemblyId}/members/{uid}
    const memberRef = doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'members', uid);
    
    const syncProfile = async () => {
      try {
        const docSnap = await getDoc(memberRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          await updateDoc(memberRef, {
            email: user.email || '',
            displayName: user.displayName || '',
            lastLoginAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            status: data.status || 'pending'
          });
        } else {
          // Creating the initial profile as "pending" / "member"
          await setDoc(memberRef, {
            id: uid,
            email: user.email || '',
            displayName: user.displayName || '',
            status: 'pending',
            role: 'member',
            createdAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          console.log(`[AuthStatus] Created new pending profile for ${user.email}`);
        }
      } catch (error: any) {
        // Permissions rules will prevent non-pending or non-member creation
        console.error("[AuthStatus] Sync Error:", error.code, error.message);
      }
    };

    syncProfile();

    const unsubscribe = onSnapshot(memberRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const profile = {
          id: docSnap.id,
          email: data.email || user.email || '',
          displayName: data.displayName || user.displayName || '',
          status: data.status || 'pending',
          role: data.role || 'member',
          createdAt: data.createdAt || null,
          lastLoginAt: data.lastLoginAt || null,
          updatedAt: data.updatedAt || null,
        } as MemberProfile;
        
        setMember(profile);
      } else {
        setMember(null);
      }
      setIsMemberLoading(false);
    }, (error) => {
      console.error("[AuthStatus] Snapshot Error:", error.code, error.message);
      setMember(null);
      setIsMemberLoading(false);
    });

    return () => unsubscribe();
  }, [uid, isUserLoading, db, user?.email, user?.displayName]);

  const isActiveMember = member?.status === 'active';
  const isAdmin = member?.role === 'admin';

  return (
    <AuthStatusContext.Provider value={{ 
      member, 
      isMemberLoading, 
      isActiveMember, 
      isAdmin,
      defaultAssemblyId: DEFAULT_ASSEMBLY_ID
    }}>
      {children}
    </AuthStatusContext.Provider>
  );
}

export const useAuthStatus = () => useContext(AuthStatusContext);
