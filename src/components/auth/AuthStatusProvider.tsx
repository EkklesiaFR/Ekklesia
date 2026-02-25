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
    setMember(null);
    setIsMemberLoading(true);

    if (isUserLoading) return;
    if (!uid) {
      setIsMemberLoading(false);
      return;
    }

    const memberRef = doc(db, 'members', uid);
    
    const syncProfile = async () => {
      try {
        const docSnap = await getDoc(memberRef);
        
        if (docSnap.exists()) {
          await updateDoc(memberRef, {
            email: user.email || '',
            displayName: user.displayName || '',
            lastLoginAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } else {
          await setDoc(memberRef, {
            id: uid,
            email: user.email || '',
            displayName: user.displayName || '',
            status: 'pending',
            role: 'member',
            joinedAt: serverTimestamp(),
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
        const profile = {
          id: docSnap.id,
          email: data.email || user.email || '',
          displayName: data.displayName || user.displayName || '',
          status: data.status || 'pending',
          role: data.role || 'member',
          joinedAt: data.joinedAt || data.createdAt || null,
          lastLoginAt: data.lastLoginAt || null,
          createdAt: data.createdAt || null,
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
  // Un admin est défini par son rôle, indépendamment de son statut actif
  // (pour permettre l'accès initial même si status=pending)
  const isAdmin = member?.role === 'admin';

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
