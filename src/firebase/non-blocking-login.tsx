'use client';
import {
  Auth,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth';

/** Initiate anonymous sign-in (non-blocking). */
export function initiateAnonymousSignIn(authInstance: Auth): void {
  signInAnonymously(authInstance);
}

/** Initiate email/password sign-up (non-blocking). */
export function initiateEmailSignUp(authInstance: Auth, email: string, password: string): void {
  createUserWithEmailAndPassword(authInstance, email, password);
}

/** Initiate email/password sign-in (non-blocking). */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string): void {
  signInWithEmailAndPassword(authInstance, email, password);
}

/** 
 * Initiate Google Sign-in with automatic device detection and fallback.
 * Uses redirect on mobile/tablets by default.
 * Uses popup on desktop with redirect fallback if blocked.
 */
export const signInWithGoogle = async (authInstance: Auth) => {
  const provider = new GoogleAuthProvider();
  
  // Detect mobile device or small screen
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                   (typeof window !== 'undefined' && window.innerWidth < 768);

  if (isMobile) {
    // Mobile browsers often block popups or handle them poorly; redirect is more reliable.
    return signInWithRedirect(authInstance, provider);
  }

  try {
    // Desktop: Try popup first for a better UX.
    await signInWithPopup(authInstance, provider);
  } catch (error: any) {
    console.error('Google Sign-In Popup failed:', error);
    
    // Fallback to redirect if popup is blocked or closed unexpectedly
    if (
      error.code === 'auth/popup-blocked' || 
      error.code === 'auth/cancelled-popup-request' ||
      error.code === 'auth/popup-closed-by-user'
    ) {
      console.log('Falling back to signInWithRedirect...');
      return signInWithRedirect(authInstance, provider);
    }
    
    // Rethrow other errors to be handled by the UI
    throw error;
  }
};
