'use client';
import {
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
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

/**
 * Creates a new user with email and password.
 */
export const signUpEmail = (authInstance: Auth, email: string, pass: string) => {
  return createUserWithEmailAndPassword(authInstance, email, pass);
};

/**
 * Signs in an existing user with email and password.
 */
export const signInEmail = (authInstance: Auth, email: string, pass: string) => {
  return signInWithEmailAndPassword(authInstance, email, pass);
};

/**
 * Initiates a password reset email.
 */
export const initiatePasswordReset = (authInstance: Auth, email: string) => {
  return sendPasswordResetEmail(authInstance, email);
};
