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

  const uid = user?.uid;

  useEffect(() => {
    setMember(null);
    setIsMemberLoading(true);

    if (isUserLoading) return;
    if (!uid) {
      setIsMemberLoading(false);
      return;
    }

    const memberRef = doc(db, 'assemblies', DEFAULT_ASSEMBLY_ID, 'members', uid);
    const legacyMemberRef = doc(db, 'members', uid);
    
    const syncProfile = async () => {
      try {
        const docSnap = await getDoc(memberRef);
        let currentData = docSnap.exists() ? docSnap.data() : null;

        // RECOVERY LOGIC: If new profile is missing or just "pending member", check legacy root
        if (!currentData || (currentData.status === 'pending' && currentData.role === 'member')) {
          console.log(`[AuthStatus] Checking legacy recovery for ${uid}...`);
          try {
            const legacySnap = await getDoc(legacyMemberRef);
            if (legacySnap.exists()) {
              const legacyData = legacySnap.data();
              console.log(`[AuthStatus] Found legacy profile (Status: ${legacyData.status}, Role: ${legacyData.role}). Migrating...`);
              
              // Only migrate if legacy is more "privileged" or if new doc was totally missing
              if (!currentData || legacyData.status === 'active' || legacyData.role === 'admin') {
                const migrationData = {
                  ...legacyData,
                  id: uid,
                  email: user.email || legacyData.email || '',
                  updatedAt: serverTimestamp(),
                  migratedAt: serverTimestamp(),
                  lastLoginAt: serverTimestamp()
                };
                await setDoc(memberRef, migrationData, { merge: true });
                console.log(`[AuthStatus] Migration successful.`);
                return; // onSnapshot will pick up the changes
              }
            }
          } catch (legacyErr) {
            console.warn("[AuthStatus] Legacy check failed (probably no root doc exists):", legacyErr);
          }
        }

        if (docSnap.exists()) {
          await updateDoc(memberRef, {
            email: user.email || currentData?.email || '',
            lastLoginAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } else {
          // No legacy, no new doc: Create fresh pending
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
        }
      } catch (error: any) {
        console.error("[AuthStatus] Sync Error:", error.code, error.message);
      }
    };

    syncProfile();

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
