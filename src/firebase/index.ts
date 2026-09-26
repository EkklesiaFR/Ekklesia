'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

/**
 * Singleton déterministe pour Firebase.
 * Garantit qu'une seule instance d'App, Auth, Firestore et Storage existe.
 */
const useEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true';
const alreadyInitialized = getApps().length > 0;
const app = alreadyInitialized ? getApp() : initializeApp(useEmulators
  ? { projectId: 'demo-ekklesia-test', apiKey: 'fake', authDomain: 'localhost', appId: 'demo' }
  : firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);
const storage = getStorage(app);
if (useEmulators && !alreadyInitialized) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
}

// Logs de diagnostic pour confirmer le singleton
console.log('[FIREBASE] apps count:', getApps().length);
console.log('[FIREBASE] app name:', app.name);

export { app as firebaseApp, auth, firestore, storage };

/**
 * Retourne les instances initialisées.
 * Utilisé par le FirebaseProvider pour distribuer les services.
 */
export function initializeFirebase() {
  return {
    firebaseApp: app,
    auth,
    firestore,
    storage,
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
