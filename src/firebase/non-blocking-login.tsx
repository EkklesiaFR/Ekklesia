'use client';
import {
  Auth,
  GoogleAuthProvider,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  linkWithCredential,
  AuthCredential,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';

const isUnstablePopupEnv = () => {
  if (typeof window === 'undefined') return false;
  const { hostname } = window.location;
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.cloudworkstations.dev') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.')
  );
};

export const signInWithGoogle = async (authInstance: Auth) => {
  try {
    await setPersistence(authInstance, browserLocalPersistence);
    const provider = new GoogleAuthProvider();

    // DEV / environnements instables : redirect direct
    if (typeof window !== 'undefined' && isUnstablePopupEnv()) {
      console.info('[AUTH] Unstable env detected -> using redirect login');
      return signInWithRedirect(authInstance, provider);
    }

    // PROD : popup-first
    try {
      const result = await signInWithPopup(authInstance, provider);
      console.log('[AUTH] Popup Success:', result.user.uid);
      return result;
    } catch (popupError: any) {
      const code = popupError?.code;

      if (code === 'auth/popup-blocked') {
        console.warn('[AUTH] Popup blocked, falling back to Redirect');
        return signInWithRedirect(authInstance, provider);
      }

      if (code === 'auth/popup-closed-by-user') {
        console.info('[AUTH] Popup closed by user (non-blocking).');
        return;
      }

      throw popupError;
    }
  } catch (error: any) {
    const code = error?.code;

    if (code === 'auth/popup-closed-by-user') {
      console.info('[AUTH] Google Auth: popup closed (non-blocking).');
      return;
    }

    console.error('[AUTH] Google Auth Error:', code, error?.message);
    throw error;
  }
};

/**
 * [AUTH] Consommation du résultat de redirection (Fallback mobile)
 */
export const handleGoogleRedirectResult = (authInstance: Auth) => {
  return getRedirectResult(authInstance);
};

/**
 * [AUTH] Création par e-mail
 */
export const signUpEmail = (authInstance: Auth, email: string, pass: string) => {
  return createUserWithEmailAndPassword(authInstance, email, pass);
};

/**
 * [AUTH] Connexion par e-mail
 */
export const signInEmail = (authInstance: Auth, email: string, pass: string) => {
  return signInWithEmailAndPassword(authInstance, email, pass);
};

/**
 * [AUTH] Réinitialisation MDP
 */
export const initiatePasswordReset = (authInstance: Auth, email: string) => {
  return sendPasswordResetEmail(authInstance, email);
};

/**
 * [AUTH] Liaison de compte
 */
export const linkAccount = (authInstance: Auth, credential: AuthCredential) => {
  if (!authInstance.currentUser) throw new Error("No user to link to");
  return linkWithCredential(authInstance.currentUser, credential);
};

export { GoogleAuthProvider };
