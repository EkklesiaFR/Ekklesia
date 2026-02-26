'use client';
import {
  Auth,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  linkWithCredential,
  AuthCredential,
} from 'firebase/auth';

/**
 * [AUTH] Initiates Google Sign-In with Redirect.
 * Stable for restricted environments like Cloud Workstations.
 */
export const signInWithGoogle = async (authInstance: Auth) => {
  console.log('[AUTH] Google redirect start');
  const provider = new GoogleAuthProvider();
  // Ensure we request email to avoid linking issues without identification
  provider.addScope('email');
  provider.addScope('profile');
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

/**
 * [AUTH] Links a pending credential to the current user.
 */
export const linkAccount = (authInstance: Auth, credential: AuthCredential) => {
  if (!authInstance.currentUser) throw new Error("No user to link to");
  return linkWithCredential(authInstance.currentUser, credential);
};

export { GoogleAuthProvider };
