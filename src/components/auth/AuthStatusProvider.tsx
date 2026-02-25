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

/**
 * Provider global pour l'état d'authentification et de membre.
 * Gère le cycle de vie du document 'members/{uid}' de manière robuste.
 */
export function AuthStatusProvider({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [isMemberLoading, setIsMemberLoading] = useState(true);

  const uid = user?.uid;

  useEffect(() => {
    // 1. Reset state immediately when UID changes or starts loading
    setMember(null);
    setIsMemberLoading(true);

    if (isUserLoading) return;

    if (!uid) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[AuthStatus] No UID detected (Signed out)");
      }
      setIsMemberLoading(false);
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[AuthStatus] Starting snapshot listener for UID:", uid);
    }

    const memberRef = doc(db, 'members', uid);
    
    const unsubscribe = onSnapshot(memberRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const profile: MemberProfile = {
          status: data.status || 'pending',
          role: data.role || 'member',
          joinedAt: data.joinedAt || null,
        };
        
        if (process.env.NODE_ENV !== "production") {
          console.log("[AuthStatus] Member doc found:", profile);
        }
        setMember(profile);
      } else {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[AuthStatus] Member doc NOT FOUND for UID:", uid);
        }
        setMember(null);
      }
      // Loading ends ONLY after we get a definitive response from Firestore
      setIsMemberLoading(false);
    }, (error) => {
      if (process.env.NODE_ENV !== "production") {
        console.error("[AuthStatus] Firestore snapshot error:", error.code, error.message);
      }
      setMember(null);
      setIsMemberLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [uid, isUserLoading, db]);

  const isActiveMember = member?.status === 'active';
  const isAdmin = member?.role === 'admin' && isActiveMember;

  // Debug log for internal state tracking
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.log("[AuthStatus Internal State]", { 
        uid, 
        isMemberLoading, 
        isActiveMember, 
        memberStatus: member?.status 
      });
    }
  }, [uid, isMemberLoading, isActiveMember, member]);

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
