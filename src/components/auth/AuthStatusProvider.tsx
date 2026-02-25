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
    // 1. Toujours réinitialiser l'état au changement d'UID ou pendant le chargement initial d'Auth
    setMember(null);
    setIsMemberLoading(true);

    if (isUserLoading) return;

    if (!uid) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[AuthStatus] Aucun UID détecté (déconnecté)");
      }
      setIsMemberLoading(false);
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("[AuthStatus] Démarrage surveillance pour UID:", uid);
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
          console.log("[AuthStatus] Document trouvé:", { 
            uid, 
            status: profile.status, 
            role: profile.role 
          });
        }
        setMember(profile);
      } else {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[AuthStatus] Document members/" + uid + " INTROUVABLE. Accès refusé par défaut.");
        }
        setMember(null);
      }
      setIsMemberLoading(false);
    }, (error) => {
      if (process.env.NODE_ENV !== "production") {
        console.error("[AuthStatus] Erreur critique Firestore:", {
          code: error.code,
          message: error.message,
          hint: error.code === 'permission-denied' ? "Vérifiez les Security Rules ou si le projet est correct." : "Erreur inconnue"
        });
      }
      setMember(null);
      setIsMemberLoading(false);
    });

    return () => {
      if (process.env.NODE_ENV !== "production") {
        console.log("[AuthStatus] Cleanup listener pour UID:", uid);
      }
      unsubscribe();
    };
  }, [uid, isUserLoading, db]);

  const isActiveMember = member?.status === 'active';
  const isAdmin = member?.role === 'admin' && isActiveMember;

  // Log de diagnostic (Appelé systématiquement, condition interne)
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.log("[AuthStatus State Sync]", { 
        uid, 
        isMemberLoading, 
        isActiveMember, 
        memberStatus: member?.status,
        memberRole: member?.role 
      });
    }
  }, [uid, isMemberLoading, isActiveMember, member]);

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
