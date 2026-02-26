'use client';
import {
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth';

/**
 * Initiates a Google Sign-In operation.
 * Switches to redirect mode on mobile devices for better compatibility.
 */
export const signInWithGoogle = async (authInstance: Auth) => {
  const provider = new GoogleAuthProvider();
  
  const isMobile = typeof window !== 'undefined' && (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth < 768
  );

  if (isMobile) {
    return signInWithRedirect(authInstance, provider);
  }

  try {
    await signInWithPopup(authInstance, provider);
  } catch (error: any) {
    if (
      error.code === 'auth/popup-blocked' || 
      error.code === 'auth/cancelled-popup-request' ||
      error.code === 'auth/popup-closed-by-user'
    ) {
      return signInWithRedirect(authInstance, provider);
    }
    throw error;
  }
};
