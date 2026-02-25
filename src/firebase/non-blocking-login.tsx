'use client';
import {
  Auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  sendPasswordResetEmail,
  sendEmailVerification,
} from 'firebase/auth';

/** Inscription Email/Password avec envoi de vérification. */
export async function signUpEmail(authInstance: Auth, email: string, password: string): Promise<void> {
  const userCredential = await createUserWithEmailAndPassword(authInstance, email, password);
  if (userCredential.user) {
    await sendEmailVerification(userCredential.user);
  }
}

/** Connexion Email/Password. */
export function signInEmail(authInstance: Auth, email: string, password: string): Promise<any> {
  return signInWithEmailAndPassword(authInstance, email, password);
}

/** Réinitialisation de mot de passe. */
export function initiatePasswordReset(authInstance: Auth, email: string): Promise<void> {
  return sendPasswordResetEmail(authInstance, email);
}

/** Connexion Google. */
export const signInWithGoogle = async (authInstance: Auth) => {
  const provider = new GoogleAuthProvider();
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                   (typeof window !== 'undefined' && window.innerWidth < 768);

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