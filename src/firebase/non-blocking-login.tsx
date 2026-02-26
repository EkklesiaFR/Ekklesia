'use client';
import {
  Auth,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';

/**
 * [AUTH] Initiates Google Sign-In with Redirect.
 * Stable for restricted environments like Cloud Workstations.
 */
export const signInWithGoogle = async (authInstance: Auth) => {
  console.log('[AUTH] Google redirect start');
  const provider = new GoogleAuthProvider();
  return signInWithRedirect(authInstance, provider);
};

/**
 * [AUTH] Consumes the redirect result.
 */
export const handleGoogleRedirectResult = (authInstance: Auth) => {
  return getRedirectResult(authInstance);
};

/**
 * [AUTH] Creates a new user with email and password.
 */
export const signUpEmail = (authInstance: Auth, email: string, pass: string) => {
  return createUserWithEmailAndPassword(authInstance, email, pass);
};

/**
 * [AUTH] Signs in an existing user with email and password.
 */
export const signInEmail = (authInstance: Auth, email: string, pass: string) => {
  return signInWithEmailAndPassword(authInstance, email, pass);
};

/**
 * [AUTH] Initiates a password reset email.
 */
export const initiatePasswordReset = (authInstance: Auth, email: string) => {
  return sendPasswordResetEmail(authInstance, email);
};
