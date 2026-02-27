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

/**
 * [AUTH] Connexion Google avec stratégie Simplifiée :
 * 1. Force la persistance locale.
 * 2. Tente une Popup (meilleure UX et stabilité de session).
 * 3. Fallback vers Redirect uniquement si la popup est bloquée.
 */
export const signInWithGoogle = async (authInstance: Auth) => {
  try {
    await setPersistence(authInstance, browserLocalPersistence);
    const provider = new GoogleAuthProvider();

    console.log('[AUTH] Google Auth attempt { method: "Popup" }');

    try {
      const result = await signInWithPopup(authInstance, provider);
      console.log('[AUTH] Popup Success:', result.user.uid);
      return result;
    } catch (popupError: any) {
      const code = popupError?.code;

      // Cas spécifique : Popup bloquée par le navigateur
      if (code === 'auth/popup-blocked') {
        console.warn('[AUTH] Popup blocked, falling back to Redirect');
        return signInWithRedirect(authInstance, provider);
      }

      // Cas spécifique : Utilisateur ferme la popup (non-bloquant)
      if (code === 'auth/popup-closed-by-user') {
        console.info('[AUTH] Popup closed by user (non-blocking).');
        return;
      }

      // Autres erreurs (ex: annulation de requête)
      if (code === 'auth/cancelled-popup-request') {
        console.info('[AUTH] Popup request cancelled (non-blocking).');
        return;
      }

      throw popupError;
    }
  } catch (error: any) {
    const code = error?.code;

    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      console.info('[AUTH] Google Auth: popup closed or cancelled (non-blocking).');
      return;
    }

    console.error('[AUTH] Google Auth Error:', code, error?.message);
    throw error;
  }
};

/**
 * [AUTH] Consommation du résultat de redirection (Fallback)
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
