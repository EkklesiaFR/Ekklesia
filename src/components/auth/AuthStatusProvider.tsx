'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useUser, useFirestore } from '@/firebase';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { MemberProfile } from '@/types';

export const DEFAULT_ASSEMBLY_ID = process.env.NEXT_PUBLIC_DEFAULT_ASSEMBLY_ID || 'default-assembly';

interface AuthStatusContextType {
  member: MemberProfile | null;
  isMemberLoading: boolean;
  isActiveMember: boolean;
  isAdmin: boolean;
  hasLegacyProfile: boolean;
  defaultAssemblyId: string;
}

const AuthStatusContext = createContext<AuthStatusContextType>({
  member: null,
  isMemberLoading: true,
  isActiveMember: false,
  isAdmin: false,
  hasLegacyProfile: false,
  defaultAssemblyId: DEFAULT_ASSEMBLY_ID,
});

export function AuthStatusProvider({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [isMemberLoading, setIsMemberLoading] = useState(true);
  const [hasLegacyProfile, setHasLegacyProfile] = useState(false);

  const uid = user?.uid;

  useEffect(() => {
    setMember(null);
    setHasLegacyProfile(false);
    setIsMemberLoading(true);

    if (isUserLoading) return;
    if (!uid) {
      setIsMemberLoading(false);
      return;
    }

    const memberRef = doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'members', uid);
    const legacyMemberRef = doc(db, 'members', uid);
    
    // Vérification passive uniquement pour éviter les créations automatiques destructives
    const checkStatus = async () => {
      try {
        const docSnap = await getDoc(memberRef);
        
        if (!docSnap.exists()) {
          console.log(`[AuthStatus] No profile in ${DEFAULT_ASSEMBLY_ID}. Checking legacy...`);
          const legacySnap = await getDoc(legacyMemberRef);
          if (legacySnap.exists()) {
            console.log(`[AuthStatus] Legacy profile detected. Awaiting admin migration.`);
            setHasLegacyProfile(true);
          }
        }
      } catch (error: any) {
        console.warn("[AuthStatus] Passive check limited by rules:", error.code);
      }
    };

    checkStatus();

    const unsubscribe = onSnapshot(memberRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMember({
          id: docSnap.id,
          email: data.email || user.email || '',
          displayName: data.displayName || user.displayName || '',
          status: data.status || 'pending',
          role: data.role || 'member',
          createdAt: data.createdAt || null,
          lastLoginAt: data.lastLoginAt || null,
          updatedAt: data.updatedAt || null,
        } as MemberProfile);
      } else {
        setMember(null);
      }
      setIsMemberLoading(false);
    }, (error) => {
      console.error("[AuthStatus] Snapshot error:", error.code);
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
      hasLegacyProfile,
      defaultAssemblyId: DEFAULT_ASSEMBLY_ID
    }}>
      {children}
    </AuthStatusContext.Provider>
  );
}

export const useAuthStatus = () => useContext(AuthStatusContext);