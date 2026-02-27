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
 * [AUTH] Stratégie Hybride : Tente le Popup (fiable sur hosted.app), 
 * bascule sur Redirect si les popups sont bloqués (mobile).
 */
export const signInWithGoogle = async (authInstance: Auth) => {
  console.log('[AUTH] Google Auth attempt', {
    origin: window.location.origin,
    method: 'Popup'
  });

  try {
    await setPersistence(authInstance, browserLocalPersistence);
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    
    try {
      // Priorité au Popup pour éviter les pertes de session sur hosted.app
      const result = await signInWithPopup(authInstance, provider);
      console.log('[AUTH] Popup Success:', result.user.uid);
      return result;
    } catch (popupError: any) {
      if (popupError.code === 'auth/popup-blocked') {
        console.warn('[AUTH] Popup blocked, falling back to Redirect');
        return signInWithRedirect(authInstance, provider);
      }
      throw popupError;
    }
  } catch (error) {
    console.error('[AUTH] Google Auth Error:', error);
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
