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

  // L'UID de l'utilisateur est la clé pivot
  const uid = user?.uid;

  useEffect(() => {
    // Si l'authentification Firebase est encore en cours, on ne fait rien
    if (isUserLoading) return;

    // Reset immédiat au changement d'UID ou déconnexion
    setMember(null);
    
    if (!uid) {
      setIsMemberLoading(false);
      return;
    }

    // On commence le chargement du profil membre
    setIsMemberLoading(true);
    
    if (process.env.NODE_ENV !== "production") {
      console.log("[AuthStatus] Démarrage de la surveillance pour UID:", uid);
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
        setMember(profile);
      } else {
        setMember(null);
      }
      setIsMemberLoading(false);
    }, (error) => {
      console.error("[AuthStatus] Erreur Firestore:", error);
      setMember(null);
      setIsMemberLoading(false);
    });

    return () => unsubscribe();
  }, [uid, isUserLoading, db]);

  const isActiveMember = member?.status === 'active';
  const isAdmin = member?.role === 'admin' && isActiveMember;

  // Log de diagnostic protégé par environnement
  if (process.env.NODE_ENV !== "production") {
    useEffect(() => {
      console.log("[AuthStatus State Update]", { 
        uid, 
        isMemberLoading, 
        isActiveMember, 
        role: member?.role,
        status: member?.status 
      });
    }, [uid, isMemberLoading, isActiveMember, member]);
  }

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

/**
 * Hook pour consommer l'état d'authentification et de membre.
 */
export const useAuthStatus = () => useContext(AuthStatusContext);
