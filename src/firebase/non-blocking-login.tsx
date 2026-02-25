'use client';
import {
  Auth,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  sendPasswordResetEmail,
  sendEmailVerification,
} from 'firebase/auth';

/** Initiate anonymous sign-in (non-blocking). */
export function initiateAnonymousSignIn(authInstance: Auth): void {
  signInAnonymously(authInstance);
}

/** Initiate email/password sign-up with email verification (non-blocking). */
export async function signUpEmail(authInstance: Auth, email: string, password: string): Promise<void> {
  const userCredential = await createUserWithEmailAndPassword(authInstance, email, password);
  if (userCredential.user) {
    await sendEmailVerification(userCredential.user);
  }
}

/** Initiate email/password sign-in. */
export function signInEmail(authInstance: Auth, email: string, password: string): Promise<any> {
  return signInWithEmailAndPassword(authInstance, email, password);
}

/** Reset password. */
export function initiatePasswordReset(authInstance: Auth, email: string): Promise<void> {
  return sendPasswordResetEmail(authInstance, email);
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